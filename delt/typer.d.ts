/**
 * Delte typer mellom frontend (app/) og API (api/).
 *
 * Bevisst en .d.ts: filen inneholder bare typer, produserer ingen JavaScript,
 * og kan derfor importeres fra begge prosjekter uten byggoppsett eller
 * monorepo-verktøy. Legges det runtime-kode her, må det gjøres om.
 */

/** Felttyper som redigerings-GUI-et og visningen kan gjengi. */
export type Felttype = "kort_tekst" | "rik_tekst";

/** Ett felt i årsskjemaet, definert i innhold/felter.json. */
export interface Feltdefinisjon {
  id: string;
  etikett: string;
  type: Felttype;
  paakrevd?: boolean;
  hjelp?: string;
}

/** Hele feltskjemaet. Driver både redigeringsskjema og visning. */
export interface Feltskjema {
  versjon: number;
  felter: Feltdefinisjon[];
}

export type Medietype = "bilde" | "video";

export interface Medieobjekt {
  /** ULID – gir både unikhet og kronologisk sortering. */
  id: string;
  type: Medietype;
  /** Sti i media-containeren, uten SAS. */
  fil: string;
  miniatyr?: string | null;
  /** Plakatbilde for video. */
  plakat?: string | null;
  bildetekst?: string;
  /** ISO-dato, fylles fra EXIF når den finnes. */
  tatt?: string | null;
  bredde?: number | null;
  hoyde?: number | null;
  /** Sekunder, for video. */
  varighet?: number | null;
  rekkefolge: number;
}

/**
 * Medieobjekt slik API-et returnerer det: samme felter, men med kortlevde
 * lese-URL-er lagt på. Disse lagres aldri.
 */
export interface MedieobjektMedUrl extends Medieobjekt {
  url: string;
  miniatyrUrl?: string | null;
  plakatUrl?: string | null;
}

export type Aarsstatus = "utkast" | "publisert";

/** Ett årsdokument slik det ligger i innhold/aar/<aar>.json. */
export interface Aarsdokument {
  aar: number;
  /** Nøkler svarer til Feltdefinisjon.id. */
  felter: Record<string, string>;
  media: Medieobjekt[];
  status: Aarsstatus;
  opprettet: string;
  endret: string;
  endretAv: string;
  skjemaversjon: number;
}

/** Årsdokument slik GET /api/aar/{aar} leverer det. */
export interface AarsdokumentMedUrl extends Omit<Aarsdokument, "media"> {
  media: MedieobjektMedUrl[];
  /** Blobens ETag. Sendes tilbake som If-Match ved lagring. */
  etag: string;
}

/** Det klienten sender ved lagring – serveren eier resten av feltene. */
export interface AarsdokumentInn {
  felter: Record<string, string>;
  media: Medieobjekt[];
  status?: Aarsstatus;
}

/** Én rad i indeksdokumentet. Alt forsiden og søket trenger. */
export interface Indeksrad {
  aar: number;
  tittel: string;
  sammendrag: string;
  antallBilder: number;
  antallVideoer: number;
  /** All tekst flatet ut og normalisert. Brukes av søket i trinn 8. */
  sok: string;
}

export interface Indeks {
  generert: string;
  aar: Indeksrad[];
}

/** Én fil klienten vil laste opp. */
export interface Opplastingsforesporsel {
  aar: number;
  filer: { filnavn: string; type: string }[];
}

export interface Opplastingsmaal {
  /** Sti i media-containeren – lagres i årsdokumentet. */
  fil: string;
  /** Full URL med skrive-SAS. Kortlevd. */
  opplastingsUrl: string;
}

export interface Opplastingssvar {
  maal: Opplastingsmaal[];
  utloper: string;
}

/** Feilsvar fra API-et. Meldingen er ment å kunne vises til bruker. */
export interface Apifeil {
  feil: string;
  detaljer?: unknown;
}

/** Roller. `redaktoer` innebærer `familie`. */
export type Rolle = "familie" | "redaktoer";

/** Én person i innhold/tilgang.json. */
export interface Person {
  epost: string;
  navn: string;
  roller: Rolle[];
}

export interface Tilgangsliste {
  personer: Person[];
}

/** Tilgangslisten slik API-et leverer den, med ETag for samtidighet. */
export interface TilgangslisteMedEtag extends Tilgangsliste {
  etag: string;
}

/** Svaret fra GET /api/meg. 401 når ingen er innlogget. */
export interface Innlogget {
  epost: string;
  navn: string;
  roller: Rolle[];
}

/**
 * Én sikkerhetskopi, slik den vises i listen på admin-siden.
 *
 * Kopien dekker det som er skrevet for hånd – årene, feltskjemaet og
 * tilgangslisten. Mediefilene kopieres ikke, men listes med sti og størrelse,
 * så en gjenoppretting kan si hva som mangler. Bildene er beskyttet av
 * versjonering og angrefrist på lagringskontoen i stedet, og en kopi av dem for
 * hver sikkerhetskopi ville doblet lagringen for hver knapp man trykker på.
 */
export interface Sikkerhetskopi {
  /** `2026-09-07T143205`. Sorterer kronologisk som ren tekst. */
  id: string;
  tidspunkt: string;
  tattAv: string;
  /** Hvorfor den ble tatt – «Manuell» eller «Før tømming». */
  grunn: string;
  antallAar: number;
  antallMediefiler: number;
  mediebytes: number;
  versjon: number;
  /** Størrelsen på selve kopien. Settes når den er skrevet. */
  bytes: number;
}

/** Filen som lastes ned. Samme opplysninger, pluss innholdet. */
export interface Sikkerhetskopiinnhold extends Omit<Sikkerhetskopi, "bytes"> {
  felter: Feltskjema | null;
  tilgang: Tilgangsliste | null;
  aar: Aarsdokument[];
  mediefiler: { sti: string; bytes: number }[];
}

/** Hva en tømming ville tatt, eller tok. */
export interface Telling {
  aar: number;
  indeks: number;
  media: number;
  originaler: number;
  sum: number;
}

export interface Tommesvar {
  torrkjoring: boolean;
  telling: Telling;
  slettet: number;
  /** Over taket per kall. Kjør en gang til for resten. */
  gjenstaar: number;
  /** Tas alltid før noe slettes. `null` bare ved tørrkjøring. */
  sikkerhetskopi: Sikkerhetskopi | null;
}

export interface Gjenopprettingssvar {
  /** Antall år som ble skrevet tilbake. */
  aar: number;
  felter: boolean;
  fra: string;
  /** Av innholdet slik det var rett før. */
  sikkerhetskopi: Sikkerhetskopi;
}

export interface Ryddesvar {
  ubrukte: string[];
  slettet: number;
  torrkjoring: boolean;
}
