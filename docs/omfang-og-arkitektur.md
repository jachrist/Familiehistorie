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

**Estimert innsats til produksjonsklar MVP: ca. 6–9 arbeidsdager.**
**Estimert driftskostnad: ca. 1–2 USD/mnd** på gratisplanen (se [§13](#kostnad)).

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
| F10 | Innlogging; lesetilgang og skrivetilgang styrt av rolle |
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
| Helt privat? | **Ja** | Innlogging kreves også for lesing. Avgjør plan og mediehåndtering — se [§9](#9-autentisering-og-personvern) |
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

- **Ingen database.** ~90 dokumenter og noen hundre kilobyte tekst, med skriving noen
  ganger i måneden av én person. Blob dekker behovet, koster nesten ingenting, og
  innholdet er lesbart og flyttbart som ren JSON.
- **Direkte opp- og nedlasting av media** går utenom API-et, via kortlevde SAS-URL-er.
  Nødvendig for video: SWA-ens managed functions har både størrelses- og
  tidsbegrensninger, og videostrømming trenger range-requests. Det har også en
  kostnadsside — se [§13](#kostnad).
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
  1972/01HQ….jpg            web-størrelse, nedskalert i nettleseren
  1972/01HQ….thumb.jpg      miniatyr, ca. 400 px
  1972/01HQ….orig.jpg       original (Archive-nivå, valgfritt)
  1972/01HR….mp4            transkodet klipp
  1972/01HR….poster.jpg
```

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

At `/api/media/opplasting` tar en **liste** og ikke én fil er en liten detalj med stor
effekt: den lar redigerings-GUI-et hente SAS for 30 filer i ett kall og laste dem opp
parallelt.

**Samtidighet.** `GET /api/aar/{aar}` returnerer blobens ETag. `PUT` sender den tilbake
i `If-Match`; hvis noe annet har lagret i mellomtiden svarer API-et `412` og klienten
viser «Året er endret et annet sted — last inn på nytt». Med én redaktør er dette først
og fremst et vern mot to åpne faner.

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

Valget er tatt: **hele nettstedet skal ligge bak innlogging**, ikke bare redigeringen.
Innholdet er bilder og fortellinger om levende familiemedlemmer; et åpent nettsted blir
indeksert av søkemotorer og arkivert av Wayback Machine, og lar seg i praksis ikke angre.

### 9.1 Må det opprettes brukere i tenanten? Kreves lisens?

**Kort svar: ingen lisens, men ja — med Entra-innlogging dukker familiemedlemmene opp
som gjestebrukere i tenanten din. Det er gratis, men det er reell administrasjon.**

Detaljene, med kildehenvisninger i [§17](#17-kilder):

**Lisens — nei.** Microsoft Entra External ID er gratis for de første **50 000 månedlig
aktive brukere**. En familie på 10–40 personer ligger i praksis på null. Det kreves
heller ikke en Entra ID P1-lisens per gjestebruker; MAU-modellen erstatter
per-bruker-lisensiering for eksterne.

**Brukere i tenanten — det kommer an på innloggingsmåten.**

| Innlogging | Objekt i tenanten din? | Plan | Realistisk for familien? |
|---|---|---|---|
| GitHub (forhåndskonfigurert) | Nei — går ikke via Entra B2B | Gratis | Nei, forutsetter GitHub-konto |
| Microsoft Entra ID (forhåndskonfigurert) | **Ja, som gjestebruker via B2B** | Gratis | Ja — tar imot enhver Microsoft-konto, også personlig `outlook.com`/`hotmail.com` |
| Egenregistrert Entra-app | Ja | **Standard** | Ja, og gir kontroll over kontotyper |
| Entra External ID (eget eksternt tenant) | Nei, ikke i arbeidstenanten din | **Standard** | Ja — e-post + engangskode, Google, Apple |

Det er altså **gratis**, men ikke gratis i tid: hver invitasjon gir et gjestebrukerobjekt
i katalogen din som du er ansvarlig for, og som må ryddes når noen ikke lenger skal ha
tilgang.

### 9.2 Fellen som er verdt å kjenne

Static Web Apps har en innebygd rolle `authenticated` som *alle* innloggede får. Siden
den forhåndskonfigurerte Entra-leverandøren tar imot **enhver** Microsoft-konto, betyr
`allowedRoles: ["authenticated"]` i praksis at *hvem som helst i verden med en
Microsoft-konto* kan lese familiehistorien. Det er ikke personvern.

Tilgangen må derfor knyttes til en **egendefinert rolle** som bare deles ut ved
invitasjon:

```jsonc
{
  "routes": [
    { "route": "/api/aar/*",         "methods": ["PUT", "DELETE"], "allowedRoles": ["redaktoer"] },
    { "route": "/api/media/*",       "methods": ["POST", "DELETE"], "allowedRoles": ["redaktoer"] },
    { "route": "/api/vedlikehold/*", "allowedRoles": ["redaktoer"] },
    { "route": "/rediger/*",         "allowedRoles": ["redaktoer"] },
    { "route": "/*",                 "allowedRoles": ["familie"] }
  ],
  "responseOverrides": { "401": { "statusCode": 302, "redirect": "/.auth/login/aad" } },
  "navigationFallback": { "rewrite": "/index.html", "exclude": ["/media/*", "*.{css,js,png,jpg,mp4}"] }
}
```

**Taket på 25.** Den innebygde invitasjonsmekanismen tildeler egendefinerte roller til
maks 25 brukere. Det er ingen grense på hvor mange som kan *logge inn* — bare på hvor
mange som kan få rollen `familie`. Med fire generasjoner kan 25 bli trangt. To utveier:

- **Innenfor 25:** ingenting å gjøre, gratisplanen holder.
- **Over 25:** en egen `getRoles`-funksjon (`auth.rolesSource` i konfigurasjonen) som
  slår opp brukeren mot en tilgangsliste du selv styrer, f.eks. `innhold/tilgang.json`.
  Ingen grense, og tilgangsstyringen flytter inn i appen i stedet for Azure-portalen.
  **Krever Standard-planen**, siden det regnes som custom authentication.

### 9.3 Anbefaling

**Start på gratisplanen med forhåndskonfigurert Entra ID og invitasjoner.** Du er eneste
redaktør, og de første leserne er sannsynligvis godt under 25. Det koster null, krever
ingen app-registrering, og familiemedlemmer kan bruke den Microsoft-kontoen de allerede
har.

**Bytt til Standard + `getRoles` når — og bare når — en av disse inntreffer:** dere
passerer 25 lesere, du blir lei av å administrere gjestebrukere i portalen, eller familien
vil logge inn med Google/Apple. Byttet endrer bare konfigurasjon og legger til én
funksjon; ingen data eller sider må røres.

### 9.4 Media må beskyttes like godt som sidene

En privat side hjelper lite hvis bilde-URL-ene er åpne. Derfor: private containere, og
kortlevde lese-SAS (30–60 min) utstedt sammen med årsdokumentet. En SAS-URL som lekker,
utløper av seg selv.

### 9.5 Det som ikke er teknikk

- **Avtale i familien** om hva som deles: bilder av barn, helseopplysninger, konflikter,
  personer som er gått bort. Verdt en samtale før innholdet fylles på, ikke etter.
  Med et spenn på 160 år vil noe av materialet handle om mennesker som aldri ble spurt.
- **Rett til å bli glemt.** GDPR gjelder i praksis ikke rent private, husholdningsinterne
  formål, men et enkelt løfte om at «sier du ifra, tar vi det ut» er både billig og riktig.
  Datamodellen gjør det lett: bilder er identifiserbare objekter i årsdokumentet.
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
| `/` | Årsliste, alle lukket, gruppert på tiår. Søkefelt øverst |
| `/aar/:aar` | Samme årsside som permalenke — for deling og dyplenking |
| `/rediger/:aar` | Redigeringsskjema, generert fra `felter.json` |
| `/rediger/nytt` | Opprett år: velg årstall, resten som over |

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
│  │  ├─ api/              typet klient mot /api
│  │  ├─ media/            nedskalering, EXIF, blokkvis opplasting
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
midlertidig forhåndsvisningsmiljø.

### Miljøer

Ett produksjonsmiljø holder. Lokal utvikling kjøres med **SWA CLI** (`swa start`), som
etterligner ruting, autentisering og roller lokalt, mot **Azurite** som lokal Blob-emulator.
Da trengs ingen Azure-ressurser for å utvikle.

### Sikkerhetskopi

Blob-versjonering og soft delete dekker uhell, men ikke et tapt abonnement eller en
slettet ressursgruppe. I tillegg anbefales en **kopi utenfor Azure**: en planlagt jobb
(GitHub Actions, ukentlig) som kjører `azcopy sync` av begge containere til en ekstern
disk eller en annen skytjeneste.

Ved ~50 GB er dette fullt overkommelig. Familiehistorie er den typen data der man
oppdager tapet altfor sent.

### Kostnad

*Anslag i USD/mnd, bør verifiseres mot gjeldende prisliste.*

| Post | Gratisplan | Standardplan |
|---|---|---|
| Static Web Apps | 0 | ~9 |
| Blob Storage, ~50 GB Hot | ~1 | ~1 |
| Bildeoriginaler, ~11 GB Archive | ~0,02 | ~0,02 |
| Utgående trafikk (se under) | 0 | 0 |
| Application Insights | ~0 (under gratiskvote) | ~0 |
| **Sum** | **~1 USD** | **~10 USD** |

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
| 9 | Autentisering, `familie`/`redaktoer`, ruteregler, private media-SAS |
| 10 | Video: blokkvis opplasting, plakatbilde, avspilling, advarsel om utranskodet fil |
| 11 | Mobiltilpasning, tomtilstander, feilmeldinger på norsk, sikkerhetskopijobb |

Rekkefølgen er valgt slik at det finnes noe kjørbart å se på fra og med trinn 4.
Estimatet er én dag høyere enn i første utgave, fordi masseopplasting og EXIF er flyttet
inn fra fase 2 — det er den dagen som sparer flest timer senere.

### Fase 2 — bruksforbedringer

- Utkast før publisering (relevant først hvis flere redaktører kommer til)
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
- `getRoles`-funksjon og Standard-plan hvis leserlisten passerer 25

---

## 15. Risiko

| Risiko | Konsekvens | Håndtering |
|---|---|---|
| `authenticated` forveksles med «familien» | Hele arkivet åpent for alle med Microsoft-konto | Ruteregler krever egendefinert rolle `familie`, aldri `authenticated` ([§9.2](#92-fellen-som-er-verdt-å-kjenne)) |
| Utranskodet video lastes opp | Lagring ×80, treg opplasting og avspilling | Fast rutine med `ffmpeg`, størrelsesadvarsel i GUI, kostnadsvarsling på kontoen |
| Data går tapt | Uerstattelig | Blob-versjonering, soft delete, ukentlig kopi ut av Azure |
| Innhold lekker offentlig | Alvorlig og lite reverserbart | Innlogging også for lesing, private containere, kortlevde SAS |
| Metadatajobben blir for stor | 2 250 bilder uten bildetekst | Masseopplasting, EXIF-utfylling, bildetekst kan skrives senere |
| Leserlisten passerer 25 | Nye familiemedlemmer kommer ikke inn | Planlagt utvei: `getRoles` + Standard-plan ([§9.2](#92-fellen-som-er-verdt-å-kjenne)) |
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
5. **Test invitasjonsflyten med ett familiemedlem** før du inviterer alle. Da ser du hva
   det faktisk innebærer å bli gjestebruker i tenanten, og om det er akseptabelt.

---

## 17. Kilder

Faktagrunnlaget for [§9](#9-autentisering-og-personvern) og [§13](#kostnad), kontrollert
i august 2026:

- [Authenticate and authorize Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-authorization) — forhåndskonfigurerte leverandører (Entra ID og GitHub), invitasjoner, egendefinerte roller
- [Custom authentication in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/authentication-custom) — custom auth krever Standard-planen; egne registreringer slår av de forhåndskonfigurerte
- [Quotas in Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas) — taket på 25 brukere for egendefinerte roller; ingen grense på antall innlogginger
- [Azure Static Web Apps hosting plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans) — Free vs. Standard
- [Static Web Apps pricing](https://azure.microsoft.com/en-us/pricing/details/app-service/static/) — 100 GB kvote, overforbruk på Standard
- [Assign Static Web Apps roles with Microsoft Graph](https://learn.microsoft.com/en-us/azure/static-web-apps/assign-roles-microsoft-graph) — `rolesSource` og `getRoles`-funksjonen
- [External ID pricing](https://learn.microsoft.com/en-us/entra/external-id/external-identities-pricing) — 50 000 MAU gratis, ingen P1-lisens per gjest
- [Azure bandwidth pricing](https://azure.microsoft.com/en-us/pricing/details/bandwidth/) — 100 GB utgående trafikk gratis per måned

**Forbehold.** Punktet om at Entra-invitasjoner oppretter gjestebrukerobjekter via B2B
stammer fra Microsofts støtteforum, ikke fra produktdokumentasjonen — det er den delen av
[§9.1](#91-må-det-opprettes-brukere-i-tenanten-kreves-lisens) som er verdt å bekrefte selv
med én testinvitasjon (steg 5 i [§16](#16-neste-steg)) før hele familien inviteres.
Prisene bør alltid kontrolleres mot gjeldende prisliste.
