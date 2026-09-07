/**
 * Sikkerhetskopi av det som er skrevet for hånd.
 *
 * En kopi dekker årene, feltskjemaet og tilgangslisten – alt som ikke kan
 * hentes tilbake fra noe annet sted. Indeksen er utelatt med vilje: den er
 * avledet, og bygges på nytt av API-et ved første oppslag.
 *
 * Mediefilene kopieres **ikke**. De ligger allerede i en konto med versjonering
 * og angrefrist, originalene finnes på kameraene og telefonene de kom fra, og en
 * kopi av hele mediemappen for hvert knappetrykk ville doblet lagringen hver
 * gang. I stedet listes hver fil med sti og størrelse, så en gjenoppretting kan
 * si nøyaktig hva som mangler i stedet for å oppdage det ett bilde av gangen.
 *
 * Hver kopi ligger som to blober: `manifest.json` (nøkkeltallene, som listen
 * leser) og `data.json` (alt). Manifestet skrives sist – en kopi uten manifest
 * er en kopi som ikke ble ferdig, og den blir ikke med i listen.
 */
import type {
  Aarsdokument,
  Feltskjema,
  Sikkerhetskopi,
  Sikkerhetskopiinnhold,
  Tilgangsliste,
} from "../../delt/typer.js";
import {
  CONTAINER,
  STI,
  container,
  lesJson,
  lesTekst,
  listAarstall,
  listBlober,
  listMedStorrelse,
  skrivJson,
  skrivTekst,
  slettBlob,
} from "./lager.js";
import { iPuljer } from "./puljer.js";

export const VERSJON = 1;

/** Eldre kopier ryddes bort. De er små, men ikke uendelig små. */
const MAKS_KOPIER = 60;

const MANIFEST = "manifest.json";
const DATA = "data.json";

/** `2026-09-07T143205`. Sorterer kronologisk som ren tekst. */
export function lagId(naa = new Date()): string {
  return naa.toISOString().slice(0, 19).replace(/:/g, "");
}

/** Strengt, fordi id-en kommer fra URL-en og blir til en blobsti. */
export function erGyldigId(id: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{6}$/.test(id);
}

async function sikreContainer(): Promise<void> {
  await container(CONTAINER.sikkerhetskopi).createIfNotExists();
}

/**
 * Id-en har sekundoppløsning, og to kopier kan havne i samme sekund – en manuell
 * rett før en tømming, for eksempel. Da ville den ene skrevet over den andre i
 * stillhet. Er tidspunktet opptatt, flyttes kopien ett sekund fram til den får
 * et for seg selv.
 */
async function ledigId(): Promise<string> {
  const klient = container(CONTAINER.sikkerhetskopi);
  let naa = Date.now();

  for (let forsok = 0; forsok < 120; forsok++, naa += 1000) {
    const id = lagId(new Date(naa));
    if (!(await klient.getBlockBlobClient(`${id}/${DATA}`).exists())) return id;
  }
  throw new Error("Fant ikke et ledig tidspunkt for sikkerhetskopien.");
}

