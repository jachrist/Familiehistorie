/**
 * CORS-reglene på lagringskontoen, sett fra API-et.
 *
 * Nettleseren laster bilder og video opp **direkte til Blob**, utenom API-et.
 * Det er et kryssopphav-kall, og lagringskontoen må kjenne adressen nettstedet
 * serveres fra. Gjør den ikke det, blokkerer nettleseren opplastingen før
 * forespørselen sendes – og alt man ser er «Nettverksfeil under opplasting».
 *
 * Feilen er stygg å finne fordi alt annet fungerer: bilder vises (et vanlig
 * `<img>` bryr seg ikke om CORS), sidene laster, innlogging går. Bare
 * opplasting og plakatvelgeren ryker, og begge gir en feil som ser ut som et
 * nettverksproblem.
 *
 * Den vanlige årsaken er et nytt domene. Reglene listet den gamle adressen,
 * og innstillingen ligger på **lagringskontoen**, ikke på Static Web App-en –
 * så det er ikke åpenbart hvor man skal lete.
 */
import { blobtjeneste } from "./lager.js";

export interface Corsvurdering {
  /** Opphavene lagringskontoen slipper gjennom. `*` betyr alle. */
  tillatteOpphav: string[];
  /** Adressen nettstedet ser ut til å bli servert fra. `null` når vi ikke vet. */
  opphav: string | null;
  /** Er den adressen dekket? `null` når vi ikke klarte å avgjøre det. */
  dekket: boolean | null;
  /** Satt når reglene ikke lot seg lese. */
  feil?: string;
}

/**
 * Hvilken adresse nettstedet serveres fra, sett fra en forespørsel.
 *
 * `origin` finnes bare på kryssopphav-kall, og /api/helse hentes fra samme
 * opphav. Derfor bygges adressen fra vertsnavnet i stedet. Static Web Apps
 * legger det opprinnelige vertsnavnet i `x-forwarded-host`; står det ikke der,
 * er `host` det nærmeste vi kommer.
 */
export function finnOpphav(les: (navn: string) => string | null): string | null {
  const opphav = les("origin");
  if (opphav) return opphav.toLowerCase();

  const vert = (les("x-forwarded-host") ?? les("host") ?? "").split(",")[0]?.trim();
  if (!vert) return null;

  const protokoll = (les("x-forwarded-proto") ?? "https").split(",")[0]?.trim() || "https";
  return `${protokoll}://${vert}`.toLowerCase();
}

export async function vurderCors(opphav: string | null): Promise<Corsvurdering> {
  let tillatteOpphav: string[];
  try {
    const egenskaper = await blobtjeneste().getProperties();
    tillatteOpphav = (egenskaper.cors ?? []).flatMap((regel) =>
      regel.allowedOrigins.split(",").map((o) => o.trim().toLowerCase()).filter(Boolean)
    );
  } catch (e) {
    return {
      tillatteOpphav: [],
      opphav,
      dekket: null,
      feil: e instanceof Error ? e.message.slice(0, 200) : "ukjent feil",
    };
  }

  return {
    tillatteOpphav,
    opphav,
    dekket: opphav === null ? null : tillatteOpphav.some((o) => o === "*" || o === opphav),
  };
}
