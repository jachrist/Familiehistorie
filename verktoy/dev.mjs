/**
 * Starter utviklingsmiljøet i riktig rekkefølge.
 *
 * Azurite må lytte før Functions-verten starter: `func` kobler til lagringen
 * med én gang, og feiler med «Exception has been thrown by the target of an
 * invocation» hvis den ikke er der. Å starte begge samtidig er et kappløp.
 *
 * Derfor: sørg for at Azurite svarer, og start SWA CLI først da.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";

const AZURITE_PORT = 10000;
const VENTETID_MS = 30_000;

const erWindows = process.platform === "win32";
const barn = [];
let stopper = false;

function start(navn, kommando, argumenter, { skall = erWindows } = {}) {
  const p = spawn(kommando, argumenter, {
    stdio: "inherit",
    shell: skall, // npm og npx er .cmd-filer på Windows
    // På POSIX blir barnet gruppeleder, så hele treet kan felles under ett.
    detached: !erWindows,
  });
  p.on("exit", (kode, signal) => {
    if (stopper || signal || kode === 0) return;
    console.error(`\n${navn} avsluttet med kode ${kode}.`);
    if (navn === "Azurite") {
      console.error("\nBle den avbrutt forrige gang, kan metadatafilen være skadet.");
      console.error("Kjør `npm run clean` og prøv igjen — det sletter bare lokal");
      console.error("emulatorlagring, ikke noe i Azure.\n");
    }
    stoppAlle(kode ?? 1);
  });
  barn.push({ navn, p });
  return p;
}

/**
 * Feller hele prosesstreet, ikke bare barnet vi startet.
 *
 * `npm run azurite` er et mellomledd: dreper man bare det, blir Azurite
 * liggende og holde porten – og neste oppstart feiler på noe helt annet.
 */
function drep(p) {
  if (p.killed || p.exitCode !== null) return;
  if (erWindows) {
    // Først uten /F, så Azurite rekker å skrive ferdig metadatafilen sin.
    // Tvungen avslutning midt i en skriving etterlater den som ugyldig JSON,
    // og neste oppstart feiler med «Unexpected token … is not valid JSON».
    spawn("taskkill", ["/pid", String(p.pid), "/T"], { stdio: "ignore" });
    setTimeout(() => {
      if (p.exitCode === null) {
        spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore" });
      }
    }, 1500);
  } else {
    try {
      process.kill(-p.pid, "SIGTERM");
    } catch {
      p.kill();
    }
  }
}

function stoppAlle(kode) {
  if (stopper) return;
  stopper = true;
  for (const { p } of barn) drep(p);
  setTimeout(() => process.exit(kode), 2000);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stoppAlle(0));
}

function svarerPaa(port, tidsavbrudd = 800) {
  return new Promise((loes) => {
    const s = connect({ port, host: "127.0.0.1" });
    const ferdig = (svar) => {
      s.destroy();
      loes(svar);
    };
    s.setTimeout(tidsavbrudd);
    s.once("connect", () => ferdig(true));
    s.once("timeout", () => ferdig(false));
    s.once("error", () => ferdig(false));
  });
}

async function ventPaaPort(port, frist) {
  const start = Date.now();
  while (Date.now() - start < frist) {
    if (await svarerPaa(port)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

// Kjører Azurite allerede – fra et annet skall, eller som en rest fra en
// avsluttet økt – bruker vi den i stedet for å feile på en opptatt port.
if (await svarerPaa(AZURITE_PORT)) {
  console.log(`▸ Azurite svarer allerede på ${AZURITE_PORT}. Bruker den.\n`);
} else {
  console.log("▸ Starter Azurite …");
  // Kjøres direkte med node, ikke via `npm run azurite`. Det fjerner to
  // mellomledd (cmd.exe og npm), som både gjør oppstarten mer forutsigbar på
  // Windows og lar oss stoppe prosessen uten å lete etter barnebarn.
  const azurite = createRequire(import.meta.url).resolve("azurite/dist/src/azurite.js");
  start(
    "Azurite",
    process.execPath,
    [azurite, "--location", ".azurite", "--skipApiVersionCheck"],
    { skall: false }
  );

  if (!(await ventPaaPort(AZURITE_PORT, VENTETID_MS))) {
    console.error(`\n✖ Azurite svarte ikke på port ${AZURITE_PORT} innen ${VENTETID_MS / 1000} sekunder.`);
    console.error("\nKjør denne for å se hva Azurite selv sier:");
    console.error("    npx azurite --location .azurite --skipApiVersionCheck");
    console.error("\nEr porten opptatt av noe annet?");
    console.error(
      erWindows
        ? "    netstat -ano | findstr :10000"
        : "    lsof -i :10000"
    );
    stoppAlle(1);
    // stoppAlle avslutter etter et kort opphold; ingenting mer skal skje her.
    await new Promise(() => {});
  }
  console.log(`▸ Azurite lytter på ${AZURITE_PORT}.\n`);
}

// Uten CORS-regler blokkerer nettleseren opplasting direkte til Blob.
try {
  const { settCors } = await import("./lager-oppsett.mjs");
  await settCors();
  console.log("▸ CORS-regler satt på Azurite.\n");
} catch (e) {
  console.error("⚠ Klarte ikke sette CORS på Azurite:", e.message);
  console.error("  Opplasting av media vil bli blokkert av nettleseren.\n");
}

console.log("▸ Starter Static Web Apps CLI …\n");
start("SWA CLI", "npx", ["swa", "start"]);