export async function taSikkerhetskopi(tattAv: string, grunn: string): Promise<Sikkerhetskopi> {
  await sikreContainer();

  const aarstall = await listAarstall();
  const lest = await iPuljer(aarstall, 8, (aar) =>
    lesJson<Aarsdokument>(CONTAINER.innhold, STI.aar(aar))
  );
  const aar = lest.flatMap((l) => (l ? [l.verdi] : []));

  const felter = (await lesJson<Feltskjema>(CONTAINER.innhold, STI.felter))?.verdi ?? null;
  const tilgang = (await lesJson<Tilgangsliste>(CONTAINER.innhold, STI.tilgang))?.verdi ?? null;
  const mediefiler = await listMedStorrelse(CONTAINER.media);

  const id = await ledigId();
  const innhold: Sikkerhetskopiinnhold = {
    id,
    tidspunkt: new Date().toISOString(),
    tattAv,
    grunn,
    versjon: VERSJON,
    antallAar: aar.length,
    antallMediefiler: mediefiler.length,
    mediebytes: mediefiler.reduce((sum, m) => sum + m.bytes, 0),
    felter,
    tilgang,
    aar,
    mediefiler,
  };

  const tekst = JSON.stringify(innhold, null, 2);
  await skrivTekst(
    CONTAINER.sikkerhetskopi,
    `${id}/${DATA}`,
    tekst,
    "application/json; charset=utf-8"
  );

  const manifest: Sikkerhetskopi = {
    id: innhold.id,
    tidspunkt: innhold.tidspunkt,
    tattAv: innhold.tattAv,
    grunn: innhold.grunn,
    versjon: innhold.versjon,
    antallAar: innhold.antallAar,
    antallMediefiler: innhold.antallMediefiler,
    mediebytes: innhold.mediebytes,
    bytes: Buffer.byteLength(tekst),
  };
  await skrivTekst(
    CONTAINER.sikkerhetskopi,
    `${id}/${MANIFEST}`,
    JSON.stringify(manifest, null, 2),
    "application/json; charset=utf-8"
  );

  await ryddGamle();
  return manifest;
}

/** Nyeste først. */
export async function listSikkerhetskopier(): Promise<Sikkerhetskopi[]> {
  const stier = (await listBlober(CONTAINER.sikkerhetskopi)).filter((s) =>
    s.endsWith(`/${MANIFEST}`)
  );

  const lest = await iPuljer(stier, 8, (sti) =>
    lesJson<Sikkerhetskopi>(CONTAINER.sikkerhetskopi, sti)
  );

  return lest
    .flatMap((l) => (l ? [l.verdi] : []))
    .sort((a, b) => b.id.localeCompare(a.id));
}

/** Selve filen, som tekst. Den lastes ned uendret – ingen omforming. */
export async function hentSikkerhetskopi(id: string): Promise<string | undefined> {
  if (!erGyldigId(id)) return undefined;
  return (await lesTekst(CONTAINER.sikkerhetskopi, `${id}/${DATA}`))?.verdi;
}

/** Kopien som objekt, til gjenoppretting. */
export async function lesInnhold(id: string): Promise<Sikkerhetskopiinnhold | undefined> {
  const tekst = await hentSikkerhetskopi(id);
  return tekst === undefined ? undefined : (JSON.parse(tekst) as Sikkerhetskopiinnhold);
}

/**
 * Skriver årene og feltskjemaet tilbake.
 *
 * To ting gjøres bevisst ikke:
 *
 * **Tilgangslisten røres ikke.** En gammel liste kan mangle den som står og
 * gjenoppretter, og da er man låst ute av det eneste stedet listen kan endres.
 * Den ligger i den nedlastede filen for den som trenger den.
 *
 * **År som er kommet til etterpå, slettes ikke.** En gjenoppretting skriver
 * over, den nullstiller ikke – ellers ville et uhell her kostet mer enn det
 * reparerte. Vil man ha arkivet nøyaktig slik det var, tømmer man først.
 */
export async function gjenopprett(
  innhold: Sikkerhetskopiinnhold
): Promise<{ aar: number; felter: boolean }> {
  if (innhold.felter) {
    await skrivJson(CONTAINER.innhold, STI.felter, innhold.felter);
  }

  await iPuljer(innhold.aar, 8, (dok) =>
    skrivJson(CONTAINER.innhold, STI.aar(dok.aar), dok)
  );

  return { aar: innhold.aar.length, felter: Boolean(innhold.felter) };
}

async function ryddGamle(): Promise<void> {
  const kopier = await listSikkerhetskopier();
  const gamle = kopier.slice(MAKS_KOPIER);
  for (const kopi of gamle) {
    await slettBlob(CONTAINER.sikkerhetskopi, `${kopi.id}/${DATA}`);
    await slettBlob(CONTAINER.sikkerhetskopi, `${kopi.id}/${MANIFEST}`);
  }
}
