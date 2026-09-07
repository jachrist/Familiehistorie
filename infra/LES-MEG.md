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
npm run seed:sky -- --redaktoer=din.adresse@domenet.no
```

Utelater du `--redaktoer`, spør skriptet.

### Tømme testdataene før ekte innhold

Eksempelårene fra `seed` skal ut før familiens materiale legges inn.

```bash
npm run tom:sky                      # viser hva som finnes, sletter ingenting
npm run tom:sky -- --slett           # årsdokumenter og indeks
npm run tom:sky -- --slett --media   # også bilder og video
```

**Det samme kan gjøres fra `/admin` i appen**, uten skall og uten
tilkoblingsstreng — og der tas det en sikkerhetskopi først. Skriptene finnes for
tilfellet der appen ikke svarer.

**Tørrkjøring er standard**, og med et skall som har TTY må antallet skrives
inn for å bekrefte. `felter.json` og `tilgang.json` røres aldri — det første er
oppsett, det andre er veien inn.

Mediefiler følger ikke med når årsdokumentene slettes med mindre `--media` er
med. Det er samme prinsipp som i appen: å fjerne et bilde fra et år skal være
angrbart, så blobben blir liggende til noen rydder med vilje.

I Azure er versjonering og soft delete på, så en sletting kan angres i 30
dager. Lokalt mot Azurite er den endelig.

### Hvem står på tilgangslisten?

Den som seedet listen er eneste som kan logge inn. Skriver du inn en annen
adresse, svarer nettstedet like blidt som ellers — endepunktet skal ikke røpe
hvem som står der — og ingen kode kommer.

`/api/helse` viser adressene maskert — `ja***@jcconsulting.no` — som er nok til
å kjenne igjen sin egen og for lite til å gjette andres. Det er en bevisst
oppmyking av regelen om at endepunktene ikke røper hvem som står på listen:
uten den kan en som er låst ute ikke se om det er adressen eller noe annet som
er galt, og da må svaret hentes fra en logg som kan ligge timer etter.

Vil du se hele listen, les bloben:

```bash
KEY=$(az storage account keys list -g rg-familiehistorie -n famhistlager --query "[0].value" -o tsv)
az storage blob download --account-name famhistlager --account-key "$KEY" \
  -c innhold -n tilgang.json --file /dev/stdout
```

Og rett den om nødvendig:

```bash
cat > tilgang.json <<'JSON'
{
  "personer": [
    { "epost": "din.adresse@domenet.no", "navn": "Ditt Navn", "roller": ["familie", "redaktoer"] }
  ]
}
JSON

az storage blob upload --account-name famhistlager --account-key "$KEY" \
  -c innhold -n tilgang.json --file tilgang.json --overwrite \
  --content-type "application/json"
```

Listen bufres i 60 sekunder i API-et, så gi det et minutt. Etterpå redigeres den
fra `/tilgang` i appen, som er meningen — dette er bare veien inn første gang.

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

### «API key is invalid»

Står dette i `sisteKodebestilling`, nådde kallet fram til Resend og ble avvist
på autentiseringen:

```
Resend avviste utsendingen (HTTP 401):
{"statusCode":401,"name":"validation_error","message":"API key is invalid"}
```

**Resend viser hele nøkkelen bare én gang**, i det øyeblikket den opprettes.
Går du tilbake til *API Keys* senere, ser du en forkortet versjon —
`re_abc123…xyz`. Den ser ut som en nøkkel, men er det ikke. Kopierer man den,
får man nøyaktig denne feilen.

Lag en ny under **API Keys → Create API Key**, kopier den med en gang, og sett
den:

```bash
az staticwebapp appsettings set -n famhist-web -g rg-familiehistorie \
  --setting-names RESEND_NOKKEL="re_…"
