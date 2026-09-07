# Kom i gang

Status: **fase 1, trinn 1–8** av [faseplanen](docs/omfang-og-arkitektur.md#14-faseplan).

> **Nettstedet har ingen innlogging ennå.** Den kommer i trinn 9. Alt som legges
> inn før den er på plass, er lesbart for enhver som finner adressen. Ikke last
> opp ekte familiebilder ennå.

## Hent koden

Du trenger ikke opprette noen mappe — `git clone` lager den. Alle kommandoer
under kjøres fra **rota av repoet**.

```bash
git clone -b claude/new-project-scope-elqj9d https://github.com/jachrist/Familiehistorie.git
cd Familiehistorie
```

`-b` kloner og sjekker ut grenen i ett steg. Bekreft med
`git branch --show-current`.

## Lokalt

### Forutsetninger

**Node 22 — nøyaktig 22, ikke nyere.** Sjekk med `node --version`.

Vinduet er smalt i begge ender: Functions Core Tools v4 krever Node 22 eller
nyere, mens Azure Functions ikke støtter Node 24. Node 20 gikk dessuten ut av
vedlikehold 30. april 2026. Node 22 er det eneste som treffer.

Ikke bruk «siste LTS» — den merkelappen peker på Node 24 nå. Hent 22-serien
direkte fra [nodejs.org/dist/latest-v22.x](https://nodejs.org/dist/latest-v22.x/)
(`node-v22.x.y-x64.msi` på Windows).

Trenger du flere Node-versjoner side om side, er
[nvm-windows](https://github.com/coreybutler/nvm-windows) enkleste vei:

```powershell
nvm install 22
nvm use 22
```

`engines` i `package.json` er satt til `>=22 <23`, så npm advarer hvis du står
på feil versjon.

**Azure Functions Core Tools v4.** Uten den prøver SWA CLI å laste den ned selv,
noe som ofte feiler bak brannmur.

På Windows er **MSI-en fra GitHub** den mest pålitelige veien. Den går utenom
både npm og winget, og gir nyeste versjon — winget ligger gjerne et par
utgivelser etter:

[github.com/Azure/azure-functions-core-tools/releases](https://github.com/Azure/azure-functions-core-tools/releases)
→ nyeste v4 → **x64 MSI**

Winget virker også, men kan gi en eldre versjon:

```powershell
winget install Microsoft.Azure.FunctionsCoreTools
```

På macOS og Linux:

```bash
npm i -g azure-functions-core-tools@4 --unsafe-perm true
```

> **Bruk 4.14.0 eller nyere.** 4.13.0 kaster
> `Exception has been thrown by the target of an invocation` ved oppstart av
> verten, uansett prosjekt. Winget kan fortsatt tilby 4.13.0, og den globale
> npm-installasjonen er skjør på Windows (`E401`, `EPERM`) — derfor MSI-en.

Sjekk med `func --version` — den skal vise 4.14 eller nyere. Viser den en
eldre 4.x, kan det være en halvferdig npm-installasjon; se
feilsøkingstabellen.

> Å installere en offentlig npm-pakke krever **aldri** innlogging. Får du
> `npm error code E401 … please try logging in`, er det en ugyldig
> tilgangsnøkkel i din egen `.npmrc`, ikke en manglende konto. Se
> feilsøkingstabellen under.

### Oppsett

Fra rota av repoet:

```bash
npm install          # verktøy i rotmappa
npm run installer    # avhengigheter i app/ og api/, og api/local.settings.json
```

Deretter, i to skall:

```bash
npm run dev          # skall 1: Azurite, bygger API-et, starter SWA CLI

# skall 2, første gang. Adressen blir eneste redaktør – bruk din egen.
REDAKTOER_EPOST=din.adresse@domenet.no npm run seed
```

I PowerShell settes miljøvariabelen slik:

```powershell
$env:REDAKTOER_EPOST = "din.adresse@domenet.no"; npm run seed
```

Åpne <http://localhost:4280>. Eksempelårene har den formen materialet deres
faktisk har: tynt før 1950, fire til ti år per tiår etterpå.

**Innloggingen lokalt.** Alt ligger bak innlogging fra trinn 9. Skriv adressen
din, trykk «Send kode» — og hent koden **fra konsollen der API-et kjører**:

```
  [lokal innlogging] engangskode for deg@eksempel.no: 493015
```

Uten `RESEND_NOKKEL` og `EPOST_AVSENDER` sendes ingen e-post, og koden skrives
i loggen i stedet. Det er meningen lokalt. `npm run forbered` har allerede lagt
inn en tilfeldig `SESJON_HEMMELIGHET` og `MILJO=lokalt` i
`api/local.settings.json`.

Merk at rate-limiteren gjelder også lokalt: fem kodebestillinger per adresse per
time. Går du tom under testing, er `npm run clean` (som fjerner `.azurite`) den
enkleste veien videre.

`npm run dev` gjør tre ting med vilje:

- **starter Azurite**, fordi Functions-verten bruker den som lagring. Kjører den
  ikke, feiler `func` med «Exception has been thrown by the target of an
  invocation», som ikke sier noe om årsaken
- **bygger API-et først**, fordi `swa start` ikke gjør det selv, og uten
  `api/dist` finner Functions ingenting å kjøre
- **stopper alt sammen** når du avslutter med Ctrl+C

Vil du styre Azurite selv, finnes `npm run azurite` og `npm run dev:kun-swa`.

### Reservevei uten Functions Core Tools

Får du ikke `func` til å kjøre, stopper ikke utviklingen opp:

```bash
npm run dev:enkel
```

Den starter Azurite, en enkel lokal API-tjener og Vite — ingen Functions Core
Tools, ingen Static Web Apps CLI. Åpne **<http://127.0.0.1:5173>**.

API-tjeneren (`api/lokal-tjener.mjs`) laster de samme handlerne som Functions
ville kjørt, så ruting, validering, sanitering og SAS er identisk — det er den
samme koden. Men den etterligner ikke Functions-vertens oppstart, den har ingen
bindings utover HTTP, og den kjenner ikke SWA-ens rutefil. **Bruk `npm run dev`
når `func` virker.** Denne finnes for at arbeidet skal kunne fortsette imens.

### Hvis noe klikker

Kjør forhåndssjekken først — den går gjennom Node-versjon, `func`, avhengigheter,
`local.settings.json` og porter, og sier hva som er galt:

```bash
npm run sjekk
```

**Vil du se den ekte feilen fra Functions**, kjør `func` alene, med Azurite oppe:

```bash
npm run azurite        # skall 1
cd api && func start --verbose    # skall 2
```

`func start` uten Azurite gir «Exception has been thrown by the target of an
invocation», som ikke sier noe om årsaken. `--verbose` gir resten.


| Symptom | Årsak og fiks |
|---|---|
| `ENOENT … Could not read package.json` | Du står ikke i repo-rota. Klonet du inn i en mappe du laget selv, ligger repoet ett nivå ned. `dir package.json` (Windows) eller `ls package.json` bekrefter |
| `func` spør hvilket språk prosjektet er i (dotnet / Node / Python …) | `api/local.settings.json` mangler eller er tom. Kjør `npm run forbered` |
| «Could not find or install Azure Functions Core Tools» | Ikke installert. Se forutsetningene over |
| `npm error code E401 … Unable to authenticate` | Ugyldig tilgangsnøkkel i din egen `.npmrc`. **Ikke** logg inn — offentlige pakker krever ingen konto. Fjern nøkkelen: `npm config delete //registry.npmjs.org/:_authToken` |
| `EBADENGINE … required: { node: '>=22 <23' }` | Feil Node-versjon. Se forutsetningene over — det må være 22-serien |
| «Found Azure Functions Core Tools v4 which is incompatible with your current Node.js v24» | Node 24 støttes ikke av Azure Functions. Installer Node 22 |
| Node 22-installasjonsprogrammet nekter, «a newer version is already installed» | Windows går ikke bakover. Avinstaller først: `winget uninstall --id OpenJS.NodeJS.LTS` i PowerShell som administrator, eller Innstillinger → Apper. Åpne så et **nytt** skall — PATH oppdateres ikke i vinduer som allerede står åpne |
| `EPERM: operation not permitted, rmdir …\AppData\Roaming\npm\…` | En rest fra en avbrutt global installasjon. Lukk kjørende `func`-prosesser, slett mappa manuelt, og bruk heller winget på Windows |
| «Could not connect to http://localhost:5173» | Frontenden startet ikke. Se etter feilen rett over i loggen |
| `func start` feiler uansett prosjekt | Sjekk om det er `func` eller prosjektet: `cd $env:TEMP; func init proev --worker-runtime node --model V4; cd proev; npm install; func start`. Feiler også det tomme prosjektet, ligger feilen i `func` eller på maskinen |
| Azurite: «Unexpected token … is not valid JSON» | Metadatafilen er skadet etter en avbrutt økt. `npm run clean` sletter lokal emulatorlagring — ingenting i Azure røres — og neste start bygger den på nytt |
| `Exception has been thrown by the target of an invocation` | **Kjent feil i Core Tools 4.13.0.** Verten faller over rett etter «Resolving worker runtime», uansett prosjekt — også et tomt `func init`. Oppgrader til 4.14.0 eller nyere med MSI-en fra GitHub, se forutsetningene over. `npm run sjekk` fanger det. |
| «Azurite svarte ikke på port 10000» | Se hva Azurite selv sier: `npx azurite --location .azurite --skipApiVersionCheck`. Er porten opptatt av noe annet: `netstat -ano \| findstr :10000` på Windows |
| `"localhost" can not be resolved to either IPv4 or IPv6` | Windows slår opp `localhost` til `::1`, der ingenting lytter. Både SWA CLI og Vite er nå bundet til `127.0.0.1` i konfigurasjonen. Får du den likevel, sjekk at `C:\Windows\System32\drivers\etc\hosts` har linja `127.0.0.1 localhost` |
| Azurite svarer ikke | `npm run dev` starter den, og bruker en som allerede kjører hvis den finnes. Kjører du `dev:kun-swa`, må du starte `npm run azurite` selv |

`api/local.settings.json` er gitignorert, siden det er der ekte nøkler havner
den dagen noen legger inn en. Derfor lages den av `npm run installer` fra
`local.settings.json.eksempel` i stedet for å ligge i repoet.

## Kommandoer

| Kommando | Gjør |
|---|---|
| `npm run dev` | Azurite, bygger API-et, og starter SWA CLI — alt i ett |
| `npm run dev:kun-swa` | Samme uten Azurite, hvis du vil styre den selv |
| `npm run dev:enkel` | Reservevei: Azurite + lokal API-tjener + Vite, uten `func` og SWA CLI |
| `npm run seed` | Legger eksempeldata i Azurite |
| `npm run seed:sky` | Samme, men mot Azure (henter nøkkel via `az`) |
| `npm run tom` | Viser hva som ville blitt slettet av innhold i Azurite |
| `npm run tom:sky` | Samme mot Azure. `-- --slett` utfører, `--media` tar med filene |
| `npm run proev -- --tom` | Røykprøve inkludert tømming og gjenoppretting. Sletter alt lokalt |
| `npm run proev` | Røykprøve av API-et mot Azurite |
| `npm run proev:epost` | Prøver e-postutsendingen mot en stubb, uten å sende noe |
| `npm run build` | Bygger `api/` og `app/` |
| `npm run typecheck` | Typesjekker begge uten å bygge |
| `npm run sjekk` | Forhåndssjekk: Node, `func`, avhengigheter, innstillinger, porter |
| `npm run forbered` | Lager `api/local.settings.json`, og fyller inn `SESJON_HEMMELIGHET` og `MILJO` |
| `npm run clean` | Fjerner byggeutdata og lokal lagring |

`npm run proev` skriver og sletter årene 1996–1999 og bygger indeksen på nytt.
Den rydder både før og etter seg, men skal ikke kjøres mot ekte data.

## I Azure

Se [infra/LES-MEG.md](infra/LES-MEG.md). Kort:

**`opprett.sh` er bash og kan ikke kjøres fra PowerShell.** Bruk Git Bash (som
følger med Git for Windows) eller [Azure Cloud Shell](https://shell.azure.com),
der `az` allerede er installert og innlogget:

```bash
az login                 # ikke nødvendig i Cloud Shell
npm install              # seed-skriptet trenger @azure/storage-blob
./infra/opprett.sh
npm run seed:sky -- --redaktoer=din.adresse@domenet.no
```

Skriptet setter `LAGER_TILKOBLING` og `SESJON_HEMMELIGHET` på Static Web App-en
selv. **E-post er det eneste som må settes opp for hånd**: en API-nøkkel fra
[Resend](https://resend.com) i `RESEND_NOKKEL`, og en avsenderadresse i
`EPOST_AVSENDER`. Se [infra/LES-MEG.md](infra/LES-MEG.md). Uten dem kommer ingen
engangskoder fram, og da kan ingen logge inn i drift.

Alt dette gjøres *etter* at ressursene finnes. Lokalt setter du ingenting selv:
`npm run forbered` har allerede skrevet `SESJON_HEMMELIGHET` og `MILJO=lokalt`
inn i `api/local.settings.json`.

## Hva som virker nå

**Trinn 1 — ressurser.** Bicep for lagringskonto, tre containere (`innhold`,
`media`, `originaler`), tabell for engangskoder, versjonering, soft delete og
livssyklusregler. Static Web App på gratisplanen.

**Trinn 2 — stillas.** Vite + React + TypeScript i `app/`, Azure Functions i
`api/`, delte typer i `delt/typer.d.ts`, lokal kjøring mot Azurite.

**Trinn 3 — API.** Femten endepunkter:

| | |
|---|---|
| `GET /api/felter` · `PUT /api/felter` | Feltdefinisjonene |
| `GET /api/indeks` | Forsiden og søket. Bygges automatisk hvis den mangler |
| `GET /api/aar/{aar}` | Årsdokument med kortlevde lese-SAS på media |
| `PUT /api/aar/{aar}` | Lagring med ETag. Uten `If-Match` tillates bare oppretting |
| `DELETE /api/aar/{aar}` | Sletting. Mediefiler blir liggende med vilje |
| `POST /api/media/opplasting` | Skrive-SAS for inntil 60 filer i ett kall |
| `POST /api/vedlikehold/bygg-indeks` | Bygger `indeks.json` fra årsdokumentene |
| `POST /api/vedlikehold/rydd-media` | Sletter mediefiler ingen år viser til |
| `POST /api/vedlikehold/sikkerhetskopi` | Tar en kopi av år, feltskjema og tilgangsliste |
| `GET /api/vedlikehold/sikkerhetskopi` | Listen over kopier |
| `GET /api/vedlikehold/sikkerhetskopi/{id}` | Laster ned én kopi som fil |
| `POST /api/vedlikehold/gjenopprett` | Skriver en kopi tilbake |
| `POST /api/vedlikehold/tom` | Tømmer innholdet. Tørrkjøring uten `bekreft` |
| `POST /api/auth/kode` · `POST /api/auth/verifiser` | Engangskode og innlogging |
| `GET /api/meg` · `POST /api/auth/logg-ut` | Hvem er innlogget, og utlogging |
| `GET /api/tilgang` · `PUT /api/tilgang` | Tilgangslisten |

**Trinn 4 — forsiden.** Årsliste gruppert på tiår, utfolding på stedet,
permalenker på `/aar/1972` som ruller året til syne ved innlasting.

**Trinn 5 — årsside.** Tekstfeltene i skjemaets rekkefølge og mediegalleri med
bilder og video, hentet når raden åpnes.

**Trinn 6 — redigering.** `/rediger/1972` og `/rediger/nytt`. Skjemaet genereres
fra `felter.json`. Rik tekst med fire knapper. Autolagring til `localStorage`
hvert par sekunder, med gjenoppretting. ETag-konflikt håndteres eksplisitt.

**Trinn 7 — masseopplasting.** Slipp mange filer om gangen. Bilder skaleres til
2400 px og får miniatyr i nettleseren, opptaksdato leses fra EXIF og foreslår
årstall. Skrive-SAS for hele bunken i ett kall, tre opplastinger parallelt,
fremdrift per fil, blokkvis over 8 MB. Bildetekstliste med rekkefølge.

**Trinn 8 — søk.** Søkefelt på forsiden som filtrerer årslisten mens du skriver.
Kjøres i nettleseren mot indeksdokumentet, så ingen nettverkskall per tastetrykk.
Prefiks, toleranse for skrivefeil, og både «sørlandet» og «sorlandet». Hvert
treff viser et utdrag rundt treffordet. `/` setter markøren i feltet, Esc tømmer.

**Trinn 10 — video.** Blokkvis opplasting med fremdrift per fil, plakatbilde
hentet automatisk og byttbart for hånd, avspilling med `playsInline` og
`preload="metadata"` mot en lese-SAS, og en advarsel før opplastingen starter når
bitraten tyder på at klippet ikke er transkodet. Se [Video](#video).

**Trinn 11 — mobil, tomtilstander og feilmeldinger.** Skjemafelter er 16 px på
berøringsskjerm, så iOS ikke zoomer inn når de får fokus; tekstlenker og
avkrysningsbokser har treffområde uansett hvor små de ser ut; knapperader
strekkes ut under 420 px. Et år som ikke finnes sier det, både på forsiden og i
redigeringen — sistnevnte ble tidligere stående på «Henter …» for alltid. Et
tomt arkiv snakker til den som skal fylle det, ikke til en utvikler med et
skall. Sikkerhetskopilisten viser de fem siste med en knapp for resten.

**Trinn 9 — innlogging.** Engangskode på e-post, uten Entra og uten
Microsoft-kontoer. Sesjonen ligger i en `httpOnly`-kapsel klienten ikke kan
lese; `krevRolle()` i `api/src/vakt.ts` sjekker den ved hvert kall og slår opp
rollene i `innhold/tilgang.json` hver gang, så en fjernet person mister
tilgangen umiddelbart. Koden er sekssifret, varer i ti minutter, tåler fem
forsøk, og kan bestilles fem ganger per adresse per time. Tilgangslisten
redigeres på `/tilgang` av en redaktør. Dyplenker overlever innlogging: URL-en
står, og siden vises når koden er godtatt.

## Admin-siden

`/admin`, for redaktører. Den gjør det samme som skriptene under `verktoy/`,
men fra nettleseren — nettstedet drives fra en iPad, og et skript som krever et
skall, `npm install` og en tilkoblingsstreng er i praksis en operasjon som ikke
finnes der.

| Seksjon | Gjør |
|---|---|
| Familiemedlemmer | Teller listen og lenker til `/tilgang` |
| Sikkerhetskopi | Tar kopi, viser kopiene, laster ned én som fil, gjenoppretter |
| Ubrukte mediefiler | Tørrkjøring, så sletting — samme som `rydd-media` |
| Tøm innholdet | Bak en luke: tell opp, skriv antallet, slett |

**Sikkerhetskopien dekker år, feltskjema og tilgangsliste.** Mediefilene
kopieres ikke; de listes med sti og størrelse, så en gjenoppretting kan si hva
som mangler. Bildene er beskyttet av versjonering og angrefrist på
lagringskontoen i stedet — en kopi av hele mediemappen per knappetrykk ville
doblet lagringen hver gang. Nedlastingen gir filen utenfor Azure, som på iPad
havner i Filer.

**Tømming og gjenoppretting tar alltid en kopi først**, uten at noen ber om det.
Begge er operasjoner man kan gjøre ved et uhell, og en kopi koster noen kilobyte.
Tømmingen rører aldri `felter.json` eller `tilgang.json` — uten dem ville
nettstedet vært både tomt og låst. Gjenopprettingen rører aldri tilgangslisten:
en gammel liste kan mangle den som står og gjenoppretter, og da er man låst ute
av det eneste stedet listen kan endres.

**Tømming over 800 filer tar flere runder.** Managed functions har en fast
tidsgrense; svaret sier hvor mange som gjenstår, og siden ber om en runde til.

## Video

**Transkode klippene før de lastes opp.** Det er det ene valget i prosjektet der
en feil får varig konsekvens: med ~11 timer ferdig klippet materiale er
forskjellen på råfiler og transkodet 1080p omtrent 2 500 GB mot 30 GB — og en
opplasting som tar kvelden mot en som går unna.

Siden klippingen uansett gjøres for hånd, gjøres transkodingen i samme
operasjon:

```bash
# Klipp ut 00:12:30–00:19:45 og transkode til web-vennlig 1080p
ffmpeg -ss 00:12:30 -to 00:19:45 -i original.mov \
  -vf "scale=-2:1080" -c:v libx264 -preset slow -crf 21 \
  -c:a aac -b:a 128k -movflags +faststart klipp.mp4
```

- `-crf 21` gir god kvalitet for familievideo; `23` er også fullt brukbart og
  mindre
- `-movflags +faststart` er ikke valgfritt — uten den må hele filen lastes ned
  før avspillingen starter
- For digitalisert smalfilm og VHS er kilden uansett lavoppløst: bruk
  `scale=-2:720` og `-crf 22`

HandBrake gjør det samme med et grafisk grensesnitt («Fast 1080p30» er nær nok).

**Appen sier fra hvis den tror du har glemt det.** Før opplastingen starter leses
lengden på klippet, og bitraten regnes ut. Ligger den over 8 Mbit/s, holdes filen
tilbake med tallene og et valg: ta den ut, eller last opp likevel. Det samme skjer
hvis nettleseren ikke klarer å lese filen i det hele tatt — da kan den ikke
spilles av på årssiden heller, og en `.mov` rett fra kameraet er ofte akkurat det.
Grensen for én fil er 2 GB.

**Plakatbildet** hentes automatisk ett sekund inn i klippet. Treffer det dårlig,
kan du spole til et bedre bilde i medielisten og trykke «Bytt plakatbilde» —
året må være lagret først, siden bildet hentes fra videoen slik den ligger i
Blob. Det krever at CORS-reglene på lagringskontoen slipper gjennom `Range`;
`infra/main.bicep` og `verktoy/lager-oppsett.mjs` setter dem.

## Hva som bevisst ikke virker ennå

Fase 1 er ferdig. Det som står igjen er ting fase 2 tar:

- **Kart, tidslinje og slektstre** — egne visninger av det samme innholdet.
- **Kommentarer og bidrag fra familien** — i dag redigerer bare redaktører.

## Om koden

**Ingen database.** Hvert år er ett JSON-dokument i Blob. `indeks.json` er
avledet og bygges om ved hver lagring — den kan slettes når som helst.

**Feltene er data.** `innhold/felter.json` styrer både validering og visning. Et
nytt felt der krever ingen kodeendring.

**Sanitering skjer på serveren.** `api/src/skjema.ts` fjerner all markup utenfor
en bevisst liten tillatelsesliste. Fra trinn 9 er dette den bærende
sikkerhetskontrollen, siden årssidene lagrer HTML som vises for andre.

**Filnavn fra klienten brukes aldri.** Opplasting får en ULID-basert sti, så
spørsmål om æøå, mellomrom og katalogseparatorer i filnavn oppstår ikke.

**Autorisasjon er kode, ikke konfigurasjon.** Fordi innloggingen blir vår egen,
kan ikke `staticwebapp.config.json` beskytte noe. Hvert endepunkt kaller
`krevRolle()` først — se [§9.2](docs/omfang-og-arkitektur.md#92-det-ene-som-endrer-seg-strukturelt).
