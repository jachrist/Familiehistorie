# Kom i gang

Status: **fase 1, trinn 1–4** av [faseplanen](docs/omfang-og-arkitektur.md#14-faseplan).

> **Nettstedet har ingen innlogging ennå.** Den kommer i trinn 9. Alt som legges
> inn før den er på plass, er lesbart for enhver som finner adressen. Ikke last
> opp ekte familiebilder ennå.

## Lokalt

Krever Node 22 og [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local).

```bash
npm install          # verktøy i rotmappa
npm run installer    # avhengigheter i app/ og api/
```

Deretter, i tre skall:

```bash
npm run azurite      # lokal Blob- og Table-emulator
npm run seed         # felter.json + 36 eksempelår
npm run dev          # SWA CLI på http://localhost:4280
```

Åpne <http://localhost:4280>. Eksempelårene har den formen materialet deres
faktisk har: tynt før 1950, fire til ti år per tiår etterpå.

## Kommandoer

| Kommando | Gjør |
|---|---|
| `npm run dev` | SWA CLI: frontend, API og ruting samlet |
| `npm run seed` | Legger eksempeldata i Azurite |
| `npm run seed:sky` | Samme, men mot Azure (henter nøkkel via `az`) |
| `npm run proev` | Røykprøve av API-et mot Azurite |
| `npm run build` | Bygger `api/` og `app/` |
| `npm run typecheck` | Typesjekker begge uten å bygge |
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