```

Ingen ny utrulling nødvendig — appinnstillinger slår inn på neste kall.

### DNS for eget avsenderdomene

Resend viser de eksakte verdiene under **Domains → Add domain**. Fire
oppføringer, med `historie.mqx.no` som eksempel på domenet du verifiserer:

| Type | Navn | Verdi | Hva den gjør |
|---|---|---|---|
| `TXT` | `resend._domainkey.historie.mqx.no` | `p=MIGfMA0…` (lang nøkkel) | DKIM: den offentlige nøkkelen mottakeren sjekker signaturen mot |
| `CNAME` | `send.historie.mqx.no` | `send.<noe>.mta.net` | SPF: peker videre til Resends liste over utsendere |
| `CNAME` | `rsend.historie.mqx.no` | `rsend-eu…mta.net` | Returadressen: hit går sprett og klager |
| `TXT` | `_dmarc.historie.mqx.no` | `v=DMARC1; p=none;` | Valgfri: sier hva mottakeren skal gjøre når en sjekk ryker |

`p=none` betyr «rapporter, men ikke avvis». Riktig å starte med — strammes til
`quarantine` eller `reject` først når du ser at alt går gjennom.

**«Enable Receiving» lar du stå av.** Den er for innkommende post til domenet.
Vi sender bare.

**Kopier verdiene fra Resend, ikke herfra.** DKIM-nøkkelen er unik per domene, og
vertsnavnene i CNAME-ene avhenger av hvilken region kontoen ligger i. Tabellen
viser hvilke *typer* oppføringer du skal vente deg, så du kan se om noe mangler.

**Navnene er relative til sonen.** Ligger DNS-sonen på `mqx.no` mens domenet du
verifiserer er `historie.mqx.no`, skriver du `send.historie`,
`rsend.historie`, `resend._domainkey.historie` og `_dmarc.historie` — akkurat
slik Resend viser dem. Panelet legger på `.mqx.no` selv. Skriver du hele navnet,
ender du med `send.historie.mqx.no.mqx.no`.

**Én ting som kan kollidere.** Skal samme vertsnavn også være nettstedets adresse
(CNAME mot Static Web App-en), er det verdt å vite at et navn med CNAME ikke kan
ha andre oppføringer. Her går det bra: alle e-postoppføringene ligger på
*under*navn (`send.`, `rsend.`, `resend._domainkey.`, `_dmarc.`), ikke på selve
`historie.mqx.no`. Men legger du en TXT der senere, får du problemer.

Verifiseringen tar fra minutter til et døgn. Resend viser status per oppføring,
så du ser hvilken som mangler i stedet for å gjette.

**Når domenet er verifisert**, bytt avsenderadressen — det er hele poenget med
øvelsen. `onboarding@resend.dev` går bare til din egen adresse; med eget domene
kan hele familien logge inn:

```bash
az staticwebapp appsettings set \
  --name famhist-web \
  --setting-names EPOST_AVSENDER="Familiehistorie <ikke-svar@historie.mqx.no>"
```

### Når koden ikke kommer fram

`/api/auth/kode` svarer alltid 202, uansett hva som gikk galt — ellers ville
endepunktet røpet hvem som står på tilgangslisten. Sjekk i denne rekkefølgen:

0. **`/api/helse` → `sisteKodebestilling`.** Her står utfallet av forrige
   kodebestilling, i sanntid: «Engangskode sendt.», «Adressen står ikke på
   tilgangslisten.», «Avvist: taket … er nådd.», eller feilmeldingen fra
   Resend. Uten adresse og uten kode, så den kan leses uten innlogging. Dette
   er første stopp — resten under er bare aktuelt hvis den ikke gir svaret.
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

### «Unable to create client for AzureWebJobsStorage»

Denne står i `traces` hvert 30. sekund, sammen med `DrainMode mode enabled` og
`Calling StopAsync on the registered listeners`:

```
Process reporting unhealthy: Unhealthy. Health check entries are
  {"azure.functions.webjobs.storage":{"status":"Unhealthy",
   "description":"Unable to create client for AzureWebJobsStorage"}}
```

**Det er støy, ikke en feil.** Managed functions på Static Web Apps kjører uten
`AzureWebJobsStorage` med vilje, og helsesjekken spør etter den likevel.
Innstillingen kan heller ikke settes — plattformen avviser navnet:

```
AppSetting with name(s) 'AzureWebJobsStorage' are not allowed.
```

At verten starter på nytt jevnlig er normalt på gratisplanen, som skalerer til
null mellom kall. Bekreft heller at det virker, i stedet for å jage
helsemeldingen: i samme logg skal det stå `Host started`, `17 functions loaded`,
og `Executed 'Functions.ping' (Succeeded)`. Gjør det, er verten frisk nok.

Filtrer bort støyen når du leter etter noe ekte:

```kusto
traces
| where timestamp > ago(1h)
| where message !contains "Health check" and message !contains "StopAsync"
      and message !contains "DrainMode"
| project timestamp, message
| order by timestamp desc
```

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
