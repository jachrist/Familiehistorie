## Familiehistorie for familien Christiansen 
### Innhold og idé 
Jeg ønsker å lage en app/ nettsted som skal være organisert som en rekke like nettsider - en for hvert år som det skjedde noe spesielt.
Nye år legges til etter hvert.
Disse skal ha faste felter for tekst som omhandler hva som skjedde med familien det året, bilder og videosekvenser som er relevante.
Det skal være gui for å legge til og redigere årssidene og innholdet.
Forsiden skal vise alle de opprettede årssidene lukket - altså bare med årstallet synlig.
I tillegg skal det være en søkeboks der en kan søke i alle tekster på sidene. Søket fører til at bare årstall med match vises.
### Plattform og arkitektur 
Jeg ønsker å benytte min vanlige arkitektur - Azure Static Web app for sider, api-lag, lagring i Blob storage.

### Status
**Fase 1, trinn 1–7 er bygget.** Oppsett, kommandoer og hva som virker:
[KOM-I-GANG.md](KOM-I-GANG.md).

Krever **Node 22** — nøyaktig 22, siden Azure Functions ikke støtter Node 24 —
og **Azure Functions Core Tools v4**
(`winget install Microsoft.Azure.FunctionsCoreTools` på Windows).

```bash
npm install && npm run installer
npm run dev         # skall 1: Azurite + API + frontend
npm run seed        # skall 2: eksempeldata, første gang
```

Åpne <http://localhost:4280>.

- **Trinn 1** — Bicep og skript for lagringskonto, containere og Static Web App
- **Trinn 2** — Vite + React + TypeScript, Azure Functions, delte typer, Azurite lokalt
- **Trinn 3** — åtte API-endepunkter med ETag-samtidighet, validering fra
  `felter.json`, sanitering server-side og kortlevde SAS-URL-er
- **Trinn 4** — forsiden: årsliste gruppert på tiår, utfolding på stedet, permalenker
- **Trinn 5** — årsside med tekstfelter og mediegalleri
- **Trinn 6** — redigering: skjema generert fra `felter.json`, rik tekst, autolagring
- **Trinn 7** — masseopplasting med nedskalering, EXIF, fremdrift og bildetekstliste

Trinn 8–11 gjenstår. `npm run proev` kjører en røykprøve av API-et mot Azurite.

> **Ingen innlogging før trinn 9.** Ikke last opp ekte familiebilder ennå.

### Omfang og implementering
Et gjennomarbeidet forslag til avgrensing, informasjonsmodell, arkitektur og faseplan
ligger i **[docs/omfang-og-arkitektur.md](docs/omfang-og-arkitektur.md)**.

Kort oppsummert:

- **Ingen database.** Hvert år lagres som ett JSON-dokument i Blob Storage, med et lite
  indeksdokument som driver forsiden og søket. Innholdet er dermed lesbart, flyttbart og
  enkelt å sikkerhetskopiere.
- **Faste felter som data, ikke kode.** En `felter.json` beskriver tekstfeltene, og både
  redigeringsskjemaet og visningen genereres fra den — nye felter kan legges til uten
  kodeendring.
- **Søk i nettleseren.** Forsiden laster indeksdokumentet uansett, så søket kjøres lokalt
  og filtrerer årslisten uten nettverkskall.
- **Media direkte til Blob** via kortlevde SAS-URL-er, utenom API-et. Nødvendig for video,
  og holder videotrafikken utenfor Static Web Apps-kvoten.
- **Alt innhold bak innlogging med engangskode på e-post**, etter samme mønster som våre
  øvrige løsninger. Roller styres fra en tilgangsliste som redigeres i appen.
- **Fase 1 gir et fullt brukbart nettsted** på anslagsvis 7–10 arbeidsdager.

### Dimensjonering
Omfanget er avklart: ~160 års spenn, **rundt 90 årssider**, 5–10 minutter video per år
(**~11 timer** totalt) og **~2 250 bilder**. Én redaktør. Alt materiale klippes og lastes
inn manuelt, fra hver enkelt årsside.

Det gir to konkrete konsekvenser for byggingen:

- **Video må transkodes før opplasting.** Forskjellen mellom råfiler og 1080p H.264 er
  2,5 TB mot 30 GB. Klippingen skal uansett gjøres manuelt, så transkodingen legges inn i
  samme operasjon — [ferdig `ffmpeg`-kommando i §11](docs/omfang-og-arkitektur.md#video).
- **Masseopplasting og EXIF-avlesning er flyttet inn i fase 1.** Med 2 250 bilder er det
  forskjellen på en overkommelig og en uutholdelig jobb.

Søket, datamodellen og kostnadsbildet holder som beskrevet — samlet lagring lander på
~35–50 GB, altså rundt 1 USD i måneden.

### Innlogging
Innlogging skjer med **engangskode på e-post**, etter samme mønster som våre øvrige
løsninger, og sesjonen ligger i en `httpOnly; Secure; SameSite=Strict`-informasjonskapsel.
Det fjerner hele tenant-, lisens- og plandiskusjonen: ingen brukere i tenanten, ingen
lisenser, intet tak på antall lesere, og gratisplanen holder uansett hvor mange familien
blir.

Kapselen er både sikrere og enklere enn å lagre tokenet i `localStorage`. Sikrere fordi
skript ikke kan lese sesjonen og sende den ut av nettleseren. Enklere fordi klienten ikke
har noe å lagre eller feste på hver forespørsel — app og API deler opphav, så nettleseren
sender den selv. Til gjengjeld trengs `GET /api/meg` ved oppstart, siden klienten ikke kan
lese kapselen for å vite hvem som er innlogget.

Én ting endrer seg strukturelt: **`allowedRoles` i `staticwebapp.config.json` slutter å
virke**, siden Static Web Apps ikke kjenner et token vi utsteder selv. All adgangskontroll
flytter inn i Functions-laget, bak en delt hjelper som håndhever både rolle og
`Content-Type`. App-skallet blir dermed offentlig hentbart — det inneholder ingenting, men
trenger `noindex` og en `robots.txt`. Mediehåndteringen med kortlevde SAS-URL-er er uendret.

**XSS er fortsatt den viktige risikoen.** Kapselen hindrer at sesjonen kan stjeles og
brukes senere, men ikke at et skript på siden handler som den innloggede mens fanen er
åpen. Sanitering av rik tekst server-side og en streng CSP er derfor uansett påkrevd.
Detaljer i [§9](docs/omfang-og-arkitektur.md#9-autentisering-og-personvern).
