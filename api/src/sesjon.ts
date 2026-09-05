/**
 * Sesjonstoken og informasjonskapsel.
 *
 * Tokenet er identitet og ingenting mer: e-postadresse og utstedelsestidspunkt,
 * signert med HMAC-SHA256. Roller ligger *ikke* i tokenet – de slås opp i
 * tilgangslisten ved hvert kall, slik at det å fjerne noen fra listen virker med
 * en gang og ikke om tretti dager (§9.4).
 *
 * Kapselen er `HttpOnly`, så klienten kan verken lese eller sette den. Det er
 * hele poenget: et skript på siden får ikke tak i legitimasjon som overlever at
 * fanen lukkes.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const KAPSELNAVN = "fh_sesjon";

/** Tretti dager. Fornyes ved bruk, se `børFornyes()`. */
export const LEVETID_SEKUNDER = 30 * 24 * 60 * 60;

/** Fornyes når den er eldre enn ett døgn – ikke ved hvert eneste kall. */
const FORNY_ETTER_MS = 24 * 60 * 60 * 1000;

/** Formatversjon. Økes den, blir alle utestående sesjoner ugyldige. */
const VERSJON = 1;

interface Innmat {
  v: number;
  /** E-postadresse, alltid små bokstaver. */
  e: string;
  /** Utstedt, millisekunder siden epoke. */
  u: number;
}

function hemmelighet(): Buffer {
  const raa = process.env.SESJON_HEMMELIGHET;
  if (!raa || raa.trim().length < 32) {
    throw new Error(
      "SESJON_HEMMELIGHET mangler eller er for kort (minst 32 tegn). " +
        "Lokalt lages den av `npm run forbered`; i Azure settes den som appinnstilling."
    );
  }
  return Buffer.from(raa, "utf8");
}

/**
 * `Secure` slås av lokalt fordi nettleserne behandler flagget ulikt over
 * http://localhost. Standarden er på – et miljø som ikke er satt opp skal feile
 * på den trygge siden.
 */
function erLokalt(): boolean {
  return (process.env.MILJO ?? "drift").toLowerCase() === "lokalt";
}

function b64url(data: Buffer): string {
  return data.toString("base64url");
}

function signer(nyttelast: string): string {
  return b64url(createHmac("sha256", hemmelighet()).update(nyttelast).digest());
}

export function utstedToken(epost: string): string {
  const innmat: Innmat = { v: VERSJON, e: epost.toLowerCase(), u: Date.now() };
  const nyttelast = b64url(Buffer.from(JSON.stringify(innmat), "utf8"));
  return `${nyttelast}.${signer(nyttelast)}`;
}

export interface GyldigSesjon {
  epost: string;
  utstedt: number;
}

/** Returnerer `undefined` for alt som ikke er et gyldig, ikke-utløpt token. */
export function lesToken(token: string | undefined): GyldigSesjon | undefined {
  if (!token) return undefined;

  const skille = token.indexOf(".");
  if (skille < 1) return undefined;

  const nyttelast = token.slice(0, skille);
  const signatur = token.slice(skille + 1);

  const forventet = Buffer.from(signer(nyttelast), "utf8");
  const faktisk = Buffer.from(signatur, "utf8");
  // Lengdene må sammenlignes først: timingSafeEqual kaster på ulik lengde.
  if (forventet.length !== faktisk.length) return undefined;
  if (!timingSafeEqual(forventet, faktisk)) return undefined;

  let innmat: Innmat;
  try {
    innmat = JSON.parse(Buffer.from(nyttelast, "base64url").toString("utf8")) as Innmat;
  } catch {
    return undefined;
  }

  if (innmat.v !== VERSJON) return undefined;
  if (typeof innmat.e !== "string" || typeof innmat.u !== "number") return undefined;
  if (Date.now() - innmat.u > LEVETID_SEKUNDER * 1000) return undefined;

  return { epost: innmat.e, utstedt: innmat.u };
}

export function boerFornyes(sesjon: GyldigSesjon): boolean {
  return Date.now() - sesjon.utstedt > FORNY_ETTER_MS;
}

/**
 * `Path=/api` gjør at kapselen ikke følger med bilder, CSS og JS, og
 * `SameSite=Strict` at den aldri sendes fra et annet nettsted. Sammen med
 * kravet om `application/json` på skriveoperasjoner (se vakt.ts) er det
 * CSRF-vernet – egne CSRF-tokener er da unødvendige.
 */
export function settKapsel(token: string): string {
  const deler = [
    `${KAPSELNAVN}=${token}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/api",
    `Max-Age=${LEVETID_SEKUNDER}`,
  ];
  if (!erLokalt()) deler.push("Secure");
  return deler.join("; ");
}

export function fjernKapsel(): string {
  const deler = [`${KAPSELNAVN}=`, "HttpOnly", "SameSite=Strict", "Path=/api", "Max-Age=0"];
  if (!erLokalt()) deler.push("Secure");
  return deler.join("; ");
}

/** Plukker én kapsel ut av Cookie-hodet. */
export function kapselFra(cookieHode: string | null | undefined, navn = KAPSELNAVN): string | undefined {
  if (!cookieHode) return undefined;
  for (const bit of cookieHode.split(";")) {
    const skille = bit.indexOf("=");
    if (skille < 0) continue;
    if (bit.slice(0, skille).trim() === navn) return bit.slice(skille + 1).trim();
  }
  return undefined;
}
