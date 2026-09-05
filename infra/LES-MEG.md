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

## Utrulling når appen ble opprettet frakoblet

Ble `opprett.sh` kjørt uten `GITHUB_TOKEN`, står Static Web App-en med
«Waiting for deployment», og **portalen har ingen «Deployment»-fane** å koble
repoet fra — den fanen finnes bare for apper Azure selv koblet til GitHub.

Repoet har derfor `.github/workflows/azure-static-web-apps.yml`. Den mangler
bare nøkkelen:

1. I portalen, på Static Web App-en: **Manage deployment token** øverst. Kopier
   verdien.
2. I GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**. Navn `AZURE_STATIC_WEB_APPS_API_TOKEN`, verdien fra punkt 1.
3. Kjør arbeidsflyten: **Actions → Bygg og rull ut → Run workflow**, eller bare
   push noe til grenen.

Etter første vellykkede kjøring viser portalen adressen som levende.

**Hvor `staticwebapp.config.json` skal ligge.** Den ligger i `app/public/`, slik
at Vite kopierer den til `app/dist/` — altså inn i `output_location`. Azure
leter etter filen i `app_location` eller `output_location`, ikke i rota av
repoet. Lå den i rota, ville CSP, `X-Robots-Tag` og `navigationFallback` blitt
ignorert i drift.

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

**Det er to ressurser, ikke én.** Det er her folk går seg vill:

| Ressurs | Rolle |
|---|---|
| **Email Communication Service** | Eier avsenderdomenet. Har ingen tilkoblingsstreng |
| **Communication Service** | Sender e-posten. Det er *denne* som har tilkoblingsstrengen |

Domenet opprettes i den første og må **kobles til** den andre. Gjør du bare det
ene, får du en tilkoblingsstreng som ikke kan sende fra noe domene.

1. Opprett en **Email Communication Service** (portalen, søk på navnet).
   Datalokasjon Europe.
2. Under den: **Provision domains → Add domain**. Et **Azure-håndtert** domene
   er ferdig med én gang og krever ingen DNS — bruk det for å bevise at
   innloggingen virker. Avsenderadressen blir da noe i retning av
   `DoNotReply@8e3d2f1a-….azurecomm.net` — merk at det er en **GUID**, ikke et
   lesbart navn — og den havner lett i søppelpost. Et eget,
   verifisert domene (f.eks. `post.dittdomene.no`) er det som virker i lengden,
   men krever TXT-, SPF- og DKIM-oppføringer og et døgns venting.
3. Opprett en **Communication Service** i samme ressursgruppe.
4. I den: **Email → Domains → Connect domain**, og velg domenet fra punkt 2.
5. Hent tilkoblingsstrengen fra Communication Service → **Keys**, og sett
   innstillingene:

```bash
az staticwebapp appsettings set -n famhist-web -g rg-familiehistorie \
  --setting-names ACS_TILKOBLING="endpoint=https://…;accesskey=…" \
                  EPOST_AVSENDER="DoNotReply@ERSTATT-MEG.azurecomm.net"
```

Kontroller at de kom inn:

```bash
az staticwebapp appsettings list -n famhist-web -g rg-familiehistorie -o table
```

`MILJO` settes ikke i Azure. Standarden er drift, og da står `Secure` på
sesjonskapselen.

### Når koden ikke kommer fram

`/api/auth/kode` svarer alltid 202, uansett hva som gikk galt — ellers ville
endepunktet røpet hvem som står på tilgangslisten. Riktig, men det gjør at et
manglende oppsett ser nøyaktig ut som et vellykket kall. Derfor finnes

```
https://<adressen-din>/api/helse
```

Den svarer uten innlogging, med ja/nei for hver del av oppsettet og en
merknadsliste — aldri med verdier, og aldri med hvem som står på listen.

```json
{
  "lager": true,
  "tilgangsliste": true,
  "antallPersoner": 1,
  "epostOppsett": false,
  "avsenderdomene": null,
  "sesjonsnokkel": true,
  "merknader": ["ACS_TILKOBLING og/eller EPOST_AVSENDER mangler. …"]
}
```

Sier den at alt er på plass, men koden likevel uteblir, er rekkefølgen:

1. **Søppelpost.** Azure-håndterte avsenderdomener havner der ofte.
2. **Står adressen på tilgangslisten?** `antallPersoner` sier hvor mange som
   står der, ikke hvem. Er den 1, og du prøver en annen adresse enn den du
   seedet med, kommer det ingen kode — det er meningen.
3. **Er `EPOST_AVSENDER` skrevet nøyaktig** slik den står under domenets
   *MailFrom addresses*? Den er ofte `DoNotReply@<en-guid>.azurecomm.net` — en
   faktisk GUID, ikke et navn. `/api/helse` viser domenedelen, så en verdi som
   ser oppdiktet ut avslører seg der. Merk at `epostOppsett: true` bare betyr at
   variablene er satt, ikke at adressen finnes.
4. **Er domenet koblet til Communication Service-ressursen?** Er det ikke det,
   feiler utsendingen med `DomainNotLinked`, og det ser du bare i loggen.

### Om `apiRuntime`

`app/public/staticwebapp.config.json` setter `"platform": { "apiRuntime":
"node:20" }`. Verdien er ikke fritt valgt: Static Web Apps har en egen liste
over hvilke Node-versjoner *managed functions* kan kjøre, og den er kortere enn
listen over versjoner Oryx kan bygge med.

Står det en versjon der som ikke støttes, **melder utrullingen «Succeeded»
likevel** — men funksjonsverten starter ikke, og alle kall til `/api/*` svarer
tomt. Symptomet er nettopp et tomt svar uten statuskode å ta tak i, og det
peker ingen steder av seg selv.

Dette er ikke teori: med `node:22` svarte alle endepunktene tomt, `/api/ping`
inkludert. Med `node:20`, uten andre endringer, svarte de normalt.

Bygget skjer fortsatt med Node 22 (`engines` i `api/package.json`). Det er
uproblematisk: TypeScript-utdataen er ES2023, som Node 20 kjører.

### Diagnosesiden

```
https://<adressen-din>/diagnose.html
```

Kaller `/api/ping`, `/api/helse`, `/api/meg` og `/api/indeks` fra nettleseren og
viser **statuskoden og kroppen på skjermen**. Ren statisk HTML, så den virker
også når API-et ikke gjør det.

Den finnes fordi Safari laster ned `text/plain` i stedet for å vise det, og
fordi en nedlastet tom fil ikke sier hva som gikk galt. På telefon og nettbrett
er dette raskeste vei til et svar; `curl -i` gjør samme nytten der du har et
skall.

Grønn statuskode betyr «svarte som forventet», ikke «alt er bra»: 401 fra
`/api/meg` er riktig svar når ingen er innlogget. Tomme kropper markeres
eksplisitt — det er signaturen på at funksjonsverten ikke starter.

### Loggen

**Static Web Apps har ingen logg før Application Insights er slått på.** Det er
det som mangler når det ikke står noe noe sted.

På Static Web App-en: **Settings → Application Insights → On**, og la Azure
opprette en ressurs. Utsendingsfeil fra API-et havner da under
**Application Insights → Logs**:

```kusto
traces
| where message contains "engangskode"
| order by timestamp desc
exceptions
| order by timestamp desc
```

Det er `exceptions` som er interessant her: feiler ACS-kallet, logger API-et
det med `console.error("Klarte ikke sende engangskode:", e)`, og selve
årsaken fra Azure står i unntaket.
