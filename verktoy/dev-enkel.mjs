/**
 * Reservevei for lokal utvikling: Azurite + lokal API-tjener + Vite.
 *
 * Ingen Azure Functions Core Tools og ingen Static Web Apps CLI. Vite serverer
 * frontenden og videresender /api til den lokale API-tjeneren, slik
 * proxy-oppsettet i app/vite.config.ts allerede beskriver.
 *
 * Bruk `npm run dev` når func virker — den kjører den ekte Functions-verten og
 * SWA-ens ruting. Denne finnes for at utviklingen ikke skal stoppe opp.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");
const erWindows = process.platform === "win32";
const barn = [];
let stopper = false;

function start(navn, kommando, argumenter, valg = {}) {
  const p = spawn(kommando, argumenter, {
    stdio: "inherit",
    shell: valg.skall ?? false,
    cwd: valg.cwd ?? rot,
    detached: !erWindows,
  });
  p.on("exit", (kode, signal) => {
    if (stopper || signal || kode === 0) return;
    console.error(`\n${navn} avsluttet med kode ${kode}.`);
    if (navn === "Azurite") {
      console.error("\nBle den avbrutt forrige gang, kan metadatafilen være skadet.");
      console.error("Kjør `npm run clean` og prøv igjen.\n");
    }
    stoppAlle(kode ?? 1);
  });
  barn.push({ navn, p });
  return p;
}

function drep(p) {
  if (p.killed || p.exitCode !== null) return;
  if (erWindows) {
    // Først uten /F, så Azurite rekker å skrive ferdig metadatafilen sin.
    // Tvungen avslutning midt i en skriving etterlater den som ugyldig JSON.
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
  setTimeout(() => process.exit(kode), 300);
}
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => stoppAlle(0));

function svarerPaa(port, tidsavbrudd = 800) {
  return new Promise((loes) => {
    const s = connect({ port, host: "127.0.0.1" });
    const ferdig = (v) => {
      s.destroy();
      loes(v);
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

const krev = createRequire(import.meta.url);

if (await svarerPaa(10000)) {
  console.log("▸ Azurite svarer allerede på 10000. Bruker den.\n");
} else {
  console.log("▸ Starter Azurite …");
  start("Azurite", process.execPath, [
    krev.resolve("azurite/dist/src/azurite.js"),
    "--location",
    ".azurite",
    "--skipApiVersionCheck",
  ]);
  if (!(await ventPaaPort(10000, 30_000))) {
    console.error("\n✖ Azurite svarte ikke på port 10000.");
    stoppAlle(1);
    await new Promise(() => {});
  }
  console.log("▸ Azurite lytter på 10000.\n");
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

console.log("▸ Starter lokal API-tjener …");
start("API-tjener", process.execPath, ["lokal-tjener.mjs"], { cwd: join(rot, "api") });
if (!(await ventPaaPort(7071, 20_000))) {
  console.error("\n✖ API-tjeneren svarte ikke på port 7071.");
  stoppAlle(1);
  await new Promise(() => {});
}

console.log("\n▸ Starter Vite …\n");
start("Vite", "npm", ["run", "dev"], { cwd: join(rot, "app"), skall: erWindows });

setTimeout(() => {
  if (!stopper) console.log("\n▸ Åpne http://127.0.0.1:5173\n");
}, 3000);
