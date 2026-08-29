/**
 * Lager api/local.settings.json fra eksempelet hvis den mangler.
 *
 * Filen er gitignorert fordi den normalt inneholder hemmeligheter. Vår
 * inneholder bare «UseDevelopmentStorage=true», men konvensjonen beholdes –
 * det er der ekte nøkler havner den dagen noen legger inn en.
 *
 * Uten den spør `func start` om hvilket språk prosjektet er skrevet i, i stedet
 * for å starte.
 */
import { copyFileSync, existsSync } from "node:fs";
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
