/**
 * Engangskoder og rate-limiting.
 *
 * Et sekssifret tall har en million kombinasjoner. Uten tak på forsøk og på hvor
 * ofte en kode kan bestilles, er det et brukbart brute-force-mål – derfor er
 * begge tellerne obligatoriske og ikke en senere forbedring.
 *
 * Koden lagres aldri i klartekst. Det gir lite mot en angriper som allerede har
 * lest lagringskontoen, men det hindrer at en gyldig kode blir liggende synlig i
 * en tabellvisning eller en sikkerhetskopi.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { TABELL, erIkkeFunnet, tabell } from "./tabell.js";

export const KODE_LEVETID_MINUTTER = 10;
export const MAKS_FORSOK = 5;
export const MAKS_BESTILLINGER_PER_TIME = 5;

const PARTISJON = "v1";

interface Koderad {
  partitionKey: string;
  rowKey: string;
  hash: string;
  utloper: string;
  forsok: number;
}

interface Sperrerad {
  partitionKey: string;
  rowKey: string;
  antall: number;
  vindusstart: string;
}

/**
 * RowKey tåler ikke `/`, `\`, `#` eller `?`, og en e-postadresse er dessuten
 * personopplysning vi ikke trenger å ha liggende i en tabell. Nøkkelen er derfor
 * et hashet oppslag, ikke adressen selv.
 */
function noekkel(epost: string): string {
  return createHmac("sha256", hemmelighet()).update(epost.trim().toLowerCase()).digest("hex");
}

function hemmelighet(): string {
  const raa = process.env.SESJON_HEMMELIGHET;
  if (!raa || raa.trim().length < 32) {
    throw new Error("SESJON_HEMMELIGHET mangler eller er for kort (minst 32 tegn).");
  }
  return raa;
}

function hashKode(epost: string, kode: string): string {
  return createHmac("sha256", hemmelighet())
    .update(`${epost.trim().toLowerCase()}:${kode}`)
    .digest("hex");
}

/**
 * Teller bestillinger i et rullende timesvindu. Returnerer `false` når taket er
 * nådd – da sendes ingen e-post, men klienten får likevel samme svar som ellers.
 */
export async function kanBestille(epost: string): Promise<boolean> {
  const klient = await tabell(TABELL.sperrer);
  const rowKey = noekkel(epost);
  const naa = Date.now();

  let rad: Sperrerad | undefined;
  try {
    rad = await klient.getEntity<Sperrerad>(PARTISJON, rowKey);
  } catch (e) {
    if (!erIkkeFunnet(e)) throw e;
  }

  const vindusstart = rad ? Date.parse(rad.vindusstart) : Number.NaN;
  const iVindu = Number.isFinite(vindusstart) && naa - vindusstart < 60 * 60_000;
  const antall = iVindu ? (rad?.antall ?? 0) : 0;

  if (antall >= MAKS_BESTILLINGER_PER_TIME) return false;

  await klient.upsertEntity<Sperrerad>(
    {
      partitionKey: PARTISJON,
      rowKey,
      antall: antall + 1,
      vindusstart: new Date(iVindu ? vindusstart : naa).toISOString(),
    },
    "Replace"
  );
  return true;
}

/**
 * Lager en ny kode og lagrer den. En eventuell tidligere kode for samme adresse
 * blir overskrevet – bestiller man en ny kode, er det den nye som gjelder.
 */
export async function lagKode(epost: string): Promise<string> {
  const kode = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const klient = await tabell(TABELL.koder);

  await klient.upsertEntity<Koderad>(
    {
      partitionKey: PARTISJON,
      rowKey: noekkel(epost),
      hash: hashKode(epost, kode),
      utloper: new Date(Date.now() + KODE_LEVETID_MINUTTER * 60_000).toISOString(),
      forsok: 0,
    },
    "Replace"
  );

  return kode;
}

export type Kodesvar = "ok" | "feil_kode" | "utlopt" | "for_mange_forsok";

/**
 * Sjekker en kode, og forbruker den ved treff. Feil kode teller opp forsøk;
 * etter `MAKS_FORSOK` forkastes koden helt, slik at en ny må bestilles.
 */
export async function bekreftKode(epost: string, kode: string): Promise<Kodesvar> {
  const klient = await tabell(TABELL.koder);
  const rowKey = noekkel(epost);

  let rad: Koderad;
  try {
    rad = await klient.getEntity<Koderad>(PARTISJON, rowKey);
  } catch (e) {
    if (erIkkeFunnet(e)) return "utlopt";
    throw e;
  }

  if (Date.parse(rad.utloper) < Date.now()) {
    await klient.deleteEntity(PARTISJON, rowKey).catch(() => undefined);
    return "utlopt";
  }

  const forventet = Buffer.from(rad.hash, "utf8");
  const faktisk = Buffer.from(hashKode(epost, kode), "utf8");
  const treff = forventet.length === faktisk.length && timingSafeEqual(forventet, faktisk);

  if (treff) {
    await klient.deleteEntity(PARTISJON, rowKey).catch(() => undefined);
    return "ok";
  }

  const forsok = (rad.forsok ?? 0) + 1;
  if (forsok >= MAKS_FORSOK) {
    await klient.deleteEntity(PARTISJON, rowKey).catch(() => undefined);
    return "for_mange_forsok";
  }

  await klient.updateEntity<Koderad>({ ...rad, forsok }, "Replace");
  return "feil_kode";
}
