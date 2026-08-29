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

az staticwebapp appsettings set \
  --name "$SWA_NAVN" \
  --resource-group "$RESSURSGRUPPE" \
  --setting-names "LAGER_TILKOBLING=$TILKOBLING" \
  --output none

URL=$(az staticwebapp show --name "$SWA_NAVN" --resource-group "$RESSURSGRUPPE" \
  --query defaultHostname -o tsv)

cat <<OPPSUMMERING

Ferdig.

  Lagringskonto   $LAGERNAVN
  Static Web App  $SWA_NAVN
  Adresse         https://$URL

Neste steg
  1. Legg felter.json inn i innhold-containeren:
       npm run seed:sky
  2. Push til $GREN, så bygger og utruller GitHub Actions.

⚠ Nettstedet har ingen innlogging før trinn 9. Ikke last opp ekte
  familiebilder før den er på plass.

OPPSUMMERING
