# Familiehistorie Christiansen — omfang og implementering

Forslag til avgrensing, informasjonsmodell og teknisk løsning, basert på idéen i
[README.md](../README.md). Dokumentet er et beslutningsgrunnlag: det peker på valgene
som må tas før koding, og foreslår et svar på hvert av dem.

---

## 1. Sammendrag

Et privat nettsted der familien Christiansen dokumenterer historien sin år for år.
Forsiden er en liste over årstall som kan foldes ut. Hvert år er en side med faste
tekstfelter, bilder og videoklipp. Innloggede redaktører legger til og endrer innhold
direkte i nettleseren. Et søkefelt filtrerer årslisten ned til de årene som har treff.

Teknisk: Azure Static Web Apps (React-frontend) + Azure Functions (API) +
Azure Blob Storage (både innhold og media). Ingen database — hvert år lagres som ett
JSON-dokument i Blob, med et lite indeksdokument som driver forside og søk.

**Estimert innsats til produksjonsklar MVP: ca. 5–8 arbeidsdager.**
**Estimert driftskostnad: ca. 0–15 USD/mnd** (se [§13](#kostnad)).

---

## 2. Avgrensing

### Med i første versjon (MVP)

| # | Funksjon |
|---|---|
| F1 | Forside med alle årssider lukket — kun årstall synlig, nyeste eller eldste først |
| F2 | Utfolding av et år direkte på forsiden, og egen permalenke `/aar/1972` |
| F3 | Årsside med faste tekstfelter (se [§4](#4-informasjonsmodell)) |
| F4 | Bilder på årssider, med bildetekst og rekkefølge |
| F5 | Videoklipp på årssider, med plakatbilde |
| F6 | Redigerings-GUI: opprett år, rediger felter, last opp/slett media, endre rekkefølge |
| F7 | Fritekstsøk over alle tekster; treff filtrerer årslisten |
| F8 | Innlogging; lesetilgang og skrivetilgang styrt av rolle |
| F9 | Mobilvennlig visning (mesteparten av lesingen skjer på telefon) |

### Utenfor første versjon

Bevisst utsatt for å holde MVP-en liten — alle er lette å legge til senere fordi
datamodellen allerede har plass til dem:

- Tidslinjevisning og «på denne dagen»-funksjon
- Persontagging av bilder og personregister med egne personsider
- Kommentarer eller bidrag fra familiemedlemmer uten redaktørrolle
- Eksport til PDF/trykk-klar bok
- Flere språk
- Automatisk ansiktsgjenkjenning eller AI-generert bildetekst
- Versjonshistorikk med visuell diff (blob-versjonering gir likevel angrerett, se [§13](#sikkerhetskopi))

### Åpne spørsmål som bør avklares før koding

1. **Skal siden være helt privat?** Se [§9](#9-autentisering-og-personvern) — anbefalingen er ja, og det påvirker mediehåndteringen.
2. **Hvor mange år og hvor mye media?** Anslag på antall år og totalt GB video avgjør om §8-søket og §11-mediehåndteringen holder.
3. **Hvem skal kunne redigere?** Én person, eller flere søsken/generasjoner samtidig?
4. **Finnes eksisterende materiale** (scannede album, videokassetter, tekstdokumenter) som skal importeres i bulk? I så fall bør et importskript inn i fase 2.

---

## 3. Brukerhistorier

**Som leser i familien vil jeg**
- se alle år på én skjerm, slik at jeg raskt finner det jeg leter etter
- åpne et år og lese hva som skjedde, med bildene i sammenheng med teksten
- søke på «Bergen» eller «bestefar» og se hvilke år som nevner det
- dele en lenke til et bestemt år med søskenbarn

**Som redaktør vil jeg**
- opprette et nytt år uten å redigere kode eller filer
- fylle ut de samme feltene hvert år, så sidene blir like
- dra og slippe bilder rett inn fra telefonen eller mappa
- se hvordan siden blir seende ut mens jeg skriver
- ikke miste arbeid hvis nettet faller ut midt i redigeringen

---

## 4. Informasjonsmodell

### 4.1 Faste felter — skjemadrevet

README-en sier «faste felter». Løsningen gjør de faste feltene til **data, ikke kode**:
én skjemafil beskriver feltene, og både redigeringsskjemaet og visningen genereres
fra den. Da kan et nytt felt legges til senere uten at hverken frontend eller API må endres.

`felter.json` (lagres i Blob, versjoneres i repoet som utgangspunkt):

```json
{
  "versjon": 1,
  "felter": [
    { "id": "tittel",       "etikett": "Overskrift for året", "type": "kort_tekst", "paakrevd": true },
    { "id": "sammendrag",   "etikett": "Ingress",             "type": "kort_tekst", "hjelp": "Vises i søketreff og på forsiden" },
    { "id": "hendelser",    "etikett": "Hva skjedde",         "type": "rik_tekst",  "paakrevd": true },
    { "id": "familien",     "etikett": "Familien",            "type": "rik_tekst",  "hjelp": "Fødsler, bryllup, dødsfall, flyttinger" },
    { "id": "hjem",         "etikett": "Hjem og hverdag",     "type": "rik_tekst" },
    { "id": "arbeidSkole",  "etikett": "Arbeid og skole",     "type": "rik_tekst" },
    { "id": "reiser",       "etikett": "Reiser",              "type": "rik_tekst" },
    { "id": "verdenRundt",  "etikett": "Verden rundt oss",    "type": "rik_tekst",  "hjelp": "Kontekst: hva preget året ellers" }
  ]
}
```

Feltlisten over er et forslag — den bør justeres etter hva familien faktisk vil skrive om.

### 4.2 Årsdokument

Ett JSON-dokument per år, lagret som `innhold/aar/1972.json`:

```jsonc
{
  "aar": 1972,
  "felter": {
    "tittel": "Flyttingen til Bergen",
    "sammendrag": "Året vi pakket ned huset på Hamar …",
    "hendelser": "<p>…</p>",
    "familien": "<p>…</p>"
  },
  "media": [
    {
      "id": "01HQ…",              // ULID, gir sortering og unikhet
      "type": "bilde",            // "bilde" | "video"
      "fil": "media/1972/01HQ….jpg",
      "miniatyr": "media/1972/01HQ….thumb.jpg",
      "plakat": null,             // brukes av video
      "bildetekst": "Første dag i den nye leiligheten",
      "tatt": "1972-08-14",       // valgfri, ISO-dato
      "bredde": 3024,
      "hoyde": 4032,
      "rekkefolge": 10
    }
  ],
  "status": "publisert",          // "utkast" | "publisert"
  "opprettet": "2026-08-29T09:12:00Z",
  "endret": "2026-08-29T09:40:11Z",
  "endretAv": "jachrist@…",
  "skjemaversjon": 1
}
```

Fordelen med ett dokument per år: hele årssiden hentes i ett kall, redigering er én
atomisk skriving, og et år kan sikkerhetskopieres eller gjenopprettes for seg.

### 4.3 Indeksdokument

`innhold/indeks.json` inneholder alt forsiden og søket trenger, slik at forsiden gjør
**ett** nettverkskall:

```jsonc
{
  "generert": "2026-08-29T09:40:12Z",
  "aar": [
    {
      "aar": 1972,
      "tittel": "Flyttingen til Bergen",
      "sammendrag": "Året vi pakket ned huset på Hamar …",
      "antallBilder": 14,
      "antallVideoer": 1,
      "sok": "flyttingen til bergen året vi pakket ned huset på hamar …"  // all tekst, flatet ut og normalisert
    }
  ]
}
```

Indeksen bygges om av API-et hver gang et år lagres. Den er avledet data — kan alltid
gjenskapes fra årsdokumentene, og et eget `POST /api/vedlikehold/bygg-indeks` gjør nettopp det.

---

## 5. Arkitektur

```
                    ┌─────────────────────────────────────────────┐
   Nettleser        │            Azure Static Web Apps            │
  ┌──────────┐      │                                             │
  │  React   │◄─────┤  Statisk frontend (Vite-bygg)               │
  │  (SPA)   │      │  staticwebapp.config.json: ruter + roller   │
  └────┬─────┘      │                                             │
       │ /api/*     │  ┌───────────────────────────────────────┐  │
       ├───────────►│  │ Managed Functions (Node/TypeScript)   │  │
       │            │  │  aar · media · sok-indeks · sas       │  │
       │            │  └──────────────┬────────────────────────┘  │
       │            │                 │ Managed Identity          │
       │            └─────────────────┼───────────────────────────┘
       │                              ▼
       │                  ┌───────────────────────┐
       │                  │  Azure Blob Storage   │
       │                  │  ├─ innhold/  (JSON)  │
       └─────────────────►│  └─ media/    (filer) │
         SAS-URL, direkte │                       │
         opp- og nedlast  └───────────────────────┘
```

**Hvorfor denne formen:**

- **Ingen database.** Datamengden er liten (titalls dokumenter, noen hundre kB tekst)
  og skrivefrekvensen er nær null. Blob dekker behovet, koster nesten ingenting, og
  innholdet er lesbart og flyttbart som ren JSON.
- **Direkte opp- og nedlasting av media** går utenom API-et, via kortlevde SAS-URL-er.
  Det er nødvendig for video: SWA-ens managed functions har både størrelses- og
  tidsbegrensninger på forespørsler, og videostrømming trenger range-requests.
- **Managed Identity** fra Function-laget mot Blob gjør at ingen lagringsnøkkel
  ligger i konfigurasjon eller kode.

---

## 6. Lagringsoppsett i Blob

Én lagringskonto, to containere — **begge private**:

```
innhold/                    (private)
  felter.json               feltdefinisjonene fra §4.1
  indeks.json               forside + søkeindeks
  aar/1972.json
  aar/1973.json
  …

media/                      (private)
  1972/01HQ….jpg            original (nedskalert i nettleseren før opplasting)
  1972/01HQ….thumb.jpg      miniatyr, ca. 400 px
  1972/01HR….mp4
  1972/01HR….poster.jpg
```

**Anbefalte innstillinger på lagringskontoen:**

- **Blob-versjonering på** — gir angrerett på feilredigering og sletting uten at det må bygges versjonshistorikk i appen.
- **Soft delete, 30 dager** — for både blob og container.
- **Livssyklusregel**: flytt tidligere versjoner til Cool etter 30 dager.
- **Ingen anonym lesetilgang** på kontoen.
- Redundans **LRS** holder når blob-versjonering og en separat kopi (§13) er på plass; GRS hvis materialet oppleves som uerstattelig.

---

## 7. API-kontrakt

Alle endepunkter under `/api`. Skriveoperasjoner krever rollen `redaktoer`.

| Metode | Rute | Rolle | Beskrivelse |
|---|---|---|---|
| `GET` | `/api/indeks` | leser | Hele indeksdokumentet — driver forside og søk |
| `GET` | `/api/felter` | leser | Feltdefinisjonene |
| `GET` | `/api/aar/{aar}` | leser | Ett årsdokument, med lese-SAS på hvert medieobjekt |
| `PUT` | `/api/aar/{aar}` | redaktør | Opprett/oppdater. `If-Match: <etag>` for optimistisk låsing |
| `DELETE` | `/api/aar/{aar}` | redaktør | Slett år (blob-versjonering gjør det angrbart) |
| `POST` | `/api/media/opplasting` | redaktør | Tar filnavn + MIME-type, returnerer skrive-SAS (15 min) og endelig blobsti |
| `DELETE` | `/api/media/{aar}/{id}` | redaktør | Slett mediefil og alle avledede filer |
| `POST` | `/api/vedlikehold/bygg-indeks` | redaktør | Bygg `indeks.json` på nytt fra alle årsdokumenter |

**Samtidighet.** `GET /api/aar/{aar}` returnerer blobens ETag. `PUT` sender den tilbake
i `If-Match`; hvis noen andre har lagret i mellomtiden svarer API-et `412` og klienten
viser «Året er endret av en annen — last inn på nytt». Enkelt, og nok for en familie.

**Validering.** API-et validerer årsdokumentet mot `felter.json` (Zod-skjema generert fra
feltdefinisjonene) og saniterer rik tekst server-side før lagring — sanitering kun i
nettleseren er ikke en sikkerhetskontroll.

---

## 8. Søk

Kravet er beskjedent — «bare årstall med match vises» — og datamengden er liten.

**Valgt løsning: søk i nettleseren.** Forsiden har allerede lastet `indeks.json`, som
inneholder all søkbar tekst. Søket kjøres lokalt med
[MiniSearch](https://github.com/lucaong/minisearch) (~10 kB gzip):

- prefiksmatch, så «berg» treffer «Bergen»
- innebygd fuzzy-toleranse for skrivefeil
- norsk normalisering: småbokstaver, men **æ/ø/å beholdes** — de skal ikke strippes til ae/oe/aa
- treff rangeres, og år uten treff skjules med en myk animasjon
- resultatet viser hvilket felt treffet kom fra, med utheving i konteksten

**Skalering.** Ved 100 år à 4 kB tekst er indeksen ~400 kB — helt uproblematisk å laste.
Skulle materialet vokse forbi ~2 MB, byttes det til en forhåndsbygd invertert indeks som
lastes i biter, eller til Azure AI Search. Ingen av delene krever at datamodellen endres.

---

## 9. Autentisering og personvern

### Anbefaling: hele nettstedet bak innlogging

Innholdet er bilder og fortellinger om levende familiemedlemmer. Et åpent nettsted blir
indeksert av søkemotorer og arkivert av Wayback Machine — praktisk talt umulig å
angre. Anbefalingen er derfor at **også lesing krever innlogging**, ikke bare redigering.
Det koster ingenting ekstra og er én linje i konfigurasjonen.

`staticwebapp.config.json`:

```jsonc
{
  "routes": [
    { "route": "/api/aar/*",          "methods": ["PUT", "DELETE"], "allowedRoles": ["redaktoer"] },
    { "route": "/api/media/*",        "methods": ["POST", "DELETE"], "allowedRoles": ["redaktoer"] },
    { "route": "/api/vedlikehold/*",  "allowedRoles": ["redaktoer"] },
    { "route": "/rediger/*",          "allowedRoles": ["redaktoer"] },
    { "route": "/*",                  "allowedRoles": ["familie"] }
  ],
  "responseOverrides": { "401": { "statusCode": 302, "redirect": "/.auth/login/aad" } },
  "navigationFallback": { "rewrite": "/index.html", "exclude": ["/media/*", "*.{css,js,png,jpg,mp4}"] }
}
```

**Roller:** `familie` (lese) og `redaktoer` (skrive). Begge tildeles via SWA-ens
invitasjonsmekanisme — inntil 25 brukere, som holder godt for en familie.

**Identitetsleverandør:** Microsoft Entra ID og GitHub er forhåndskonfigurert og virker
på gratisplanen. Google eller Apple krever egen app-registrering (custom auth), som
igjen krever Standard-planen. *Dette bør verifiseres mot gjeldende Azure-dokumentasjon
før planvalg — betingelsene har endret seg over tid.*

### Personvern og praktiske hensyn

- **Media må også være beskyttet.** En privat side hjelper lite hvis bilde-URL-ene er
  åpne. Derfor private containere og kortlevde lese-SAS (30–60 min) utstedt sammen med
  årsdokumentet.
- **Avtale i familien** om hva som deles: bilder av barn, helseopplysninger, konflikter,
  personer som er gått bort. Verdt en samtale før innholdet fylles på, ikke etter.
- **Rett til å bli glemt.** GDPR gjelder i praksis ikke rent private, husholdningsinterne
  formål, men et enkelt løfte om at «sier du ifra, tar vi det ut» er både billig og riktig.
  Datamodellen gjør det lett: bilder ligger som identifiserbare objekter i årsdokumentet.
- **Eksportvei ut.** Alt innhold er JSON + filer i Blob. Et lite skript kan når som helst
  laste ned hele historikken. Ingen innelåsing.

---

## 10. Frontend

**Stack:** React 18 + TypeScript + Vite. Ruting med React Router, serverstatus med
TanStack Query (cache, gjenforsøk, optimistisk oppdatering). Styling med CSS-moduler eller
Tailwind — smakssak, ikke arkitektur.

### Sider

| Rute | Innhold |
|---|---|
| `/` | Årsliste, alle lukket. Søkefelt øverst. Klikk folder ut året på stedet |
| `/aar/:aar` | Samme årsside som permalenke — for deling og dyplenking |
| `/rediger/:aar` | Redigeringsskjema, generert fra `felter.json` |
| `/rediger/nytt` | Opprett år: velg årstall, resten som over |

### Forsiden

Trekkspill der hver rad viser årstallet stort, og tittel/ingress lavmælt ved siden av.
Utfolding skjer på stedet uten sidebytte, men oppdaterer URL-en til `/aar/1972` slik at
tilbakeknappen og deling virker som forventet. Ved søk animeres radene uten treff bort,
og treffordet utheves.

### Redigeringsskjemaet

- Genereres fra `felter.json` — nytt felt i skjemaet gir nytt felt i GUI-et automatisk
- Rik tekst med en bevisst *liten* verktøylinje: fet, kursiv, lenke, punktliste. Ikke mer
- **Autolagring til `localStorage`** hvert par sekunder, med gjenoppretting hvis fanen lukkes
  eller nettet faller ut — dette er den vanligste måten å miste arbeid på
- Dra-og-slipp av bilder rett inn i skjemaet, med opplastingsstatus per fil
- Rekkefølge på media endres ved dra-og-slipp
- Forhåndsvisning som viser den ferdige årssiden ved siden av eller under skjemaet

---

## 11. Mediehåndtering

### Bilder

1. Nettleseren nedskalerer til maks 2400 px lang side og komprimerer til JPEG/WebP før
   opplasting (`canvas` + `toBlob`). Et 12 MB mobilbilde blir typisk 400–700 kB.
2. Samtidig lages en miniatyr på ~400 px.
3. Begge lastes opp direkte til Blob med skrive-SAS fra `POST /api/media/opplasting`.
4. Klienten legger medieobjektet inn i årsdokumentet og gjør `PUT /api/aar/{aar}`.

Nedskalering i nettleseren i stedet for en blob-utløst funksjon holder MVP-en enklere,
sparer båndbredde begge veier, og gir umiddelbar forhåndsvisning. Ulempen er at
originalen i full oppløsning ikke tas vare på — **hvis originalene skal bevares, bør
den fulle filen lastes opp i tillegg og legges rett i Archive-nivået**, hvor lagring
koster nesten ingenting.

### Video

- Lastes opp som den er, direkte til Blob med SAS (`PutBlock`/blokkvis opplasting med
  fremdriftsindikator — nødvendig for filer over noen titalls MB)
- Plakatbilde hentes fra første bildefelt i nettleseren, eller velges manuelt
- Avspilling med vanlig `<video>` mot en lese-SAS-URL. Blob støtter range-requests, så
  spoling virker
- Anbefalt tak i MVP: **500 MB per fil**, med en tydelig beskjed om at lengre opptak bør
  klippes ned. Transkoding til flere oppløsninger er en fase 3-oppgave (Azure Media
  Services er avviklet; alternativet er ffmpeg i en container-jobb ved behov)

---

## 12. Repostruktur

```
Familiehistorie/
├─ README.md
├─ docs/
│  └─ omfang-og-arkitektur.md          ← dette dokumentet
├─ app/                                 Vite + React + TypeScript
│  ├─ src/
│  │  ├─ sider/            Forside, Aarsside, RedigerAar
│  │  ├─ komponenter/      AarRad, Sokefelt, Mediegalleri, Feltskjema
│  │  ├─ api/              typet klient mot /api
│  │  └─ sok/              MiniSearch-oppsett og normalisering
│  └─ index.html
├─ api/                                 Azure Functions, TypeScript
│  ├─ src/funksjoner/      aar.ts, media.ts, indeks.ts, felter.ts
│  ├─ src/blob.ts          Blob-klient med Managed Identity
│  └─ src/skjema.ts        Zod-validering + sanitering
├─ delt/                                Typer delt mellom app og api
│  └─ typer.ts
├─ staticwebapp.config.json
├─ swa-cli.config.json                  lokal kjøring med SWA CLI
└─ .github/workflows/azure-static-web-apps.yml
```

`delt/typer.ts` gir én definisjon av årsdokumentet som både frontend og API bygger mot —
en av de største gevinstene ved TypeScript på begge sider.

---

## 13. Drift

### CI/CD

GitHub Actions-arbeidsflyten som Azure genererer ved opprettelse av SWA-ressursen bygger
`app/` og `api/` og deployer ved push til `main`. Pull requests får automatisk et
midlertidig forhåndsvisningsmiljø — nyttig for å se en endring før den går live.

### Miljøer

Ett produksjonsmiljø holder. Lokal utvikling kjøres med **SWA CLI** (`swa start`), som
etterligner ruting, autentisering og roller lokalt, mot **Azurite** som lokal Blob-emulator.
Da trengs ingen Azure-ressurser for å utvikle.

### Sikkerhetskopi

Blob-versjonering og soft delete dekker uhell. I tillegg anbefales en **kopi utenfor Azure**:
en planlagt jobb (GitHub Actions, ukentlig) som kjører `azcopy sync` av begge containere til
en ekstern disk eller en annen skytjeneste. Familiehistorie er den typen data der man
oppdager tapet altfor sent.

### Overvåking

Application Insights er innebygd i SWA. For et nettsted som dette holder det med en
varsling på feilrate i API-et.

### Kostnad

*Anslag i USD/mnd, bør verifiseres mot gjeldende prisliste:*

| Post | Gratisplan | Standardplan |
|---|---|---|
| Static Web Apps | 0 | ~9 |
| Blob Storage, 50 GB Hot | ~1 | ~1 |
| Båndbredde | inkludert | inkludert |
| Application Insights | ~0 (under gratiskvote) | ~0 |
| **Sum** | **~1** | **~10** |

Gratisplanen holder hvis Entra ID eller GitHub aksepteres som innlogging. Standardplanen
trengs først hvis familien vil logge inn med Google/Apple, eller hvis grensen på 25
inviterte brukere blir for trang.

Video dominerer lagringskostnaden. 100 GB video i Hot-nivået er ~2 USD/mnd; flyttes eldre
klipp til Cool blir det ~1 USD. Ingen av tallene er avgjørende for prosjektet.

---

## 14. Faseplan

### Fase 1 — MVP (ca. 5–8 dager)

| Trinn | Innhold |
|---|---|
| 1 | Azure-ressurser: SWA, lagringskonto, containere, Managed Identity, rolletildeling |
| 2 | Repostillas: Vite-app, Functions-prosjekt, delte typer, SWA CLI + Azurite lokalt |
| 3 | API: `felter`, `aar` (GET/PUT/DELETE med ETag), `indeks`, `media/opplasting` |
| 4 | Forside: årsliste, utfolding, permalenker |
| 5 | Årsside: rendering av felter og mediegalleri |
| 6 | Redigering: skjemagenerering, autolagring, bildeopplasting med nedskalering |
| 7 | Søk med MiniSearch og filtrering av årslisten |
| 8 | Autentisering, roller, ruteregler, private media-SAS |
| 9 | Video: blokkvis opplasting, plakatbilde, avspilling |
| 10 | Mobiltilpasning, tomtilstander, feilmeldinger på norsk, sikkerhetskopijobb |

Rekkefølgen er valgt slik at det finnes noe kjørbart å se på fra og med trinn 4.

### Fase 2 — bruksforbedringer

- Utkast før publisering
- Bulkimport av eksisterende bilder og tekst
- Miniatyrer generert server-side (blob-utløst funksjon), for å slippe kravene til nettleseren
- Bedre bildevisning: lysbokse med sveiping, tastaturnavigasjon, EXIF-dato lest automatisk
- Tidslinjevisning på tvers av år

### Fase 3 — utvidelser

- Personregister med tagging av personer i bilder og egne personsider
- Kommentarer og minner fra familiemedlemmer uten redaktørrolle
- Eksport til PDF eller trykk-klar bok
- Videotranskoding til flere oppløsninger

---

## 15. Risiko

| Risiko | Konsekvens | Håndtering |
|---|---|---|
| Innhold lekker offentlig | Alvorlig og lite reverserbart | Innlogging også for lesing, private containere, kortlevde SAS ([§9](#9-autentisering-og-personvern)) |
| Store videofiler gir treg eller feilende opplasting | Redaktør gir opp | Direkte blokkvis opplasting til Blob, fremdriftsindikator, tydelig størrelsestak |
| Tapt arbeid ved redigering | Frustrasjon, mindre innhold | Autolagring til `localStorage`, ETag-konflikt håndtert eksplisitt |
| Prosjektet stopper opp etter MVP | Tomt nettsted | Fase 1 leverer et fullt brukbart nettsted; fase 2 og 3 er rene tillegg |
| Innelåsing i Azure | Vanskelig å flytte | Alt innhold er JSON + filer; ingen proprietær datamodell |
| Data går tapt | Uerstattelig | Blob-versjonering, soft delete, ukentlig kopi utenfor Azure ([§13](#sikkerhetskopi)) |

---

## 16. Neste steg

1. Gå gjennom feltlisten i [§4.1](#41-faste-felter--skjemadrevet) og juster den til det familien faktisk vil skrive om.
2. Ta stilling til privat vs. offentlig ([§9](#9-autentisering-og-personvern)) — det avgjør planvalg og mediehåndtering.
3. Svar på de åpne spørsmålene i [§2](#åpne-spørsmål-som-bør-avklares-før-koding).
4. Opprett Azure-ressursene og la Azure generere GitHub Actions-arbeidsflyten.
5. Start på fase 1, trinn 1–4, og se på resultatet før resten planlegges i detalj.
