/**
 * Røykprøve for API-et.
 *
 * Kaller handlerne direkte mot Azurite, uten Functions Core Tools. Dekker
 * lesing, ETag-samtidighet, validering, sanitering, SAS-utstedelse og
 * indeksbygging – altså det trinn 3 lover.
 *
 *   npm run azurite     (i rotmappa, i et eget skall)
 *   npm run seed        (i rotmappa)
 *   npm run proev       (i rotmappa)
 *
 * Prøven skriver og sletter årene 1996–1999, og bygger indeksen på nytt.
 * Kjør den ikke mot ekte data.
 */
process.env.LAGER_TILKOBLING = "UseDevelopmentStorage=true";
process.env.MILJO = "lokalt";
// Fast nøkkel: prøven skal gi samme resultat hver gang, og verdien forlater
// aldri denne prosessen.
process.env.SESJON_HEMMELIGHET = "roykprove-noekkel-som-er-lang-nok-32+";

const ruter = [];
const funcs = await import("@azure/functions");
funcs.app.http = (navn, cfg) => ruter.push({ navn, ...cfg });
await import("./dist/src/index.js");

function finn(metode, rute) {
  const t = ruter.find((r) => r.route === rute && r.methods.includes(metode));
  if (!t) throw new Error(`fant ikke ${metode} ${rute}`);
  return t;
}

const REDAKTOER = "proeve-redaktoer@eksempel.no";
const FAMILIE = "proeve-familie@eksempel.no";

const { utstedToken, KAPSELNAVN } = await import("./dist/src/sesjon.js");
const { CONTAINER, STI, lesJson, skrivJson, sikreContainere } = await import("./dist/src/lager.js");
const { tomBuffer } = await import("./dist/src/tilgang.js");
const { slettTabeller } = await import("./dist/src/tabell.js");
const { kanBestille, lagKode } = await import("./dist/src/kode.js");

function kapsel(som) {
  if (som === "ingen") return {};
  if (som === "tull") return { cookie: `${KAPSELNAVN}=ikke.et.token` };
  return { cookie: `${KAPSELNAVN}=${utstedToken(som === "familie" ? FAMILIE : REDAKTOER)}` };
}

function req({ method = "GET", params = {}, headers = {}, body, som = "redaktoer" }) {
  const h = new Map(
    Object.entries({ ...kapsel(som), ...headers }).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    method,
    params,
    headers: { get: (k) => h.get(k.toLowerCase()) ?? null },
    json: async () => {
      if (body === undefined) throw new Error("ingen kropp");
      return body;
    },
  };
}

const JSONH = { "content-type": "application/json" };
let feilet = 0;
async function proev(navn, forventet, kjor) {
  try {
    const svar = await kjor();
    const ok = svar.status === forventet || (forventet === 200 && svar.status === undefined);
    console.log(`${ok ? "  ok  " : "  FEIL"}  ${navn.padEnd(46)} ${svar.status ?? 200}${ok ? "" : ` (ventet ${forventet})`}`);
    if (!ok) { feilet++; console.log("        ", JSON.stringify(svar.jsonBody).slice(0, 220)); }
    return svar;
  } catch (e) {
    feilet++;
    console.log(`  KRASJ ${navn.padEnd(46)} ${e.message}`);
    return {};
  }
}

const PROEVEAAR = ["1996", "1997", "1998", "1999"];

/**
 * Prøven trenger sin egen tilgangsliste. Den ekte lokale listen legges til side
 * og settes tilbake til slutt – en røykprøve skal ikke endre hvem som kommer
 * inn på utviklingsmaskinen.
 */
let opprinneligTilgang;

async function settOppTilgang() {
  await sikreContainere();
  opprinneligTilgang = await lesJson(CONTAINER.innhold, STI.tilgang);
  await skrivJson(CONTAINER.innhold, STI.tilgang, {
    personer: [
      { epost: REDAKTOER, navn: "Prøve Redaktør", roller: ["familie", "redaktoer"] },
      { epost: FAMILIE, navn: "Prøve Familie", roller: ["familie"] },
    ],
  });
  tomBuffer();
  await slettTabeller();
}

async function gjenopprettTilgang() {
  if (opprinneligTilgang) {
    await skrivJson(CONTAINER.innhold, STI.tilgang, opprinneligTilgang.verdi);
  }
  tomBuffer();
  await slettTabeller();
}

/** Rydder før prøven. Et avbrutt kjør skal ikke velte det neste. */
async function rydd() {
  for (const a of PROEVEAAR) {
    await finn("DELETE", "aar/{aar}").handler(req({ method: "DELETE", params: { aar: a } }));
  }
  await finn("POST", "vedlikehold/bygg-indeks").handler(req({ method: "POST", headers: JSONH, body: {} }));
}

await settOppTilgang();
await rydd();

console.log("\nInnlogging og adgangskontroll");
await proev("GET /api/indeks uten kapsel → 401", 401, () =>
  finn("GET", "indeks").handler(req({ som: "ingen" })));
await proev("GET /api/indeks med ugyldig token → 401", 401, () =>
  finn("GET", "indeks").handler(req({ som: "tull" })));
