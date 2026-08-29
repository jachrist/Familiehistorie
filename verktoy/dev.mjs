/**
 * Starter utviklingsmiljøet i riktig rekkefølge.
 *
 * Azurite må lytte før Functions-verten starter: `func` kobler til lagringen
 * med én gang, og feiler med «Exception has been thrown by the target of an
 * invocation» hvis den ikke er der. Å starte begge samtidig er et kappløp som
 * av og til vinnes og av og til ikke.
 *
 * Derfor: start Azurite, vent til porten faktisk svarer, og først da start
 * SWA CLI. Ctrl+C stopper begge.
 */
import { spawn } from "node:child_process";
import { connect } from "node:net";

const AZURITE_PORT = 10000;
const VENTETID_MS = 30_000;

const erWindows = process.platform === "win32";
const barn = [];

function start(navn, kommando, argumenter) {
  const p = spawn(kommando, argumenter, {
    stdio: "inherit",
    shell: erWindows, // npm og npx er .cmd-filer på Windows
    // På POSIX blir barnet gruppeleder, så hele treet kan felles under ett.
    detached: !erWindows,
  });
  p.on("exit", (kode, signal) => {
    if (signal || kode === 0) return;
    console.error(`\n${navn} avsluttet med kode ${kode}.`);
    stoppAlle(kode ?? 1);
  });
  barn.push({ navn, p });
  return p;
}

/**
 * Feller hele prosesstreet, ikke bare barnet vi startet.
 *
 * `npm run azurite` er et mellomledd: dreper man bare det, blir Azurite
 * liggende og holde porten – og neste `npm run dev` feiler på noe helt annet.
 */
function drep(p) {
  if (p.killed || p.exitCode !== null) return;
  if (erWindows) {
    spawn("taskkill", ["/pid", String(p.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-p.pid, "SIGTERM");
    } catch {
      p.kill();
    }
  }
}

let stopper = false;
function stoppAlle(kode) {
  if (stopper) return;
  stopper = true;
  for (const { p } of barn) drep(p);
  // Gi treet et øyeblikk på å avslutte før prosessen selv går ned.
  setTimeout(() => process.exit(kode), 300);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => stoppAlle(0));
}

/** Venter til noe lytter på porten. */
function ventPaaPort(port, frist) {
  return new Promise((loes, avvis) => {
    const start = Date.now();
    const proev = () => {
      const sokk = connect({ port, host: "127.0.0.1" });
      sokk.once("connect", () => {
        sokk.destroy();
        loes();
      });
      sokk.once("error", () => {
        sokk.destroy();
        if (Date.now() - start > frist) {
          avvis(new Error(`Ingenting svarte på port ${port} innen ${frist / 1000} sekunder.`));
        } else {
          setTimeout(proev, 250);
        }
      });
    };
    proev();
  });
}

console.log("▸ Starter Azurite …");
start("Azurite", "npm", ["run", "azurite"]);

try {
  await ventPaaPort(AZURITE_PORT, VENTETID_MS);
  console.log(`▸ Azurite lytter på ${AZURITE_PORT}. Starter Static Web Apps CLI …\n`);
} catch (e) {
  console.error(`\n${e.message}`);
  console.error("Kjører noe annet på porten? Prøv `npm run azurite` alene for å se feilen.");
  stoppAlle(1);
}

start("SWA CLI", "npx", ["swa", "start"]);
