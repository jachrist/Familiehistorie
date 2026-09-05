# Trinn 1 — Azure-ressurser

Kjøres én gang, av deg.

## Hvor

Fra **rota av repoet**. Du trenger ikke opprette noen mappe — `git clone` lager
den:

```bash
git clone -b claude/new-project-scope-elqj9d https://github.com/jachrist/Familiehistorie.git
cd Familiehistorie
```

Har du repoet fra før, holder det med `git pull`.

**Forutsetninger:** [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli),
Node 22, og `az login` kjørt.

## Hvilket skall

`opprett.sh` er et bash-skript. **PowerShell kan ikke kjøre det** — du får
«The term './infra/opprett.sh' is not recognized». Velg én av disse:

**Git Bash** (enklest på Windows, følger med Git for Windows som du allerede
har). Høyreklikk i repomappa → «Open Git Bash here», eller:

```powershell
& "C:\Program Files\Git\bin\bash.exe" infra/opprett.sh
```

**Azure Cloud Shell** ([shell.azure.com](https://shell.azure.com)) er verdt å
vite om: bash i nettleseren, med `az` ferdig installert og allerede innlogget.
Da slipper du å installere Azure CLI på maskinen i det hele tatt.

```bash
git clone -b claude/new-project-scope-elqj9d https://github.com/jachrist/Familiehistorie.git
cd Familiehistorie
npm install                 # seed-skriptet trenger @azure/storage-blob
./infra/opprett.sh
```

`npm install` i rota er nok. Du trenger **ikke** `npm run installer` her — den
installerer avhengighetene for `app/` og `api/`, som bare brukes til å kjøre
nettstedet lokalt. Cloud Shell har dessuten Node 24, som `api/` med vilje ikke
godtar; det gir advarsler du ikke trenger å bry deg om så lenge du bare seeder.

**WSL** virker også, hvis du har det.

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
# Adressen du oppgir blir eneste redaktør. Virker likt i PowerShell og bash.
npm run seed:sky -- --redaktoer=deg@eksempel.no
```

Utelater du `--redaktoer`, spør skriptet.

### Det ene som gjenstår: e-post

Skriptet setter `LAGER_TILKOBLING` og `SESJON_HEMMELIGHET` selv. **E-post må
settes opp for hånd**, fordi et avsenderdomene ikke kan opprettes ferdig av et
skript — det krever DNS-oppføringer og en verifisering som tar tid.

Uten `ACS_TILKOBLING` og `EPOST_AVSENDER` kommer ingen engangskoder fram, og da
kan ingen logge inn i drift. API-et feiler høylytt i loggen i stedet for å late
som om e-posten gikk.

1. Opprett en Email Communication Service og en Communication Services-ressurs
   (portalen er greiest første gang — søk etter «Email Communication Service»).
2. Legg til et domene. Et **Azure-håndtert** domene virker uten DNS-arbeid og er
   fint for å teste at innloggingen funker, men havner lett i søppelpost. Eget,
   verifisert domene er det som virker i lengden.
3. Koble domenet til Communication Services-ressursen, og sett innstillingene:

```bash
az staticwebapp appsettings set -n famhist-web -g rg-familiehistorie \
  --setting-names ACS_TILKOBLING="endpoint=https://…;accesskey=…" \
                  EPOST_AVSENDER="ikke-svar@dittdomene.no"
```

`MILJO` settes ikke i Azure. Standarden er drift, og da står `Secure` på
sesjonskapselen.
