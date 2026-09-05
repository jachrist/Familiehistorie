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
