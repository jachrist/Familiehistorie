# Familiehistorie Christiansen — omfang og implementering

Forslag til avgrensing, informasjonsmodell og teknisk løsning, basert på idéen i
[README.md](../README.md). Dokumentet er et beslutningsgrunnlag: det peker på valgene
som må tas før koding, og foreslår et svar på hvert av dem.

*Oppdatert august 2026 med svar på de fire åpne spørsmålene ([§2](#2-avgrensing)).*

---

## 1. Sammendrag

Et privat nettsted der familien Christiansen dokumenterer historien sin år for år.
Forsiden er en liste over årstall som kan foldes ut. Hvert år er en side med faste
tekstfelter, bilder og videoklipp. Én redaktør legger til og endrer innhold direkte i
nettleseren. Et søkefelt filtrerer årslisten ned til de årene som har treff.

Teknisk: Azure Static Web Apps (React-frontend) + Azure Functions (API) +
Azure Blob Storage (både innhold og media). Ingen database — hvert år lagres som ett
JSON-dokument i Blob, med et lite indeksdokument som driver forside og søk.

**Estimert innsats til produksjonsklar MVP: ca. 7–10 arbeidsdager.**
**Estimert driftskostnad: ca. 1 USD/mnd** på gratisplanen (se [§13](#kostnad)).

Innlogging skjer med **engangskode på e-post**, etter samme mønster som deres øvrige
løsninger. Det fjerner både tenant-, lisens- og plandiskusjonen ([§9](#9-autentisering-og-personvern)).

Dimensjoneringen er nå kjent: rundt 90 årssider, ~11 timer ferdig klippet video og
~2 000–2 500 bilder. Det er godt innenfor det arkitekturen over tåler — med ett unntak
som må håndteres bevisst: **video må transkodes før opplasting**, ellers vokser
lagringen fra 30 GB til over 2 TB ([§11](#11-bilder-og-video)).

---

## 2. Avgrensing

### Med i første versjon (MVP)

| # | Funksjon |
|---|---|
| F1 | Forside med alle årssider lukket — kun årstall synlig, gruppert på tiår |
| F2 | Utfolding av et år direkte på forsiden, og egen permalenke `/aar/1972` |
| F3 | Årsside med faste tekstfelter (se [§4](#4-informasjonsmodell)) |
| F4 | Bilder på årssider, med bildetekst og rekkefølge |
| F5 | Videoklipp på årssider, med plakatbilde |
| F6 | Redigerings-GUI: opprett år, rediger felter, last opp/slett media, endre rekkefølge |
| F7 | **Masseopplasting per år**: slipp 30 filer samtidig, skriv bildetekster etterpå |
| F8 | **EXIF-dato leses automatisk** og foreslår årstall og opptaksdato |
| F9 | Fritekstsøk over alle tekster; treff filtrerer årslisten |
| F10 | Innlogging med engangskode på e-post; roller fra tilgangsliste |
| F11 | Mobilvennlig visning (mesteparten av lesingen skjer på telefon) |

F7 og F8 er flyttet inn fra fase 2 etter at volumet ble kjent — se
[«Import»](#import-gjøres-fra-årssidene) nedenfor.

### Utenfor første versjon

- Tidslinjevisning og «på denne dagen»-funksjon
- Persontagging av bilder og personregister med egne personsider
- Kommentarer eller bidrag fra familiemedlemmer uten redaktørrolle
- Eksport til PDF/trykk-klar bok
- Flere språk, automatisk ansiktsgjenkjenning, AI-generert bildetekst
- Versjonshistorikk med visuell diff (blob-versjonering gir likevel angrerett, se [§13](#sikkerhetskopi))

### Avklart

De fire spørsmålene fra første utgave av dokumentet er nå besvart:

| Spørsmål | Svar | Konsekvens |
|---|---|---|
| Helt privat? | **Ja** | Alt innhold bak innlogging, med **engangskode på e-post** etter husets mønster — se [§9](#9-autentisering-og-personvern) |
| Omfang? | **~160 års spenn, ~90 årssider, 5–10 min video per år** | Se dimensjoneringen under |
| Hvem redigerer? | **Én person i første omgang** | Forenkler roller, utkast og samtidighet — se under |
| Import? | **Alt klippes og lastes inn manuelt, per år** | Ikke behov for importskript; i stedet masseopplasting i redigerings-GUI-et |

### Dimensjonering

Spennet er fire generasjoner, rundt 160 år. Få år fram til ca. 1950, deretter 4–10 år per tiår.

| Størrelse | Anslag | Vurdering |
|---|---|---|
| Årssider | 45–95, planlegg for **~90** | Uproblematisk. Krever tiårsgruppering på forsiden |
| Søkbar tekst | ~90 × 4 kB = **~360 kB** | Godt innenfor søk i nettleseren. Ingen endring nødvendig |
| Video, ferdig klippet | ~90 × 7,5 min = **~11 timer** | Se advarselen om transkoding under |
| Video, lagret 1080p/6 Mbit/s | **~30 GB** | Trivielt å lagre, ~0,60 USD/mnd |
| Video, lagret som råfiler | **~2 500 GB** | Ville kostet ~50 USD/mnd og gjort opplasting uutholdelig |
| Bilder, ~25 per år | ~2 250 bilder → **~1,5 GB** | Nedskalert til web-størrelse |
| Bildeoriginaler (valgfritt) | **~11 GB** i Archive-nivå | ~0,02 USD/mnd. Anbefales |
| **Sum lagring** | **~35–50 GB** | ~1 USD/mnd |

**Den ene tingen som må gjøres riktig:** forskjellen mellom 30 GB og 2,5 TB er ikke
arkitektur, men om videoen transkodes før den lastes opp. Siden klippingen uansett skal
gjøres manuelt, koster det ingenting ekstra å transkode i samme operasjon —
[§11](#video) gir en ferdig kommando.

**Konsekvenser av at det bare er én redaktør:**

- Utkast/publisering-skille er ikke nødvendig i MVP.
- ETag-basert samtidighetskontroll beholdes likevel — den er nesten gratis, og beskytter
  mot at samme person redigerer fra telefon og PC samtidig.
- Rolletildeling blir enkel: én `redaktoer`, resten `familie`.

### Import gjøres fra årssidene

Alle bilder og videoer klippes og lastes inn manuelt, og metadata skrives inn for hånd.
Det er riktig framgangsmåte — det er bare et menneske som vet hvilket år et bilde hører
til og hvem som er på det, og et importskript ville ikke spart den jobben.

Men volumet er ~2 250 bilder. Da er det tre ting i redigerings-GUI-et som avgjør om
jobben er overkommelig eller uutholdelig, og de er derfor flyttet inn i MVP:

1. **Slipp mange filer samtidig.** 30 bilder droppes inn på én gang, lastes opp
   parallelt med fremdrift per fil, og legges i en liste. Aldri én og én.
2. **EXIF leses automatisk.** Opptaksdato hentes ut av filen og fyller `tatt`-feltet —
   og foreslår hvilket år bildet hører hjemme i. Sparer to felt per bilde × 2 250 bilder.
3. **Bildetekst kan komme senere.** Opplasting blokkeres ikke av at metadata mangler.
   Last opp alt, skriv tekster i den takten du orker.

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
- laste opp mange bilder om gangen, ikke ett og ett
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
Med et spenn tilbake til 1860-tallet er det verdt å vurdere et eget felt for **kilde**
(«fortalt av bestemor, 1998» / «kirkebok, Vang»), siden de eldste årene bygger på
annenhånds kunnskap.

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
      "tatt": "1972-08-14",       // fylles fra EXIF når den finnes
      "bredde": 3024,
      "hoyde": 4032,
      "varighet": null,           // sekunder, for video
      "rekkefolge": 10
    }
  ],
  "status": "publisert",
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

Ved ~90 år blir indeksen rundt 360 kB. Den bygges om av API-et hver gang et år lagres,
og er avledet data — kan alltid gjenskapes fra årsdokumentene via
`POST /api/vedlikehold/bygg-indeks`.

---

## 5. Arkitektur

```
                    ┌─────────────────────────────────────────────┐
   Nettleser        │            Azure Static Web Apps            │
  ┌──────────┐      │                                             │
  │  React   │◄─────┤  Statisk frontend (Vite-bygg)               │
  │  (SPA)   │      │  staticwebapp.config.json: SPA-ruting + CSP │
  └────┬─────┘      │                                             │
       │ /api/*     │  ┌───────────────────────────────────────┐  │
       ├───────────►│  │ Managed Functions (Node/TypeScript)   │  │
       │            │  │  aar · media · sok-indeks · sas       │  │
       │            │  └──────────────┬────────────────────────┘  │
       │            │                 │ Managed Identity          │
       │            └─────────────────┼───────────────────────────┘
       │                              ▼
       │                  ┌───────────────────────┐
       │                  │   Lagringskonto       │
       │                  │  ├─ innhold/  (JSON)  │
       └─────────────────►│  ├─ media/    (filer) │
         SAS-URL, direkte │  └─ Table: koder,     │
         opp- og nedlast  │     rate-limiting     │
                          └───────────────────────┘
```

**Hvorfor denne formen:**

- **Ingen database.** ~90 dokumenter og noen hundre kilobyte tekst, med skriving noen
  ganger i måneden av én person. Blob dekker behovet, koster nesten ingenting, og
  innholdet er lesbart og flyttbart som ren JSON.
- **Direkte opp- og nedlasting av media** går utenom API-et, via kortlevde SAS-URL-er.
  Nødvendig for video: SWA-ens managed functions har både størrelses- og
  tidsbegrensninger, og videostrømming trenger range-requests. Det har også en
  kostnadsside — se [§13](#kostnad).
- **Managed Identity** fra Function-laget mot lagringskontoen gjør at ingen
  lagringsnøkkel ligger i konfigurasjon eller kode.
- **All adgangskontroll ligger i Functions-laget**, ikke i konfigurasjonsfilen — en
  følge av at innloggingen er egen og ikke SWA-ens ([§9.2](#92-det-ene-som-endrer-seg-strukturelt)).

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
  1972/01HQ….jpg            web-størrelse, nedskalert i nettleseren
  1972/01HQ….thumb.jpg      miniatyr, ca. 400 px
  1972/01HQ….orig.jpg       original (Archive-nivå, valgfritt)
  1972/01HR….mp4            transkodet klipp
  1972/01HR….poster.jpg
```

I samme lagringskonto brukes i tillegg **Table Storage** til engangskoder, forsøkstellere
og rate-limiting ([§9.3](#93-innloggingsflyten)) — kortlevd driftsdata som ikke hører
hjemme blant årsdokumentene.

**Anbefalte innstillinger på lagringskontoen:**

- **Blob-versjonering på** — gir angrerett på feilredigering og sletting uten at det må bygges versjonshistorikk i appen.
- **Soft delete, 30 dager** — for både blob og container.
- **Livssyklusregel**: originalbilder rett til Archive; tidligere versjoner til Cool etter 30 dager.
- **Ingen anonym lesetilgang** på kontoen.
- Redundans **LRS** holder når blob-versjonering og en separat kopi ([§13](#sikkerhetskopi)) er på plass; GRS hvis materialet oppleves som uerstattelig.

---

## 7. API-kontrakt

Alle endepunkter under `/api`. Skriveoperasjoner krever rollen `redaktoer`.

| Metode | Rute | Rolle | Beskrivelse |
|---|---|---|---|
| `GET` | `/api/indeks` | familie | Hele indeksdokumentet — driver forside og søk |
| `GET` | `/api/felter` | familie | Feltdefinisjonene |
| `GET` | `/api/aar/{aar}` | familie | Ett årsdokument, med lese-SAS på hvert medieobjekt |
| `PUT` | `/api/aar/{aar}` | redaktør | Opprett/oppdater. `If-Match: <etag>` for optimistisk låsing |
| `DELETE` | `/api/aar/{aar}` | redaktør | Slett år (blob-versjonering gjør det angrbart) |
| `POST` | `/api/media/opplasting` | redaktør | Tar en liste med filnavn + MIME-typer, returnerer skrive-SAS (15 min) per fil |
| `DELETE` | `/api/media/{aar}/{id}` | redaktør | Slett mediefil og alle avledede filer |
| `POST` | `/api/vedlikehold/bygg-indeks` | redaktør | Bygg `indeks.json` på nytt fra alle årsdokumenter |
| `POST` | `/api/auth/kode` | åpen | Ber om engangskode på e-post. Svarer alltid `202` ([§9.3](#93-innloggingsflyten)) |
| `POST` | `/api/auth/verifiser` | åpen | Bytter kode mot sesjon |
| `POST` | `/api/auth/logg-ut` | familie | Trekker tilbake sesjonen |
| `GET` | `/api/tilgang` | redaktør | Hent tilgangslisten |
| `PUT` | `/api/tilgang` | redaktør | Oppdater tilgangslisten |

At `/api/media/opplasting` tar en **liste** og ikke én fil er en liten detalj med stor
effekt: den lar redigerings-GUI-et hente SAS for 30 filer i ett kall og laste dem opp
parallelt.

**Samtidighet.** `GET /api/aar/{aar}` returnerer blobens ETag. `PUT` sender den tilbake
i `If-Match`; hvis noe annet har lagret i mellomtiden svarer API-et `412` og klienten
viser «Året er endret et annet sted — last inn på nytt». Med én redaktør er dette først
og fremst et vern mot to åpne faner.

**Autorisasjon skjer i hver funksjon.** Fordi innloggingen er egen og ikke SWA-ens, kan
ikke `staticwebapp.config.json` beskytte noe ([§9.2](#92-det-ene-som-endrer-seg-strukturelt)).
Rollekolonnen over håndheves derfor av en delt `krevRolle()`-hjelper som hvert endepunkt
kaller først — det er én linje per funksjon, men det er den linjen som er hele
adgangskontrollen, så den bør ha egne tester.

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
- innebygd fuzzy-toleranse for skrivefeil — viktigere enn man tror ved slekts- og stedsnavn
- norsk normalisering: småbokstaver, men **æ/ø/å beholdes** — de skal ikke strippes til ae/oe/aa
- treff rangeres, og år uten treff skjules med en myk animasjon
- resultatet viser hvilket felt treffet kom fra, med utheving i konteksten

**Med det kjente volumet:** ~90 år à 4 kB tekst gir en indeks på ~360 kB. Det er godt
innenfor. Ingen dimensjonering nødvendig, og ingen søketjeneste å betale for.

---

## 9. Autentisering og personvern

Valget er tatt: hele innholdet ligger bak innlogging. Og siden dere allerede har et
etablert mønster for det — **engangskode på e-post, med sesjonen lagret i nettleseren** —
legges det til grunn her, i stedet for Static Web Apps' innebygde Entra-innlogging.

Det er ikke et kompromiss. Det er en enklere og billigere løsning på dette problemet.

### 9.1 Tenant- og lisensspørsmålet forsvinner

| | SWA + Entra ID | **OTP på e-post** |
|---|---|---|
| Brukere i tenanten | Én gjestebruker per person, via B2B | **Ingen** |
| Lisenskostnad | Ingen (50 000 MAU gratis) | **Ingen** |
| Tak på antall lesere | 25 med egendefinert rolle | **Ingen** |
| SWA-plan | Gratis, Standard over 25 lesere | **Gratis, alltid** |
| Administreres i | Azure-portalen | **Tilgangsliste i appen** |
| Familien logger inn med | Microsoft-konto | **E-postadressen de allerede har** |

Det siste punktet er det som betyr mest i praksis: en tante på 78 skal slippe å finne ut
hva en Microsoft-konto er. Hun får en kode på e-post og skriver den inn.

Prisen er at dere eier autentiseringskoden selv — sesjonshåndtering, rate-limiting og
tilbakekalling er deres å vedlikeholde, ikke Microsofts. Siden mønsteret allerede er i
bruk i andre løsninger, er det en kjent kostnad og ikke en ny.

### 9.2 Det ene som endrer seg strukturelt

**`allowedRoles` i `staticwebapp.config.json` slutter å virke.** Static Web Apps kjenner
bare sin egen innlogging; den ser ikke et token dere har utstedt selv. All autorisasjon
må derfor flytte inn i Functions-laget, der hvert endepunkt validerer tokenet selv.

Konsekvensen er verdt å forstå presist:

| | Beskyttes av | Kommentar |
|---|---|---|
| `index.html`, JS, CSS | **Ingenting** | App-skallet er offentlig lesbart |
| `/api/*` | Tokenvalidering i hver funksjon | All tekst og alle metadata |
| Mediefiler i Blob | Kortlevd SAS, utstedt av API-et | Bilder og video |

**Ingenting av innholdet ligger i skallet**, så personvernet er like intakt — men to ting
må legges til som SWA ellers ville gitt gratis:

1. **`noindex` og `robots.txt`.** Skallet er nå hentbart av søkemotorer. Det inneholder
   ingenting, men et treff på «familiehistorie christiansen» i Google er uansett uønsket.
   `<meta name="robots" content="noindex, nofollow">` og en `robots.txt` som avviser alt.
2. **Dyplenker må overleve innlogging.** `/aar/1972` gir nå skallet, som oppdager at det
   mangler gyldig token og viser innloggingen. Ruten må lagres og gjenopprettes etter at
   koden er bekreftet, ellers havner man alltid på forsiden.

**Mediehåndteringen er uendret.** SAS-modellen fra [§5](#5-arkitektur) forutsatte aldri
SWA-innlogging — API-et validerer den som spør, og utsteder deretter en kortlevd URL.
Den delen fungerer likt med OTP.

### 9.3 Innloggingsflyten

```
1.  POST /api/auth/kode          { epost }
    → slår opp mot tilgangslisten
    → svarer alltid 202, uansett om adressen står der
      (ellers lekker endepunktet hvem som er i familien)
    → hvis på listen: genererer 6-sifret kode, lagrer hash + utløp + forsøksteller,
      sender e-post via Azure Communication Services

2.  POST /api/auth/verifiser     { epost, kode }
    → sjekker hash, utløp (10 min) og forsøk (maks 5, deretter forkastes koden)
    → ved treff: sletter koden, utsteder sesjonstoken

3.  Klienten lagrer sesjonen og sender den med hvert /api-kall
```

**Serverstatus** — koder, forsøkstellere og rate-limiting — legges i **Azure Table
Storage i samme lagringskonto**. Det er ikke å innføre en database: det er en funksjon i
kontoen som allerede finnes, den koster brøkdeler av en krone, og den passer for data som
skal utløpe og telles. Årsdokumentene forblir i Blob.

**Rate-limiting** er ikke valgfritt. Et 6-sifret tall har en million kombinasjoner; uten
tak på forsøk og på hvor ofte en kode kan bestilles, er det brukbart brute-force-mål.
Maks 5 forsøk per kode og maks 5 kodebestillinger per adresse per time.

### 9.4 Tilgangslisten er innhold, ikke portalarbeid

`innhold/tilgang.json`, redigerbar fra en egen side i GUI-et:

```json
{
  "personer": [
    { "epost": "jachrist@…", "navn": "Jan Christian", "roller": ["familie", "redaktoer"] },
    { "epost": "tante@…",    "navn": "Tante Kari",    "roller": ["familie"] }
  ]
}
```

Dette passer bedre med resten av arkitekturen enn invitasjonsflyten gjorde: å legge til
et familiemedlem blir en oppgave i appen, ikke i Azure-portalen, og listen
sikkerhetskopieres sammen med alt annet innhold.

**Rollene sjekkes ved hvert kall, ikke bare ved innlogging.** Hvis noen fjernes fra
listen, skal tilgangen forsvinne umiddelbart — ikke når sesjonen utløper om tretti dager.
Listen caches i minnet i ~60 sekunder, så det koster ett blob-oppslag i minuttet.

### 9.5 Om å lagre sesjonen i `localStorage`

Mønsteret virker, og for dette nettstedet er trusselbildet moderat. Men det er én
kombinasjon som fortjener oppmerksomhet nettopp her:

> Årssidene inneholder **rik tekst som lagres og vises for andre**. Slipper det gjennom
> uskadeliggjort HTML, kjører fremmed skript i nettleseren til den som leser — og et token
> i `localStorage` er lesbart for alt skript på siden. Stored XSS blir da lik full
> lesetilgang til hele arkivet.

Sanitering server-side ([§7](#7-api-kontrakt)) er derfor ikke lenger bare hygiene, den er
den bærende sikkerhetskontrollen. I tillegg: en streng CSP, og ingen tredjepartsskript på
sidene.

**En liten oppgradering verdt å vurdere:** siden app og API ligger på samme opphav under
Static Web Apps, kan sesjonen like gjerne ligge i en `httpOnly; Secure; SameSite=Strict`-
informasjonskapsel som API-et setter. Da er den utilgjengelig for skript, uten CORS-arbeid
og uten at noe annet i flyten endres. Det er den samme OTP-innloggingen, bare med tokenet
et sted JavaScript ikke når.

Velges `localStorage` likevel, er det fullt forsvarlig — forutsatt at saniteringen og
CSP-en er på plass. De to er uansett påkrevd.

### 9.6 Det som ikke er teknikk

- **Avtale i familien** om hva som deles: bilder av barn, helseopplysninger, konflikter,
  personer som er gått bort. Verdt en samtale før innholdet fylles på, ikke etter.
  Med et spenn på 160 år vil noe av materialet handle om mennesker som aldri ble spurt.
- **Rett til å bli glemt.** GDPR gjelder i praksis ikke rent private, husholdningsinterne
  formål, men et enkelt løfte om at «sier du ifra, tar vi det ut» er både billig og riktig.
  Datamodellen gjør det lett: bilder er identifiserbare objekter i årsdokumentet.
- **Eksportvei ut.** Alt innhold er JSON + filer i Blob. Et lite skript kan når som helst
  laste ned hele historikken. Ingen innelåsing.

## 10. Frontend

**Stack:** React 18 + TypeScript + Vite. Ruting med React Router, serverstatus med
TanStack Query (cache, gjenforsøk, optimistisk oppdatering). Styling med CSS-moduler eller
Tailwind — smakssak, ikke arkitektur.

### Sider

| Rute | Innhold |
|---|---|
| `/` | Årsliste, alle lukket, gruppert på tiår. Søkefelt øverst |
| `/aar/:aar` | Samme årsside som permalenke — for deling og dyplenking |
| `/rediger/:aar` | Redigeringsskjema, generert fra `felter.json` |
| `/rediger/nytt` | Opprett år: velg årstall, resten som over |
| `/rediger/tilgang` | Tilgangslisten: hvem som er med, og hvem som kan redigere |
| `/logg-inn` | E-postadresse, deretter engangskode. Husker hvor du var på vei |

### Forsiden

Rundt 90 rader er for mange til en flat liste. Årene grupperes derfor på **tiår**, med
tiåret som lavmælt overskrift. Det løser to problemer samtidig: listen blir skannbar, og
de tynne tidligårene leses som det de er — «1890-årene: 1893» framstår som en bevisst
glissen periode, ikke som en feil.

Utfolding skjer på stedet uten sidebytte, men oppdaterer URL-en til `/aar/1972` slik at
tilbakeknappen og deling virker som forventet. Ved søk animeres radene uten treff bort,
tomme tiår kollapser, og treffordet utheves.

### Redigeringsskjemaet

- Genereres fra `felter.json` — nytt felt i skjemaet gir nytt felt i GUI-et automatisk
- Rik tekst med en bevisst *liten* verktøylinje: fet, kursiv, lenke, punktliste. Ikke mer
- **Autolagring til `localStorage`** hvert par sekunder, med gjenoppretting hvis fanen lukkes
  eller nettet faller ut — den vanligste måten å miste arbeid på
- **Slipp mange filer samtidig**, med kø, fremdrift per fil og mulighet til å fortsette
  å skrive mens opplastingen går
- **Bildetekstliste**: alle nyopplastede bilder i en kompakt liste der teksten skrives
  rett inn, uten å åpne hvert bilde for seg
- Rekkefølge på media endres ved dra-og-slipp
- Forhåndsvisning som viser den ferdige årssiden ved siden av eller under skjemaet

---

## 11. Bilder og video

### Bilder

1. Nettleseren nedskalerer til maks 2400 px lang side og komprimerer til JPEG/WebP før
   opplasting (`canvas` + `toBlob`). Et 12 MB mobilbilde blir typisk 400–700 kB.
2. Samtidig lages en miniatyr på ~400 px, og **EXIF leses ut** (`exifr`, ~15 kB) for å
   fylle opptaksdato og foreslå årstall.
3. Alt lastes opp direkte til Blob med skrive-SAS, parallelt.
4. Klienten legger medieobjektene inn i årsdokumentet og gjør `PUT /api/aar/{aar}`.

**Originalene bør beholdes.** Ved ~2 250 bilder koster originalene rundt 11 GB i
Archive-nivået — omtrent 0,02 USD i måneden. Det er billig forsikring mot at man om ti år
ønsker seg større utsnitt enn 2400 px. Last opp originalen ved siden av web-versjonen og
la en livssyklusregel flytte `*.orig.jpg` rett til Archive.

### Video

Dette er det ene stedet hvor et feilvalg får konsekvenser. Med ~11 timer ferdig klippet
materiale:

| Hva som lastes opp | Total lagring | Kostnad/mnd |
|---|---|---|
| Råfiler fra telefon/kamera (~50 Mbit/s) | ~2 500 GB | ~50 USD |
| 1080p H.264, 6 Mbit/s | ~30 GB | ~0,60 USD |
| 720p H.264, 3 Mbit/s | ~15 GB | ~0,30 USD |

Siden klippingen uansett gjøres manuelt, gjøres transkodingen i samme operasjon:

```bash
# Klipp ut 00:12:30–00:19:45 og transkode til web-vennlig 1080p
ffmpeg -ss 00:12:30 -to 00:19:45 -i original.mov \
  -vf "scale=-2:1080" -c:v libx264 -preset slow -crf 21 \
  -c:a aac -b:a 128k -movflags +faststart klipp.mp4
```

- `-crf 21` gir god kvalitet for familievideo; `23` er også fullt brukbart og mindre
- `-movflags +faststart` er ikke valgfritt — uten den må hele filen lastes ned før
  avspillingen starter
- For digitalisert smalfilm og VHS er kilden uansett lavoppløst: bruk `scale=-2:720`
  og `-crf 22`

HandBrake gjør det samme med et grafisk grensesnitt («Fast 1080p30»-forhåndsinnstillingen
er nær nok).

**I appen:** blokkvis opplasting direkte til Blob med fremdriftsindikator, plakatbilde
hentet fra første bildefelt eller valgt manuelt, og avspilling med vanlig `<video>` mot
en lese-SAS-URL. Blob støtter range-requests, så spoling virker.

**Grense i MVP: 2 GB per fil.** Med anbefalt transkoding tilsvarer det nesten en time
sammenhengende video — langt mer enn noe enkeltklipp bør være. Redigerings-GUI-et
advarer hvis en fil er mistenkelig stor for lengden sin, altså sannsynligvis ikke
transkodet.

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
│  │  ├─ komponenter/      TiaarsGruppe, AarRad, Sokefelt, Mediegalleri,
│  │  │                    Feltskjema, Opplastingskoe
│  │  ├─ api/              typet klient mot /api, med sesjon
│  │  ├─ auth/             innloggingsside, sesjonslagring, dyplenkeminne
│  │  ├─ media/            nedskalering, EXIF, blokkvis opplasting
│  │  └─ sok/              MiniSearch-oppsett og normalisering
│  └─ index.html
├─ api/                                 Azure Functions, TypeScript
│  ├─ src/funksjoner/      aar.ts, media.ts, indeks.ts, felter.ts,
│  │                      auth.ts, tilgang.ts
│  ├─ src/auth/           token.ts, krevRolle.ts, otp.ts, epost.ts
│  ├─ src/blob.ts          Blob-klient med Managed Identity
│  ├─ src/tabell.ts        Table Storage: koder og rate-limiting
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
midlertidig forhåndsvisningsmiljø.

### Miljøer

Ett produksjonsmiljø holder. Lokal utvikling kjøres med **SWA CLI** (`swa start`), som
etterligner ruting lokalt, mot **Azurite** som emulerer både Blob og Table. Innloggingen er
vår egen, så den kjører uendret lokalt — med e-postutsendingen byttet ut mot en funksjon
som skriver koden til konsollen. Da trengs ingen Azure-ressurser for å utvikle.

### Sikkerhetskopi

Blob-versjonering og soft delete dekker uhell, men ikke et tapt abonnement eller en
slettet ressursgruppe. I tillegg anbefales en **kopi utenfor Azure**: en planlagt jobb
(GitHub Actions, ukentlig) som kjører `azcopy sync` av begge containere til en ekstern
disk eller en annen skytjeneste.

Ved ~50 GB er dette fullt overkommelig. Familiehistorie er den typen data der man
oppdager tapet altfor sent.

### Kostnad

*Anslag i USD/mnd, bør verifiseres mot gjeldende prisliste.*

| Post | Kostnad |
|---|---|
| Static Web Apps, **gratisplanen** | 0 |
| Blob Storage, ~50 GB Hot | ~1 |
| Bildeoriginaler, ~11 GB Archive | ~0,02 |
| Table Storage (koder, rate-limiting) | ~0 |
| Azure Communication Services, e-post | ~0 |
| Utgående trafikk (se under) | 0 |
| Application Insights | ~0 (under gratiskvote) |
| **Sum** | **~1 USD/mnd** |

Standard-planen er ikke lenger aktuell. Den trengtes bare til SWA-ens egen custom
authentication og til å komme forbi taket på 25 inviterte brukere — og med egen
OTP-innlogging finnes ingen av de to begrensningene. Gratisplanen holder uansett hvor
mange familien blir.

E-postutsending er noen titalls meldinger i måneden. Azure Communication Services
prises per melding og per datamengde; beløpet er i praksis null, men bør slås opp i
[prislisten](https://azure.microsoft.com/en-us/pricing/details/communication-services/)
hvis nøyaktighet ønskes. Merk at avsenderdomenet bør **verifiseres** — den
Azure-genererte avsenderadressen havner ofte i søppelpost, og en engangskode som ikke
kommer fram er en innlogging som ikke virker.

**Om båndbredde — en presisering.** Siden media serveres direkte fra Blob og ikke gjennom
Static Web Apps, går videotrafikken *ikke* på SWA-kvoten. Det er en fordel, for på
gratisplanen slutter nettstedet å bli servert hvis 100 GB-kvoten overskrides (Standard
tar overforbruk til ~0,20 USD/GB). SWA-trafikken her er bare app-skallet og JSON — noen
titalls megabyte i måneden.

Videotrafikken går i stedet på Azures utgående båndbredde, der **de første 100 GB per
måned er gratis** for hele abonnementet. Til sammenligning: hele videokatalogen er ~30 GB,
så det skal en del familiedugnad til for å passere. Skulle det skje, ligger prisen på
størrelsesorden 0,08–0,09 USD/GB — 300 GB i en måned ville kostet under 20 USD.

### Overvåking

Application Insights er innebygd i SWA. For et nettsted som dette holder det med en
varsling på feilrate i API-et — og eventuelt en kostnadsvarsling på lagringskontoen, som
billig forsikring mot at det lastes opp utranskodet video.

---

## 14. Faseplan

### Fase 1 — MVP (ca. 6–9 dager)

| Trinn | Innhold |
|---|---|
| 1 | Azure-ressurser: SWA, lagringskonto, containere, Managed Identity, rolletildeling |
| 2 | Repostillas: Vite-app, Functions-prosjekt, delte typer, SWA CLI + Azurite lokalt |
| 3 | API: `felter`, `aar` (GET/PUT/DELETE med ETag), `indeks`, `media/opplasting` (liste) |
| 4 | Forside: tiårsgruppering, årsliste, utfolding, permalenker |
| 5 | Årsside: rendering av felter og mediegalleri |
| 6 | Redigering: skjemagenerering, autolagring |
| 7 | **Masseopplasting**: kø, parallellitet, fremdrift, nedskalering, EXIF, bildetekstliste |
| 8 | Søk med MiniSearch og filtrering av årslisten |
| 9 | **OTP-innlogging**: kode på e-post, sesjon, `krevRolle()` i alle endepunkter, tilgangsliste, rate-limiting, private media-SAS |
| 10 | Video: blokkvis opplasting, plakatbilde, avspilling, advarsel om utranskodet fil |
| 11 | Mobiltilpasning, tomtilstander, feilmeldinger på norsk, sikkerhetskopijobb |

Rekkefølgen er valgt slik at det finnes noe kjørbart å se på fra og med trinn 4.

Estimatet har vokst fra 5–8 til 7–10 dager gjennom to bevisste utvidelser: masseopplasting
og EXIF flyttet inn fra fase 2 (trinn 7), og egen OTP-innlogging i stedet for SWA-ens
ferdige (trinn 9). Den siste koster omtrent én dag mer å bygge enn å slå på
Entra-innloggingen — og sparer til gjengjeld all tenant-administrasjon, taket på 25
lesere, og at familien må skaffe seg Microsoft-kontoer.

### Fase 2 — bruksforbedringer

- Utkast før publisering (relevant først hvis flere redaktører kommer til)
- «Husk meg på denne enheten» med lengre sesjon og enhetsliste
- Miniatyrer generert server-side (blob-utløst funksjon), avlaster nettleseren
- Bedre bildevisning: lysbokse med sveiping og tastaturnavigasjon
- Tidslinjevisning på tvers av år
- Kildefelt og fotnoter for de eldste årene

*Bulkimportskript er tatt ut* — importen gjøres fra årssidene, og masseopplastingen i
fase 1 dekker behovet.

### Fase 3 — utvidelser

- Personregister med tagging av personer i bilder og egne personsider
- Kommentarer og minner fra familiemedlemmer uten redaktørrolle
- Eksport til PDF eller trykk-klar bok
- Innlogging med lenke i e-post («magic link») som alternativ til å taste kode
- To-faktor for redaktørrollen, hvis flere redaktører kommer til

---

## 15. Risiko

| Risiko | Konsekvens | Håndtering |
|---|---|---|
| Endepunkt glemmer `krevRolle()` | Det endepunktet er åpent for alle | Autorisasjon er nå kode, ikke konfigurasjon: felles hjelper, egne tester, og en test som feiler hvis en rute mangler den |
| Stored XSS i rik tekst stjeler sesjonen | Full lesetilgang til arkivet | Sanitering server-side, streng CSP, ingen tredjepartsskript — eventuelt sesjon i `httpOnly`-cookie ([§9.5](#95-om-å-lagre-sesjonen-i-localstorage)) |
| Engangskode brute-forces | Uvedkommende kommer inn | Maks 5 forsøk per kode, maks 5 bestillinger per adresse per time, 10 min utløp |
| Kodene havner i søppelpost | Ingen får logget inn | Verifisert avsenderdomene, ikke den Azure-genererte adressen |
| Utranskodet video lastes opp | Lagring ×80, treg opplasting og avspilling | Fast rutine med `ffmpeg`, størrelsesadvarsel i GUI, kostnadsvarsling på kontoen |
| Data går tapt | Uerstattelig | Blob-versjonering, soft delete, ukentlig kopi ut av Azure |
| Innhold lekker offentlig | Alvorlig og lite reverserbart | Innlogging også for lesing, private containere, kortlevde SAS |
| Metadatajobben blir for stor | 2 250 bilder uten bildetekst | Masseopplasting, EXIF-utfylling, bildetekst kan skrives senere |
| Prosjektet stopper opp etter MVP | Tomt nettsted | Fase 1 leverer et fullt brukbart nettsted; fase 2 og 3 er rene tillegg |
| Innelåsing i Azure | Vanskelig å flytte | Alt innhold er JSON + filer; ingen proprietær datamodell |

---

## 16. Neste steg

1. **Gå gjennom feltlisten** i [§4.1](#41-faste-felter--skjemadrevet) og juster den til
   det familien vil skrive om. Vurder et kildefelt for de eldste årene.
2. **Bestem transkodingsoppsettet** ([§11](#video)) og kjør ett prøveklipp gjennom det.
   Sjekk at kvaliteten er god nok før 11 timer er transkodet.
3. **Opprett Azure-ressursene** på gratisplanen og la Azure generere GitHub
   Actions-arbeidsflyten.
4. **Bygg trinn 1–4** av fase 1 og se på resultatet før resten planlegges i detalj — den
   første ekte årssiden pleier å endre meningen om ganske mye.
5. **Bestem hvor sesjonen skal ligge** — `localStorage` som i deres øvrige løsninger,
   eller en `httpOnly`-cookie ([§9.5](#95-om-å-lagre-sesjonen-i-localstorage)). Valget
   påvirker bare noen linjer i API-et og klienten, men er lettest å ta nå.
6. **Sett opp avsenderdomenet for e-post tidlig.** Domeneverifisering tar gjerne et døgn
   på grunn av DNS, og uten den havner engangskodene i søppelpost. Det er den enkleste
   måten å bli forsinket på i trinn 9.

---

## 17. Kilder

Faktagrunnlaget for [§9](#9-autentisering-og-personvern) og [§13](#kostnad), kontrollert
i august 2026:

- [Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization) — forhåndskonfigurerte leverandører, invitasjoner og `allowedRoles`; bakgrunn for [§9.2](#92-det-ene-som-endrer-seg-strukturelt)
- [Custom authentication in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) — custom auth krever Standard-planen; egne registreringer slår av de forhåndskonfigurerte
- [Quotas in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) — taket på 25 brukere for egendefinerte roller; ingen grense på antall innlogginger
- [Azure Static Web Apps hosting plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans) — Free vs. Standard
- [Static Web Apps pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) — 100 GB kvote, overforbruk på Standard
- [Assign Static Web Apps roles with Microsoft Graph](https://learn.microsoft.com/en-us/azure/static-web-apps/assign-roles-microsoft-graph) — `rolesSource` og `getRoles`-funksjonen
- [External ID pricing](https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing) — 50 000 MAU gratis, ingen P1-lisens per gjest
- [Azure bandwidth pricing](https://azure.microsoft.com/en-us/pricing/details/bandwidth/) — 100 GB utgående trafikk gratis per måned
- [Azure Communication Services pricing](https://azure.microsoft.com/en-us/pricing/details/communication-services/) — e-postutsending; konkret sats ikke gjengitt her, se prislisten

Entra-tallene over er beholdt fordi de begrunner *hvorfor* OTP-mønsteret er å foretrekke
her ([§9.1](#91-tenant--og-lisensspørsmålet-forsvinner)) — de er ikke lenger noe løsningen
avhenger av.

**Forbehold.** Prisene bør alltid kontrolleres mot gjeldende prisliste; satsen for
e-postutsending er bevisst ikke gjengitt, siden den ikke lot seg bekrefte i denne
gjennomgangen.
