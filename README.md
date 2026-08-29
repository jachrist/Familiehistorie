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
  og filtrerer årslisten uten nettverkskall. Skalerer langt forbi det dette prosjektet trenger.
- **Media direkte til Blob** via kortlevde SAS-URL-er, utenom API-et. Nødvendig for video,
  og gjør bildeopplasting rask.
- **Anbefaling: hele nettstedet bak innlogging.** Innholdet handler om levende
  familiemedlemmer, og et åpent nettsted lar seg i praksis ikke angre.
- **Fase 1 gir et fullt brukbart nettsted** på anslagsvis 5–8 arbeidsdager. Tidslinje,
  persontagging og PDF-eksport er bevisst holdt utenfor.

Punktene som bør avklares før koding starter er samlet i
[§2 i dokumentet](docs/omfang-og-arkitektur.md#åpne-spørsmål-som-bør-avklares-før-koding).
