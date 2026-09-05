/**
 * Lager api/local.settings.json fra eksempelet hvis den mangler, og fyller inn
 * de innstillingene som ikke kan stå i et eksempel.
 *
 * Filen er gitignorert fordi den inneholder hemmeligheter – fra trinn 9 gjør
 * den faktisk det: signeringsnøkkelen for sesjonstokenet lages her, tilfeldig
 * per maskin. Den skal aldri sjekkes inn, og den samme nøkkelen brukes ikke i
 * Azure; der settes SESJON_HEMMELIGHET som appinnstilling.
 *
 * Uten local.settings.json spør `func start` om hvilket språk prosjektet er
 * skrevet i, i stedet for å starte.
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");
const maal = join(rot, "api", "local.settings.json");
const kilde = join(rot, "api", "local.settings.json.eksempel");

if (existsSync(maal)) {
  console.log("api/local.settings.json finnes allerede – lar den være.");
} else {
  copyFileSync(kilde, maal);
  console.log("✓ opprettet api/local.settings.json");
}

// Kjøres også på en fil som finnes fra før, slik at et eldre oppsett får de nye
// nøklene uten at noen må lete etter hva som mangler.
const innstillinger = JSON.parse(readFileSync(maal, "utf8"));
innstillinger.Values ??= {};

let endret = false;

if (!innstillinger.Values.SESJON_HEMMELIGHET) {
  innstillinger.Values.SESJON_HEMMELIGHET = randomBytes(32).toString("base64url");
  console.log("✓ la inn en tilfeldig SESJON_HEMMELIGHET");
  endret = true;
}

if (!innstillinger.Values.MILJO) {
  // Slår av Secure-flagget på sesjonskapselen. Nettleserne behandler flagget
  // ulikt over http://localhost, og standarden er «drift», altså på.
  innstillinger.Values.MILJO = "lokalt";
  console.log("✓ satte MILJO=lokalt");
  endret = true;
}

if (endret) {
  writeFileSync(maal, `${JSON.stringify(innstillinger, null, 2)}\n`, "utf8");
}
