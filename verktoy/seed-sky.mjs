/**
 * Kjører seed.mjs mot Azure i stedet for Azurite, ved å hente
 * tilkoblingsstrengen fra az CLI. Ligger som eget skript for at det skal være
 * et bevisst valg å skrive til skyen.
 */
import { execFileSync, execFileSync as kjor } from "node:child_process";

const RESSURSGRUPPE = process.env.RESSURSGRUPPE ?? "rg-familiehistorie";
const PREFIKS = process.env.PREFIKS ?? "famhist";
const LAGERNAVN = process.env.LAGERNAVN ?? `${PREFIKS}lager`;

function az(...argumenter) {
  try {
    return execFileSync("az", argumenter, { encoding: "utf8" }).trim();
  } catch (e) {
    console.error(`az ${argumenter[0]} feilet. Er du logget inn (\`az login\`)?`);
    console.error(e.stderr?.toString().trim() || e.message);
    process.exit(1);
  }
}

const tilkobling = az(
  "storage", "account", "show-connection-string",
  "--name", LAGERNAVN,
  "--resource-group", RESSURSGRUPPE,
  "--query", "connectionString",
  "-o", "tsv"
);

console.log(`Skriver til lagringskontoen ${LAGERNAVN} i ${RESSURSGRUPPE}.\n`);

kjor(process.execPath, [new URL("./seed.mjs", import.meta.url).pathname], {
  stdio: "inherit",
  env: { ...process.env, LAGER_TILKOBLING: tilkobling },
});
