/**
 * Enkel lokal API-tjener — reserveløsning når Azure Functions Core Tools ikke
 * lar seg kjøre.
 *
 * Laster de samme handlerne som Functions ville kjørt, og serverer dem over
 * vanlig HTTP på 7071. Ruting, roller og SAS er identisk, siden det er den
 * samme koden.
 *
 * Dette er IKKE en erstatning for `func`:
 *   · ingen bindings utover HTTP
 *   · ingen etterligning av Functions-vertens oppstart eller livssyklus
 *   · ingen Application Insights
 *
 * Bruk `npm run dev` når func virker. Denne finnes for at utviklingen ikke skal
 * stoppe opp når den ikke gjør det.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

/**
 * Leser local.settings.json inn i miljøet, slik Functions-verten gjør. Uten
 * dette finner lager.ts hverken LAGER_TILKOBLING eller LAGER_KONTO.
 */
function lesInnstillinger() {
  try {
    const raa = readFileSync(new URL("./local.settings.json", import.meta.url), "utf8");
    const verdier = JSON.parse(raa.replace(/^\uFEFF/, "")).Values ?? {};
    for (const [navn, verdi] of Object.entries(verdier)) {
      if (process.env[navn] === undefined) process.env[navn] = String(verdi);
    }
    return Object.keys(verdier).length;
  } catch (e) {
    console.error("Klarte ikke lese api/local.settings.json:", e.message);
    console.error("Kjør `npm run forbered` i rotmappa.");
    process.exit(1);
  }
}

const antallInnstillinger = lesInnstillinger();
const PORT = Number(process.env.API_PORT ?? 7071);

// Fanger registreringene i stedet for å la Functions-runtimen gjøre det.
const ruter = [];
const funksjoner = await import("@azure/functions");
funksjoner.app.http = (navn, oppsett) => {
  ruter.push({ navn, ...oppsett });
};
await import("./dist/src/index.js");

/** `aar/{aar}` → /^aar\/(?<aar>[^/]+)$/ */
function tilMonster(rute) {
  return new RegExp("^" + rute.replace(/\{([^}]+)\}/g, "(?<$1>[^/]+)") + "$");
}
for (const r of ruter) r.monster = tilMonster(r.route);

function finn(metode, sti) {
  for (const r of ruter) {
    if (!r.methods.includes(metode)) continue;
    const treff = r.monster.exec(sti);
    if (treff) return { rute: r, params: { ...treff.groups } };
  }
  return undefined;
}

function lesKropp(rq) {
  return new Promise((loes, avvis) => {
    const biter = [];
    rq.on("data", (b) => biter.push(b));
    rq.on("end", () => loes(Buffer.concat(biter).toString("utf8")));
    rq.on("error", avvis);
  });
}

const tjener = createServer(async (rq, rs) => {
  const url = new URL(rq.url ?? "/", `http://127.0.0.1:${PORT}`);

  if (!url.pathname.startsWith("/api/")) {
    rs.writeHead(404, { "content-type": "application/json" });
    rs.end(JSON.stringify({ feil: "Ukjent sti." }));
    return;
  }

  const treff = finn(rq.method ?? "GET", url.pathname.slice("/api/".length));
  if (!treff) {
    rs.writeHead(404, { "content-type": "application/json" });
    rs.end(JSON.stringify({ feil: "Ukjent endepunkt." }));
    return;
  }

  const raaKropp = await lesKropp(rq);

  // Etterligner nok av @azure/functions sin HttpRequest til at handlerne kan
  // kjøre uendret.
  const foresporsel = {
    method: rq.method ?? "GET",
    url: url.toString(),
    params: treff.params,
    query: url.searchParams,
    headers: {
      get: (navn) => rq.headers[navn.toLowerCase()] ?? null,
    },
    text: async () => raaKropp,
    json: async () => JSON.parse(raaKropp),
  };

  try {
    const svar = await treff.rute.handler(foresporsel, {
      log: console.log,
      error: console.error,
      warn: console.warn,
    });
    const hoder = { "content-type": "application/json", ...(svar?.headers ?? {}) };
    rs.writeHead(svar?.status ?? 200, hoder);
    rs.end(svar?.jsonBody === undefined ? (svar?.body ?? "") : JSON.stringify(svar.jsonBody));
  } catch (e) {
    console.error(`${rq.method} ${url.pathname} feilet:`, e);
    rs.writeHead(500, { "content-type": "application/json" });
    rs.end(JSON.stringify({ feil: "Uventet feil i API-et.", detaljer: String(e?.message ?? e) }));
  }
});

tjener.listen(PORT, "127.0.0.1", () => {
  console.log(`Lokal API-tjener lytter på http://127.0.0.1:${PORT}`);
  console.log(`${antallInnstillinger} innstillinger lest fra local.settings.json`);
  console.log(`${ruter.length} endepunkter:`);
  for (const r of ruter) {
    console.log(`  ${r.methods.join("/").padEnd(14)} /api/${r.route}`);
  }
  console.log("\n(Reserveløsning uten Functions Core Tools — se KOM-I-GANG.md)\n");
});