const meg = await proev("GET /api/meg", 200, () => finn("GET", "meg").handler(req({})));
console.log(`         → ${meg.jsonBody?.epost} med rollene ${meg.jsonBody?.roller?.join(", ")}`);
await proev("GET /api/meg uten kapsel → 401", 401, () =>
  finn("GET", "meg").handler(req({ som: "ingen" })));
await proev("PUT år som familie (ikke redaktør) → 403", 403, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1997" }, headers: JSONH, body: { felter: { tittel: "Nei" }, media: [] }, som: "familie" })));
await proev("GET /api/tilgang som familie → 403", 403, () =>
  finn("GET", "tilgang").handler(req({ som: "familie" })));
await proev("GET /api/tilgang som redaktør", 200, () =>
  finn("GET", "tilgang").handler(req({})));

console.log("\nEngangskode");
await proev("POST /api/auth/kode, ukjent adresse → 202", 202, () =>
  finn("POST", "auth/kode").handler(req({ method: "POST", headers: JSONH, body: { epost: "ingen@eksempel.no" }, som: "ingen" })));
await proev("POST /api/auth/kode, kjent adresse → 202", 202, () =>
  finn("POST", "auth/kode").handler(req({ method: "POST", headers: JSONH, body: { epost: REDAKTOER }, som: "ingen" })));
await proev("POST /api/auth/verifiser med feil kode → 401", 401, () =>
  finn("POST", "auth/verifiser").handler(req({ method: "POST", headers: JSONH, body: { epost: REDAKTOER, kode: "000000" }, som: "ingen" })));

const ekteKode = await lagKode(FAMILIE);
const innlogging = await proev("POST /api/auth/verifiser med riktig kode", 200, () =>
  finn("POST", "auth/verifiser").handler(req({ method: "POST", headers: JSONH, body: { epost: FAMILIE, kode: ekteKode }, som: "ingen" })));
const settKapsel = innlogging.headers?.["Set-Cookie"] ?? "";
const kapselOk = settKapsel.includes(`${KAPSELNAVN}=`) && settKapsel.includes("HttpOnly") && settKapsel.includes("SameSite=Strict") && settKapsel.includes("Path=/api");
console.log(`  ${kapselOk ? "ok  " : "FEIL"}  ${"Set-Cookie er HttpOnly, Strict, Path=/api".padEnd(46)}`);
if (!kapselOk) { feilet++; console.log("         →", settKapsel); }
await proev("Samme kode en gang til → 401 (forbrukt)", 401, () =>
  finn("POST", "auth/verifiser").handler(req({ method: "POST", headers: JSONH, body: { epost: FAMILIE, kode: ekteKode }, som: "ingen" })));

const forsokKode = await lagKode(FAMILIE);
for (let i = 0; i < 4; i++) {
  await finn("POST", "auth/verifiser").handler(req({ method: "POST", headers: JSONH, body: { epost: FAMILIE, kode: "111111" }, som: "ingen" }));
}
await proev("Femte feilforsøk → 429, koden forkastes", 429, () =>
  finn("POST", "auth/verifiser").handler(req({ method: "POST", headers: JSONH, body: { epost: FAMILIE, kode: "111111" }, som: "ingen" })));
await proev("Riktig kode etter forkasting → 401", 401, () =>
  finn("POST", "auth/verifiser").handler(req({ method: "POST", headers: JSONH, body: { epost: FAMILIE, kode: forsokKode }, som: "ingen" })));

const bestillinger = [];
for (let i = 0; i < 6; i++) bestillinger.push(await kanBestille("takst@eksempel.no"));
const takstOk = bestillinger.slice(0, 5).every(Boolean) && bestillinger[5] === false;
console.log(`  ${takstOk ? "ok  " : "FEIL"}  ${"Maks 5 kodebestillinger per time".padEnd(46)}`);
if (!takstOk) { feilet++; console.log("         →", bestillinger.join(", ")); }

const utlogget = await proev("POST /api/auth/logg-ut", 200, () =>
  finn("POST", "auth/logg-ut").handler(req({ method: "POST", headers: JSONH, body: {} })));
const tommer = (utlogget.headers?.["Set-Cookie"] ?? "").includes("Max-Age=0");
console.log(`  ${tommer ? "ok  " : "FEIL"}  ${"Utlogging tømmer kapselen".padEnd(46)}`);
if (!tommer) feilet++;

console.log("\nLesing");
const indeks = await proev("GET /api/indeks", 200, () => finn("GET", "indeks").handler(req({})));
console.log(`         → ${indeks.jsonBody?.aar?.length ?? 0} år, nyeste ${indeks.jsonBody?.aar?.[0]?.aar ?? "–"}`);
await proev("GET /api/felter", 200, () => finn("GET", "felter").handler(req({})));
const y72 = await proev("GET /api/aar/{aar} (1972)", 200, () => finn("GET", "aar/{aar}").handler(req({ params: { aar: "1972" } })));
console.log(`         → "${y72.jsonBody?.felter?.tittel}", etag ${y72.jsonBody?.etag?.slice(0, 12)}…`);
await proev("GET /api/aar/{aar} (finnes ikke)", 404, () => finn("GET", "aar/{aar}").handler(req({ params: { aar: "1600" } })));
await proev("GET /api/aar/{aar} (ugyldig)", 400, () => finn("GET", "aar/{aar}").handler(req({ params: { aar: "99999" } })));

console.log("\nSkriving og samtidighet");
const nytt = { felter: { tittel: "Prøveår", hendelser: "<p>Hei</p>" }, media: [] };
await proev("PUT nytt år → opprettet", 201, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1999" }, headers: JSONH, body: nytt })));
await proev("PUT samme år uten If-Match → konflikt", 409, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1999" }, headers: JSONH, body: nytt })));
const hentet = await finn("GET", "aar/{aar}").handler(req({ params: { aar: "1999" } }));
await proev("PUT med feil If-Match → 412", 412, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1999" }, headers: { ...JSONH, "if-match": '"0x8DFEIL"' }, body: nytt })));
await proev("PUT med riktig If-Match → lagret", 200, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1999" }, headers: { ...JSONH, "if-match": hentet.jsonBody.etag }, body: nytt })));

console.log("\nValidering og sanitering");
await proev("PUT uten påkrevd felt → 422", 422, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1998" }, headers: JSONH, body: { felter: { tittel: "" }, media: [] } })));
await proev("PUT uten JSON-content-type → 415", 415, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1997" }, headers: { "content-type": "text/plain" }, body: nytt })));
const skitten = { felter: { tittel: 'Tittel<script>alert(1)</script>', hendelser: '<p onclick="ondt()">Tekst</p><script>stjel()</script>' }, media: [] };
const renset = await proev("PUT med skript i tekst → sanitert", 201, () =>
  finn("PUT", "aar/{aar}").handler(req({ method: "PUT", params: { aar: "1996" }, headers: JSONH, body: skitten })));
if (renset.jsonBody?.felter) {
  console.log(`         → tittel:    ${JSON.stringify(renset.jsonBody.felter.tittel)}`);
  console.log(`         → hendelser: ${JSON.stringify(renset.jsonBody.felter.hendelser)}`);
}

console.log("\nMedia");
const opp = await proev("POST /api/media/opplasting", 200, () =>
  finn("POST", "media/opplasting").handler(req({ method: "POST", headers: JSONH, body: { aar: 1972, filer: [{ filnavn: "bilde.jpg", type: "image/jpeg" }, { filnavn: "film.mp4", type: "video/mp4" }] } })));
if (opp.jsonBody?.maal) {
  console.log(`         → ${opp.jsonBody.maal.map((m) => m.fil).join(", ")}`);
  console.log(`         → SAS utløper ${opp.jsonBody.utloper}, signatur utelatt fra loggen`);
}
await proev("POST opplasting med ulovlig filtype → 415", 415, () =>
  finn("POST", "media/opplasting").handler(req({ method: "POST", headers: JSONH, body: { aar: 1972, filer: [{ filnavn: "ondt.exe", type: "application/x-msdownload" }] } })));

console.log("\nIndeks og sletting");
const bygg = await proev("POST /api/vedlikehold/bygg-indeks", 200, () =>
  finn("POST", "vedlikehold/bygg-indeks").handler(req({ method: "POST", headers: JSONH, body: {} })));
console.log(`         → ${bygg.jsonBody?.aar?.length ?? 0} år i indeksen`);
await proev("DELETE /api/aar/1996", 200, () => finn("DELETE", "aar/{aar}").handler(req({ method: "DELETE", params: { aar: "1996" } })));
await proev("DELETE samme år igjen → 404", 404, () => finn("DELETE", "aar/{aar}").handler(req({ method: "DELETE", params: { aar: "1996" } })));

console.log("\nTilgangslisten");
const liste = await finn("GET", "tilgang").handler(req({}));
await proev("PUT tilgang uten redaktør → 422", 422, () =>
  finn("PUT", "tilgang").handler(req({ method: "PUT", headers: { ...JSONH, "if-match": liste.jsonBody.etag }, body: { personer: [{ epost: FAMILIE, navn: "Alene", roller: ["familie"] }] } })));
await proev("PUT tilgang med duplikat adresse → 422", 422, () =>
  finn("PUT", "tilgang").handler(req({ method: "PUT", headers: { ...JSONH, "if-match": liste.jsonBody.etag }, body: { personer: [{ epost: REDAKTOER, navn: "En", roller: ["redaktoer"] }, { epost: REDAKTOER, navn: "To", roller: ["familie"] }] } })));
await proev("PUT tilgang med feil If-Match → 412", 412, () =>
  finn("PUT", "tilgang").handler(req({ method: "PUT", headers: { ...JSONH, "if-match": '"0x8DFEIL"' }, body: { personer: [{ epost: REDAKTOER, navn: "Prøve Redaktør", roller: ["familie", "redaktoer"] }] } })));

await rydd();
await gjenopprettTilgang();

console.log(feilet === 0 ? "\nAlle kontroller gikk gjennom.\n" : `\n${feilet} kontroller feilet.\n`);
process.exit(feilet === 0 ? 0 : 1);
