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

const ruter = [];
const funcs = await import("@azure/functions");
funcs.app.http = (navn, cfg) => ruter.push({ navn, ...cfg });
await import("./dist/src/index.js");

function finn(metode, rute) {
  const t = ruter.find((r) => r.route === rute && r.methods.includes(metode));
  if (!t) throw new Error(`fant ikke ${metode} ${rute}`);
  return t;
}

function req({ method = "GET", params = {}, headers = {}, body }) {
  const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
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

/** Rydder før prøven. Et avbrutt kjør skal ikke velte det neste. */
async function rydd() {
  for (const a of PROEVEAAR) {
    await finn("DELETE", "aar/{aar}").handler(req({ method: "DELETE", params: { aar: a } }));
  }
  await finn("POST", "vedlikehold/bygg-indeks").handler(req({ method: "POST", headers: JSONH, body: {} }));
}

await rydd();

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
await rydd();

console.log(feilet === 0 ? "\nAlle kontroller gikk gjennom.\n" : `\n${feilet} kontroller feilet.\n`);
process.exit(feilet === 0 ? 0 : 1);
