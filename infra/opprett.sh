#!/usr/bin/env bash
# Trinn 1 – oppretter Azure-ressursene for Familiehistorie.
#
# Kjøres én gang. Krever az CLI og at du er logget inn (`az login`).
# Skriptet er idempotent: å kjøre det på nytt oppdaterer i stedet for å feile.

set -euo pipefail

PREFIKS="${PREFIKS:-famhist}"
RESSURSGRUPPE="${RESSURSGRUPPE:-rg-familiehistorie}"
STED="${STED:-norwayeast}"
# Static Web Apps finnes i et begrenset sett regioner. westeurope er nærmest.
SWA_STED="${SWA_STED:-westeurope}"
SWA_NAVN="${SWA_NAVN:-${PREFIKS}-web}"
REPO="${REPO:-https://github.com/jachrist/Familiehistorie}"
# Grenen Azure kobler GitHub Actions til. Standard er den som er sjekket ut nå,
# ikke main – ellers peker arbeidsflyten på en gren uten kode.
GREN="${GREN:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"

kilde=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

echo "▸ Ressursgruppe $RESSURSGRUPPE i $STED"
az group create --name "$RESSURSGRUPPE" --location "$STED" --output none

echo "▸ Lagringskonto og containere"
az deployment group create \
  --resource-group "$RESSURSGRUPPE" \
  --template-file "$kilde/main.bicep" \
  --parameters prefiks="$PREFIKS" sted="$STED" \
  --output none

LAGERNAVN=$(az deployment group show \
  --resource-group "$RESSURSGRUPPE" --name main \
  --query properties.outputs.lagernavn.value -o tsv)

echo "  lagringskonto: $LAGERNAVN"

echo "▸ Static Web App (gratisplanen), gren $GREN"
# --source og --token lar Azure generere GitHub Actions-arbeidsflyten selv.
# Uten GITHUB_TOKEN opprettes appen frakoblet, og du kobler repoet i portalen.
if [ -n "${GITHUB_TOKEN:-}" ]; then
  az staticwebapp create \
    --name "$SWA_NAVN" \
    --resource-group "$RESSURSGRUPPE" \
    --location "$SWA_STED" \
    --sku Free \
    --source "$REPO" \
    --branch "$GREN" \
    --token "$GITHUB_TOKEN" \
    --app-location "/app" \
    --api-location "/api" \
    --output-location "dist" \
    --output none
else
  az staticwebapp create \
    --name "$SWA_NAVN" \
    --resource-group "$RESSURSGRUPPE" \
    --location "$SWA_STED" \
    --sku Free \
    --output none
  echo "  ⚠ Opprettet uten GitHub-kobling (GITHUB_TOKEN var ikke satt)."
  echo "    Koble repoet i portalen, eller kjør på nytt med GITHUB_TOKEN satt."
fi

echo "▸ Kobler API-et til lagringskontoen"
# Static Web Apps på gratisplanen kjører managed functions, der
# DefaultAzureCredential ikke har en identitet å bruke. Tilkoblingsstrengen
# legges derfor i appinnstillingene. Se infra/LES-MEG.md om hvorfor, og om hva
# som skal til for å gå over til Managed Identity senere.
TILKOBLING=$(az storage account show-connection-string \
  --name "$LAGERNAVN" --resource-group "$RESSURSGRUPPE" \
  --query connectionString -o tsv)

# Signeringsnøkkelen for sesjonstokenet lages her og settes én gang. Byttes den
# senere, blir alle utestående sesjoner ugyldige – det er en gyldig nødbrems,
# men ikke noe som skal skje ved hver kjøring. Derfor gjenbrukes den som
# allerede står der.
HEMMELIGHET=$(az staticwebapp appsettings list \
  --name "$SWA_NAVN" --resource-group "$RESSURSGRUPPE" \
  --query "properties.SESJON_HEMMELIGHET" -o tsv 2>/dev/null || true)

if [ -z "$HEMMELIGHET" ] || [ "$HEMMELIGHET" = "null" ]; then
  HEMMELIGHET=$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")
  echo "  ny SESJON_HEMMELIGHET generert"
else
  echo "  beholder eksisterende SESJON_HEMMELIGHET"
fi

az staticwebapp appsettings set \
  --name "$SWA_NAVN" \
  --resource-group "$RESSURSGRUPPE" \
  --setting-names "LAGER_TILKOBLING=$TILKOBLING" "SESJON_HEMMELIGHET=$HEMMELIGHET" \
  --output none

URL=$(az staticwebapp show --name "$SWA_NAVN" --resource-group "$RESSURSGRUPPE" \
  --query defaultHostname -o tsv)

echo "▸ Setter CORS-regler for https://$URL"
# Nettleseren laster opp media direkte til Blob. Uten CORS blokkerer den kallet
# før det sendes. Adressen er ikke kjent før Static Web App-en er opprettet,
# derfor en ny kjøring av malen her.
az deployment group create \
  --resource-group "$RESSURSGRUPPE" \
  --template-file "$kilde/main.bicep" \
  --parameters prefiks="$PREFIKS" sted="$STED" tillatteOpphav="[\"https://$URL\"]" \
  --output none

cat <<OPPSUMMERING

Ferdig.

  Lagringskonto   $LAGERNAVN
  Static Web App  $SWA_NAVN
  Adresse         https://$URL

Satt automatisk
  LAGER_TILKOBLING    tilkoblingsstreng til $LAGERNAVN
  SESJON_HEMMELIGHET  signerer sesjonstokenet

Neste steg
  1. Legg innhold og tilgangsliste i innhold-containeren. Adressen du oppgir
     blir eneste redaktør:
       npm run seed:sky -- --redaktoer=deg@eksempel.no

  2. Sett opp e-post. Uten dette kommer ingen engangskoder fram, og
     nettstedet kan ikke logges inn i:
       az extension add --name communication
       az communication email create -g $RESSURSGRUPPE -n $PREFIKS-epost -l global --data-location europe
       # Legg til et domene (Azure-håndtert går uten DNS, men havner lett i
       # søppelpost — eget, verifisert domene er det som virker i lengden),
       # koble det til en Communication Services-ressurs, og sett så:
       az staticwebapp appsettings set -n $SWA_NAVN -g $RESSURSGRUPPE \\
         --setting-names ACS_TILKOBLING="<tilkoblingsstreng>" \\
                         EPOST_AVSENDER="ikke-svar@<domenet>"

  3. Push til $GREN, så bygger og utruller GitHub Actions.

  4. Legger dere på et eget domene senere, må det inn i CORS-reglene:
       az deployment group create -g $RESSURSGRUPPE --template-file infra/main.bicep \\
         --parameters prefiks=$PREFIKS tillatteOpphav='["https://$URL","https://eget.domene"]' 

OPPSUMMERING
