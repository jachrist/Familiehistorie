# Kom i gang

Status: **fase 1, trinn 1–4** av [faseplanen](docs/omfang-og-arkitektur.md#14-faseplan).

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

På Windows er winget den enkleste veien — den henter et ferdig installasjonsprogram
og går utenom npm:

```powershell
winget install Microsoft.Azure.FunctionsCoreTools
```

På macOS og Linux:

```bash
npm i -g azure-functions-core-tools@4 --unsafe-perm true
```

Sjekk med `func --version` — den skal vise 4.x.

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
npm run seed         # skall 2: felter.json + 36 eksempelår (første gang)
```

Åpne <http://localhost:4280>. Eksempelårene har den formen materialet deres
faktisk har: tynt før 1950, fire til ti år per tiår etterpå.

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
| `Exception has been thrown by the target of an invocation` | Kommer fra `func`, ikke fra SWA CLI. Nesten alltid at Azurite ikke kjører. `npm run dev` starter den nå selv. For den ekte feilmeldingen: `cd api` og `func start` |
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
| `npm run proev` | Røykprøve av API-et mot Azurite |
| `npm run build` | Bygger `api/` og `app/` |
| `npm run typecheck` | Typesjekker begge uten å bygge |
| `npm run sjekk` | Forhåndssjekk: Node, `func`, avhengigheter, innstillinger, porter |
| `npm run forbered` | Lager `api/local.settings.json` hvis den mangler |
| `npm run clean` | Fjerner byggeutdata og lokal lagring |

`npm run proev` skriver og sletter årene 1996–1999 og bygger indeksen på nytt.
Den rydder både før og etter seg, men skal ikke kjøres mot ekte data.

## I Azure

Se [infra/LES-MEG.md](infra/LES-MEG.md). Kort:

```bash
az login
./infra/opprett.sh
npm run seed:sky
```

## Hva som virker nå

**Trinn 1 — ressurser.** Bicep for lagringskonto, tre containere (`innhold`,
`media`, `originaler`), tabell for engangskoder, versjonering, soft delete og
livssyklusregler. Static Web App på gratisplanen.

**Trinn 2 — stillas.** Vite + React + TypeScript i `app/`, Azure Functions i
`api/`, delte typer i `delt/typer.d.ts`, lokal kjøring mot Azurite.

**Trinn 3 — API.** Åtte endepunkter:

| | |
|---|---|
| `GET /api/felter` · `PUT /api/felter` | Feltdefinisjonene |
| `GET /api/indeks` | Forsiden og søket. Bygges automatisk hvis den mangler |
| `GET /api/aar/{aar}` | Årsdokument med kortlevde lese-SAS på media |
| `PUT /api/aar/{aar}` | Lagring med ETag. Uten `If-Match` tillates bare oppretting |
| `DELETE /api/aar/{aar}` | Sletting. Mediefiler blir liggende med vilje |
| `POST /api/media/opplasting` | Skrive-SAS for inntil 60 filer i ett kall |
| `POST /api/vedlikehold/bygg-indeks` | Bygger `indeks.json` fra årsdokumentene |

**Trinn 4 — forsiden.** Årsliste gruppert på tiår, utfolding på stedet,
permalenker på `/aar/1972` som ruller året til syne ved innlasting.

## Hva som bevisst ikke virker ennå

- **Feltinnhold og mediegalleri** på årssiden — trinn 5. Utfoldingen viser
  inntil videre ingressen fra indeksdokumentet.
- **Redigering** — trinn 6 og 7. API-et tar imot skriving, men det finnes ingen
  GUI for det.
- **Søk** — trinn 8. Indeksdokumentet inneholder allerede den søkbare teksten.
- **Innlogging** — trinn 9. `api/src/vakt.ts` har formen på plass og slipper alt
  gjennom; konstanten `INNLOGGING_MANGLER` markerer stedet.

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
