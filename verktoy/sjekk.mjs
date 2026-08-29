/**
 * Forhåndssjekk av utviklingsmiljøet.
 *
 * Går gjennom det som erfaringsmessig feiler, og sier hva som er galt i stedet
 * for å la det dukke opp som en uforståelig melding fra et verktøy tre steg
 * senere.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rot = join(dirname(fileURLToPath(import.meta.url)), "..");
const erWindows = process.platform === "win32";

let feil = 0;
let advarsler = 0;

function ok(navn, detalj = "") {
  console.log(`  \x1b[32mok\x1b[0m    ${navn}${detalj ? `  ${detalj}` : ""}`);
}
function nei(navn, hva) {
  feil++;
  console.log(`  \x1b[31mfeil\x1b[0m  ${navn}`);
  console.log(`        → ${hva}`);
}
function kanskje(navn, hva) {
  advarsler++;
  console.log(`  \x1b[33mobs\x1b[0m   ${navn}`);
  console.log(`        → ${hva}`);
}

function kjor(kommando, argumenter) {
  try {
    return execFileSync(kommando, argumenter, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: erWindows,
    }).trim();
  } catch {
    return undefined;
  }
}

function porten(port) {
  return new Promise((loes) => {
    const s = connect({ port, host: "127.0.0.1" });
    const ferdig = (svar) => {
      s.destroy();
      loes(svar);
    };
    s.setTimeout(1500);
    s.once("connect", () => ferdig(true));
    s.once("timeout", () => ferdig(false));
    s.once("error", () => ferdig(false));
  });
}

console.log("\nMiljø");

const node = process.versions.node;
const stor = Number(node.split(".")[0]);
if (stor === 22) ok("Node", `v${node}`);
else if (stor < 22) nei("Node", `v${node} er for gammelt. Installer Node 22 fra nodejs.org/dist/latest-v22.x`);
else nei("Node", `v${node} støttes ikke av Azure Functions. Installer Node 22 fra nodejs.org/dist/latest-v22.x`);

const funcVersjon = kjor("func", ["--version"]);
if (!funcVersjon) {
  nei("Functions Core Tools", "ikke funnet. På Windows: winget install Microsoft.Azure.FunctionsCoreTools");
} else if (funcVersjon.startsWith("4.")) {
  ok("Functions Core Tools", `v${funcVersjon}`);
} else {
  nei("Functions Core Tools", `v${funcVersjon} – prosjektet krever v4`);
}

console.log("\nProsjekt");

for (const [navn, sti] of [
  ["app/node_modules", "app/node_modules"],
  ["api/node_modules", "api/node_modules"],
]) {
  if (existsSync(join(rot, sti))) ok(navn);
  else nei(navn, "mangler. Kjør `npm run installer`");
}

const bygget = join(rot, "api", "dist", "src", "index.js");
if (existsSync(bygget)) ok("api/dist", "bygget");
else kanskje("api/dist", "ikke bygget ennå. `npm run dev` bygger det selv");

const innst = join(rot, "api", "local.settings.json");
if (!existsSync(innst)) {
  nei("api/local.settings.json", "mangler. Kjør `npm run forbered`");
} else {
  try {
    const raa = readFileSync(innst, "utf8").replace(/^﻿/, "");
    const j = JSON.parse(raa);
    const v = j.Values ?? {};
    if (v.FUNCTIONS_WORKER_RUNTIME !== "node") {
      nei("api/local.settings.json", 'FUNCTIONS_WORKER_RUNTIME må være "node". Slett filen og kjør `npm run forbered`');
    } else if (!v.LAGER_TILKOBLING) {
      nei("api/local.settings.json", "LAGER_TILKOBLING mangler. Slett filen og kjør `npm run forbered`");
    } else {
      ok("api/local.settings.json");
    }
  } catch (e) {
    nei("api/local.settings.json", `ikke gyldig JSON (${e.message}). Slett filen og kjør \`npm run forbered\``);
  }
}

console.log("\nPorter");

if (await porten(10000)) ok("Azurite", "svarer på 10000");
else kanskje("Azurite", "svarer ikke på 10000. `npm run dev` starter den – men kjører du `func start` alene, må du starte `npm run azurite` først");

for (const [port, hva] of [
  [4280, "Static Web Apps CLI"],
  [5173, "Vite"],
  [7071, "Azure Functions"],
]) {
  if (await porten(port)) kanskje(`Port ${port}`, `noe lytter allerede (${hva} bruker den). Kjører npm run dev fra før?`);
  else ok(`Port ${port}`, `ledig (${hva})`);
}

console.log("");
if (feil > 0) {
  console.log(`\x1b[31m${feil} ting må rettes før npm run dev virker.\x1b[0m\n`);
  process.exit(1);
}
console.log(
  advarsler > 0
    ? `\x1b[33mAlt vesentlig er på plass (${advarsler} merknad${advarsler === 1 ? "" : "er"} over).\x1b[0m\n`
    : "\x1b[32mAlt er på plass.\x1b[0m\n"
);
