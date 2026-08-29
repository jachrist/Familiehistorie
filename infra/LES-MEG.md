# Trinn 1 — Azure-ressurser

Kjøres én gang, av deg.

## Hvor

Fra **rota av repoet**. Du trenger ikke opprette noen mappe — `git clone` lager
den:

```bash
git clone https://github.com/jachrist/Familiehistorie.git
cd Familiehistorie
git checkout claude/new-project-scope-elqj9d
```

Har du repoet fra før, holder det med `git pull`.

**Forutsetninger:** [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli),
Node 22, og `az login` kjørt.

## Kjøring

```bash
# Valgfritt: overstyr standardverdiene
export PREFIKS=famhist              # gir lagringskontoen famhistlager
export RESSURSGRUPPE=rg-familiehistorie
export STED=norwayeast
export SWA_STED=westeurope          # Static Web Apps finnes ikke i norwayeast
export GITHUB_TOKEN=ghp_…           # valgfritt, se under

./infra/opprett.sh
```

Skriptet finner Bicep-malen selv, så det virker uansett hvor du står — men
`npm run seed:sky` etterpå må kjøres fra rota.

Skriptet er idempotent — kjøres det på nytt, oppdateres ressursene i stedet for
å feile.

## Hva som opprettes

| Ressurs | Hvorfor |
|---|---|
| Lagringskonto, Standard_LRS, Hot | Alt innhold |
| Container `innhold` | `felter.json`, `indeks.json`, `aar/*.json` |
| Container `media` | Web-størrelse bilder, miniatyrer, video, plakatbilder |
| Container `originaler` | Bildeoriginaler i full oppløsning |
| Tabell `otpkoder` | Engangskoder og rate-limiting (tas i bruk i trinn 9) |
| Blob-versjonering + 30 dagers soft delete | Angrerett uten versjonshistorikk i appen |
| Livssyklusregler | Originaler til Archive, gamle versjoner til Cool |
| Static Web App, gratisplanen | Nettstedet og API-et |

**Hvorfor originalene har egen container.** Azures livssyklusregler treffer på
sti, ikke filendelse. En regel som arkiverte «alt under `media/`» ville tatt med
web-versjonene og videoen appen faktisk serverer — og Archive-nivået må
rehydreres i timevis før det kan leses. Å skille dem i to containere gjør at en
feilkonfigurert regel ikke kan ramme det som vises.

## Om `GITHUB_TOKEN`

Settes den, oppretter Azure GitHub-koblingen og genererer arbeidsflyten under
`.github/workflows/` i repoet ditt. Tokenet trenger `repo`- og
`workflow`-tillatelse. Settes den ikke, opprettes Static Web App-en frakoblet,
og du kobler repoet fra portalen etterpå — resultatet blir det samme.

**Hvilken gren?** Skriptet bruker den du har sjekket ut, og skriver den ut før
det oppretter appen. Koden ligger foreløpig på
`claude/new-project-scope-elqj9d`. Vil du utrulle fra `main` i stedet, slå
grenen sammen først — ellers peker arbeidsflyten på en gren uten kode. Overstyr
med `export GREN=main` hvis du vet hva du gjør.

## Om Managed Identity

Arkitekturdokumentet ([§5](../docs/omfang-og-arkitektur.md#5-arkitektur)) beskriver
Managed Identity fra API-et mot lagringskontoen, slik at ingen nøkkel ligger i
konfigurasjon. Det forutsetter en **linket Function App**, som krever
Standard-planen.

På gratisplanen kjører API-et som *managed functions* i et miljø der
`DefaultAzureCredential` ikke har en identitet å bruke. Derfor legger skriptet en
tilkoblingsstreng i appinnstillingen `LAGER_TILKOBLING`.

Koden er skrevet for begge deler: settes `LAGER_KONTO` i stedet for
`LAGER_TILKOBLING`, brukes `DefaultAzureCredential` og user delegation-SAS. Å gå
over senere er å bytte én appinnstilling og gi identiteten rollene
**Storage Blob Data Contributor** og **Storage Table Data Contributor**.

## Etter oppsettet

```bash
npm run seed:sky      # legger felter.json i innhold-containeren
```

> **Nettstedet har ingen innlogging før trinn 9.** Alt som lastes opp før den er
> på plass, er lesbart for enhver som finner adressen. Ikke legg inn ekte
> familiebilder ennå.
