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

Skriptet setter `LAGER_TILKOBLING` og `SESJON_HEMMELIGHET` selv. **E-post settes
opp for hånd**, men det er nå to appinnstillinger og ingen Azure-ressurser:

```bash
az staticwebapp appsettings set -n famhist-web -g rg-familiehistorie \
  --setting-names RESEND_NOKKEL="re_…" \
                  EPOST_AVSENDER="Familiehistorie <ikke-svar@dittdomene.no>"
```

Nøkkelen hentes fra [resend.com](https://resend.com) → **API Keys**.

**Om avsenderadressen.** Resend lar deg sende fra `onboarding@resend.dev` uten
noe oppsett, men **bare til adressen kontoen er registrert på**. Det holder til
å bevise at innloggingen virker, og ikke lenger. Skal familien kunne logge inn,
må et eget domene verifiseres under **Domains** — tre DNS-oppføringer, og da
sender du fra `ikke-svar@dittdomene.no` med god leveringsevne.

Formatet `Navn <adresse@domene.no>` er valgfritt, men gjør at meldingen står
med avsendernavn i innboksen i stedet for en naken adresse.

`MILJO` settes ikke i Azure. Standarden er drift, og da står `Secure` på
sesjonskapselen.

### DNS for eget avsenderdomene

Resend viser de eksakte verdiene under **Domains → Add domain**. Formen er
denne, med `historie.mqx.no` som eksempel på domenet du verifiserer:

| Type | Navn | Verdi | Hva den gjør |
|---|---|---|---|
| `MX` | `send.historie.mqx.no` | `feedback-smtp.<region>.amazonses.com`, prioritet 10 | Tar imot sprett og klager |
| `TXT` | `send.historie.mqx.no` | `v=spf1 include:amazonses.com ~all` | SPF: sier hvem som får sende |
| `TXT` | `resend._domainkey.historie.mqx.no` | `p=MIGfMA0…` (lang nøkkel) | DKIM: signerer meldingene |
| `TXT` | `_dmarc.historie.mqx.no` | `v=DMARC1; p=none;` | Valgfri, men anbefalt |

**Kopier verdiene fra Resend, ikke herfra.** DKIM-nøkkelen er unik per domene, og
`<region>` avhenger av hvor kontoen din ligger. Tabellen viser hvilke *typer*
oppføringer du skal vente deg, så du kan se om noe mangler.

**Mange DNS-paneler legger på domenet selv.** Skriv da bare `send` og
`resend._domainkey`, ikke hele navnet — ellers ender du med
`send.historie.mqx.no.historie.mqx.no`.

**Én ting som kan kollidere.** Skal samme vertsnavn også være nettstedets adresse
(CNAME mot Static Web App-en), er det verdt å vite at et navn med CNAME ikke kan
ha andre oppføringer. Her går det bra: alle e-postoppføringene ligger på
*under*navn (`send.`, `resend._domainkey.`, `_dmarc.`), ikke på selve
`historie.mqx.no`. Men legger du en TXT der senere, får du problemer.

Verifiseringen tar fra minutter til et døgn. Resend viser status per oppføring,
så du ser hvilken som mangler i stedet for å gjette.

### Når koden ikke kommer fram

`/api/auth/kode` svarer alltid 202, uansett hva som gikk galt — ellers ville
endepunktet røpet hvem som står på tilgangslisten. Sjekk i denne rekkefølgen:

1. **Er taket nådd?** Maks fem kodebestillinger per adresse per time. Over det
   sendes ingenting, og svaret utad er uendret 202 — det er meningen, men det
   ser identisk ut med en vellykket utsending. Under testing er dette den
   vanligste årsaken. Vinduet er rullende fra første bestilling, så det løsner
   av seg selv innen en time; ellers kan du prøve med en annen adresse på
   listen.
2. **`/api/helse`** — sier om `RESEND_NOKKEL` og `EPOST_AVSENDER` er satt, og
   viser avsenderdomenet. `epostOppsett: true` betyr bare at variablene finnes,
   ikke at nøkkelen er gyldig.
3. **Resends egen logg** — [resend.com](https://resend.com) → **Emails**. Hver
   utsending står der med status, og en avvist melding sier hvorfor. Det er den
   raskeste veien til svar, og grunnen til at denne leverandøren er verdt de
   par minuttene med DNS.
4. **Søppelpost**, hvis Resend sier at meldingen ble levert.
5. **Application Insights → `traces` og `exceptions`.** Hver kodebestilling
   logger hvilken vei den tok — «adressen står ikke på tilgangslisten», «taket
   er nådd», eller «engangskode sendt» — uten adressen og uten koden. Er
   Resends logg tom, sier denne hvorfor kallet aldri ble gjort.

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
