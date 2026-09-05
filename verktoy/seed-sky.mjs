/**
 * Kjører seed.mjs mot Azure i stedet for Azurite, ved å hente
 * tilkoblingsstrengen fra az CLI. Ligger som eget skript for at det skal være
 * et bevisst valg å skrive til skyen.
 */
import { execFileSync, execFileSync as kjor } from "node:child_process";
import { fileURLToPath } from "node:url";

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

// `stdio: inherit` gjør at seed.mjs kan spørre om redaktøradressen. Feiler den,
// har den allerede skrevet en forklaring – da er et stakkspor herfra bare støy.

// Argumentene sendes videre, så `npm run seed:sky -- --redaktoer=…` virker.
try {
  kjor(
    process.execPath,
    [fileURLToPath(new URL("./seed.mjs", import.meta.url)), ...process.argv.slice(2)],
    { stdio: "inherit", env: { ...process.env, LAGER_TILKOBLING: tilkobling } }
  );
} catch {
  process.exit(1);
}
