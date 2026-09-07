/**
 * Typet klient mot /api.
 *
 * Ingen sesjonshåndtering her: fra trinn 9 ligger sesjonen i en
 * httpOnly-kapsel som nettleseren sender selv.
 */
import type {
  AarsdokumentInn,
  AarsdokumentMedUrl,
  Feltskjema,
  Gjenopprettingssvar,
  Indeks,
  Innlogget,
  Opplastingsforesporsel,
  Opplastingssvar,
  Ryddesvar,
  Sikkerhetskopi,
  Tilgangsliste,
  TilgangslisteMedEtag,
  Tommesvar,
} from "../../../delt/typer.js";

export class Apifeil extends Error {
  constructor(
    readonly status: number,
    melding: string,
    readonly detaljer?: unknown
  ) {
    super(melding);
    this.name = "Apifeil";
  }
  /** Sann når året er endret et annet sted siden vi hentet det. */
  get erKonflikt() {
    return this.status === 409 || this.status === 412;
  }
  /** Sann når sesjonen mangler eller er utløpt. */
  get erUinnlogget() {
    return this.status === 401;
  }
}

async function hent<T>(sti: string, init?: RequestInit): Promise<T> {
  let svar: Response;
  try {
    svar = await fetch(sti, { credentials: "same-origin", ...init });
  } catch {
    throw new Apifeil(0, "Fikk ikke kontakt med serveren. Er du på nett?");
  }

  if (!svar.ok) {
    let melding = `Noe gikk galt (${svar.status}).`;
    let detaljer: unknown;
    try {
      const kropp = (await svar.json()) as { feil?: string; detaljer?: unknown };
      if (kropp.feil) melding = kropp.feil;
      detaljer = kropp.detaljer;
    } catch {
      // Serveren svarte ikke JSON. Standardmeldingen over er da det beste vi har.
    }
    throw new Apifeil(svar.status, melding, detaljer);
  }

  if (svar.status === 204) return undefined as T;
  return (await svar.json()) as T;
}

const JSONHODER = { "content-type": "application/json" };

export const api = {
  /** Hvem er innlogget. Kaster Apifeil med status 401 når ingen er det. */
  meg: () => hent<Innlogget>("/api/meg"),

  bestillKode: (epost: string) =>
    hent<{ sendt: boolean; gyldigMinutter: number; beskjed: string }>("/api/auth/kode", {
      method: "POST",
      headers: JSONHODER,
      body: JSON.stringify({ epost }),
    }),

  verifiserKode: (epost: string, kode: string) =>
    hent<Innlogget>("/api/auth/verifiser", {
      method: "POST",
      headers: JSONHODER,
      body: JSON.stringify({ epost, kode }),
    }),

  loggUt: () =>
    hent<{ loggetUt: boolean }>("/api/auth/logg-ut", {
      method: "POST",
      headers: JSONHODER,
      body: "{}",
    }),

  tilgang: () => hent<TilgangslisteMedEtag>("/api/tilgang"),

  lagreTilgang: (liste: Tilgangsliste, etag: string) =>
    hent<TilgangslisteMedEtag>("/api/tilgang", {
      method: "PUT",
      headers: { ...JSONHODER, "If-Match": etag },
      body: JSON.stringify(liste),
    }),

  indeks: () => hent<Indeks>("/api/indeks"),
  felter: () => hent<Feltskjema>("/api/felter"),
  aar: (aar: number) => hent<AarsdokumentMedUrl>(`/api/aar/${aar}`),

  /** `etag` utelates ved oppretting; da avviser API-et hvis året finnes. */
  lagreAar: (aar: number, dok: AarsdokumentInn, etag?: string) =>
    hent<AarsdokumentMedUrl>(`/api/aar/${aar}`, {
      method: "PUT",
      headers: etag ? { ...JSONHODER, "If-Match": etag } : JSONHODER,
      body: JSON.stringify(dok),
    }),

  slettAar: (aar: number) =>
    hent<{ slettet: number }>(`/api/aar/${aar}`, { method: "DELETE" }),

  opplastingsmaal: (foresporsel: Opplastingsforesporsel) =>
    hent<Opplastingssvar>("/api/media/opplasting", {
      method: "POST",
      headers: JSONHODER,
      body: JSON.stringify(foresporsel),
    }),

  ryddMedia: (slett: boolean) =>
    hent<Ryddesvar>(`/api/vedlikehold/rydd-media${slett ? "?slett=ja" : ""}`, {
      method: "POST",
      headers: JSONHODER,
      body: "{}",
    }),

  sikkerhetskopier: () =>
    hent<{ kopier: Sikkerhetskopi[] }>("/api/vedlikehold/sikkerhetskopi"),

  taSikkerhetskopi: () =>
    hent<Sikkerhetskopi>("/api/vedlikehold/sikkerhetskopi", {
      method: "POST",
      headers: JSONHODER,
      body: "{}",
    }),

  /**
   * Lenke, ikke kall: nedlastingen skal skje som en vanlig navigasjon, så
   * nettleseren tilbyr «Lagre i Filer» i stedet for at appen må bygge en fil i
   * minnet. Kapselen følger med fordi det er samme opphav.
   */
  sikkerhetskopiUrl: (id: string) => `/api/vedlikehold/sikkerhetskopi/${id}`,

  gjenopprett: (id: string, bekreft: number) =>
    hent<Gjenopprettingssvar>("/api/vedlikehold/gjenopprett", {
      method: "POST",
      headers: JSONHODER,
      body: JSON.stringify({ id, bekreft }),
    }),

  /** Uten `bekreft` er kallet en tørrkjøring og sletter ingenting. */
  tom: (media: boolean, bekreft?: number) =>
    hent<Tommesvar>("/api/vedlikehold/tom", {
      method: "POST",
      headers: JSONHODER,
      body: JSON.stringify(bekreft === undefined ? { media } : { media, bekreft }),
    }),
};

/** Nøkler for TanStack Query. Samlet ett sted så invalidering blir presis. */
export const noekler = {
  meg: ["meg"] as const,
  tilgang: ["tilgang"] as const,
  indeks: ["indeks"] as const,
  sikkerhetskopier: ["sikkerhetskopier"] as const,
  felter: ["felter"] as const,
  aar: (aar: number) => ["aar", aar] as const,
};
