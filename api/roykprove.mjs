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
const { CONTAINER, STI, lesJson, skrivJson, slettBlob, sikreContainere } = await import("./dist/src/lager.js");
const { tomBuffer } = await import("./dist/src/tilgang.js");
const { slettTabeller } = await import("./dist/src/tabell.js");
const { kanBestille, lagKode } = await import("./dist/src/kode.js");
const { sisteUtfall: sisteKodeutfall } = await import("./dist/src/hendelse.js");

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
let opprinneligOpptak;

async function settOppTilgang() {
  await sikreContainere();
  opprinneligTilgang = await lesJson(CONTAINER.innhold, STI.tilgang);
  opprinneligOpptak = await lesJson(CONTAINER.innhold, STI.opptak);
  // Prøven skriver registeret fra bunnen av, og sjekker blant annet at første
  // lagring godtas uten ETag. Da må det ikke ligge et fra før.
  await slettBlob(CONTAINER.innhold, STI.opptak);
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
  // Prøven skriver sitt eget opptaksregister. Fantes det ikke fra før, slettes
  // det – ellers ville neste kjøring møtt en fil den trodde den opprettet selv.
  if (opprinneligOpptak) {
    await skrivJson(CONTAINER.innhold, STI.opptak, opprinneligOpptak.verdi);
  } else {
    await slettBlob(CONTAINER.innhold, STI.opptak);
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

console.log("\nOpptaksregisteret");
const OPPTAK = { opptak: [
  { id: "bryllupet-1963", tittel: "Bryllupet i Vang kirke", url: "https://mqx.sharepoint.com/:v:/g/abc", start: 83 },
  { id: "hytta", tittel: "Hytta ved Mjosa", url: "https://mqx.sharepoint.com/:v:/g/def" },
]};
await proev("PUT /api/opptak (forste gang)", 200, () =>
  finn("PUT", "opptak").handler(req({ method: "PUT", headers: JSONH, body: OPPTAK })));
const reg = await proev("GET /api/opptak", 200, () => finn("GET", "opptak").handler(req({})));
console.log(`         → ${reg.jsonBody?.opptak?.length} opptak, tillatte verter: ${reg.jsonBody?.verter?.join(", ")}`);

await proev("GET /api/opptak som familie → 403", 403, () =>
  finn("GET", "opptak").handler(req({ som: "familie" })));
await proev("PUT opptak med vert utenfor listen → 422", 422, () =>
  finn("PUT", "opptak").handler(req({ method: "PUT", headers: { ...JSONH, "if-match": reg.jsonBody.etag }, body: { opptak: [{ id: "ond", tittel: "Ond", url: "https://ondt.example.com/x" }] } })));
await proev("PUT opptak med http → 422", 422, () =>
  finn("PUT", "opptak").handler(req({ method: "PUT", headers: { ...JSONH, "if-match": reg.jsonBody.etag }, body: { opptak: [{ id: "usikker", tittel: "Usikker", url: "http://mqx.sharepoint.com/x" }] } })));
await proev("PUT opptak med duplikat id → 422", 422, () =>
  finn("PUT", "opptak").handler(req({ method: "PUT", headers: { ...JSONH, "if-match": reg.jsonBody.etag }, body: { opptak: [OPPTAK.opptak[0], OPPTAK.opptak[0]] } })));
await proev("PUT opptak med feil If-Match → 412", 412, () =>
  finn("PUT", "opptak").handler(req({ method: "PUT", headers: { ...JSONH, "if-match": '"0x8DFEIL"' }, body: OPPTAK })));

const uinnlogget = await proev("GET /api/opptak/{id} uten kapsel → 401", 401, () =>
  finn("GET", "opptak/{id}").handler(req({ params: { id: "bryllupet-1963" }, som: "ingen" })));
const erHtml = String(uinnlogget.headers?.["Content-Type"] ?? "").includes("text/html");
console.log(`  ${erHtml ? "ok  " : "FEIL"}  ${"Avvisningen er en side, ikke JSON".padEnd(46)}`);
if (!erHtml) feilet++;
const lekker = String(uinnlogget.body ?? "").includes("sharepoint.com");
console.log(`  ${!lekker ? "ok  " : "FEIL"}  ${"Uinnlogget faar ikke se delingslenken".padEnd(46)}`);
if (lekker) feilet++;

const videre = await proev("GET /api/opptak/{id} som familie → 302", 302, () =>
  finn("GET", "opptak/{id}").handler(req({ params: { id: "bryllupet-1963" }, som: "familie" })));
const maal = String(videre.headers?.Location ?? "");
console.log(`         → ${maal}`);
const harStart = maal.includes("nav=");
console.log(`  ${harStart ? "ok  " : "FEIL"}  ${"Starttidspunkt lagt paa lenken".padEnd(46)}`);
if (!harStart) feilet++;
if (harStart) {
  const nav = JSON.parse(Buffer.from(decodeURIComponent(new URL(maal).searchParams.get("nav")), "base64").toString("utf8"));
  const riktig = nav?.playbackOptions?.startTimeInSeconds === 83;
  console.log(`  ${riktig ? "ok  " : "FEIL"}  ${"nav peker paa 83 sekunder".padEnd(46)}`);
  if (!riktig) feilet++;
}

const uten = await finn("GET", "opptak/{id}").handler(req({ params: { id: "hytta" }, som: "familie" }));
const urort = uten.headers?.Location === "https://mqx.sharepoint.com/:v:/g/def";
console.log(`  ${urort ? "ok  " : "FEIL"}  ${"Uten start staar lenken uroert".padEnd(46)}`);
if (!urort) feilet++;

await proev("GET /api/opptak/{id} som ikke finnes → 404", 404, () =>
  finn("GET", "opptak/{id}").handler(req({ params: { id: "finnes-ikke" }, som: "familie" })));
await proev("GET /api/opptak/{id} med rar id → 400", 400, () =>
  finn("GET", "opptak/{id}").handler(req({ params: { id: "../tilgang" }, som: "familie" })));

console.log("\nTabellen forsvinner under beina");
// Klienten bufres for prosessens levetid. Blir tabellen borte etterpå, feilet
// hvert innloggingsforsøk i stillhet fram til verten ble startet på nytt.
await lagKode("gjenoppretting@eksempel.no");
// `false`: klientene skal *ikke* glemmes. Ryddes de samtidig, lages neste
// klient på vanlig vis og retry-veien blir aldri kjørt – prøven ville gått
// grønt uten å ha prøvd det den heter.
await slettTabeller(false);
const etterSletting = await proev("POST /api/auth/kode etter at tabellen er slettet", 202, () =>
  finn("POST", "auth/kode").handler(req({ method: "POST", headers: JSONH, body: { epost: REDAKTOER }, som: "ingen" })));
const helbredet = await sisteKodeutfall();
const kom = helbredet?.utfall === "Engangskode sendt.";
console.log(`  ${kom ? "ok  " : "FEIL"}  ${"Tabellen opprettes på nytt, koden sendes".padEnd(46)}`);
if (!kom) { feilet++; console.log("         →", JSON.stringify(helbredet)); }
void etterSletting;

console.log("\nHelsesjekk");
const helseAapen = await proev("GET /api/helse uten kapsel", 200, () =>
  finn("GET", "helse").handler(req({ som: "ingen" })));
const rroeperIngenting =
  helseAapen.jsonBody?.adresser === undefined &&
  helseAapen.jsonBody?.sisteKodebestilling === undefined;
console.log(`  ${rroeperIngenting ? "ok  " : "FEIL"}  ${"Uinnlogget ser verken adresser eller utfall".padEnd(46)}`);
if (!rroeperIngenting) { feilet++; console.log("         →", Object.keys(helseAapen.jsonBody ?? {}).join(", ")); }
const harOppsett = typeof helseAapen.jsonBody?.ok === "boolean" && Array.isArray(helseAapen.jsonBody?.merknader);
console.log(`  ${harOppsett ? "ok  " : "FEIL"}  ${"Uinnlogget ser fortsatt oppsettet".padEnd(46)}`);
if (!harOppsett) feilet++;

const helseFamilie = await proev("GET /api/helse som familie", 200, () =>
  finn("GET", "helse").handler(req({ som: "familie" })));
const familieSerIkke = helseFamilie.jsonBody?.adresser === undefined;
console.log(`  ${familieSerIkke ? "ok  " : "FEIL"}  ${"Familie uten redaktørrolle ser ikke adresser".padEnd(46)}`);
if (!familieSerIkke) feilet++;

const helseRedaktoer = await proev("GET /api/helse som redaktør", 200, () =>
  finn("GET", "helse").handler(req({})));
const maskert = (helseRedaktoer.jsonBody?.adresser ?? []).every((a) => a.includes("***@"));
const serAdresser = (helseRedaktoer.jsonBody?.adresser ?? []).length === 2 && maskert;
console.log(`  ${serAdresser ? "ok  " : "FEIL"}  ${"Redaktør ser adressene, maskert".padEnd(46)}`);
if (!serAdresser) { feilet++; console.log("         →", helseRedaktoer.jsonBody?.adresser); }

console.log("\nSikkerhetskopi");
const kopi = await proev("POST /api/vedlikehold/sikkerhetskopi", 200, () =>
  finn("POST", "vedlikehold/sikkerhetskopi").handler(req({ method: "POST", headers: JSONH, body: {} })));
console.log(`         → ${kopi.jsonBody?.id}, ${kopi.jsonBody?.antallAar} år, ${kopi.jsonBody?.bytes} B`);
const kopi2 = await proev("POST sikkerhetskopi en gang til", 200, () =>
  finn("POST", "vedlikehold/sikkerhetskopi").handler(req({ method: "POST", headers: JSONH, body: {} })));
const egenId = kopi2.jsonBody?.id && kopi2.jsonBody.id !== kopi.jsonBody?.id;
console.log(`  ${egenId ? "ok  " : "FEIL"}  ${"To kopier på rad får hver sin id".padEnd(46)}`);
if (!egenId) { feilet++; console.log("         →", kopi.jsonBody?.id, kopi2.jsonBody?.id); }

await proev("POST sikkerhetskopi som familie → 403", 403, () =>
  finn("POST", "vedlikehold/sikkerhetskopi").handler(req({ method: "POST", headers: JSONH, body: {}, som: "familie" })));

const kopiliste = await proev("GET /api/vedlikehold/sikkerhetskopi", 200, () =>
  finn("GET", "vedlikehold/sikkerhetskopi").handler(req({})));
const iListen = (kopiliste.jsonBody?.kopier ?? []).some((k) => k.id === kopi.jsonBody?.id);
console.log(`  ${iListen ? "ok  " : "FEIL"}  ${"Kopien står i listen".padEnd(46)}`);
if (!iListen) feilet++;

const nedlasting = await proev("GET sikkerhetskopi/{id} → nedlasting", 200, () =>
  finn("GET", "vedlikehold/sikkerhetskopi/{id}").handler(req({ params: { id: kopi.jsonBody.id } })));
const vedlegg = String(nedlasting.headers?.["Content-Disposition"] ?? "");
const erVedlegg = vedlegg.startsWith("attachment;") && vedlegg.includes(kopi.jsonBody.id);
console.log(`  ${erVedlegg ? "ok  " : "FEIL"}  ${"Svaret er et vedlegg med filnavn".padEnd(46)}`);
if (!erVedlegg) { feilet++; console.log("         →", vedlegg); }
const pakket = JSON.parse(nedlasting.body ?? "{}");
const harInnhold = Array.isArray(pakket.aar) && pakket.tilgang?.personer?.length === 2 && Array.isArray(pakket.mediefiler);
console.log(`  ${harInnhold ? "ok  " : "FEIL"}  ${"Kopien inneholder år, tilgang og medieliste".padEnd(46)}`);
if (!harInnhold) feilet++;

await proev("GET sikkerhetskopi med sti i id → 400", 400, () =>
  finn("GET", "vedlikehold/sikkerhetskopi/{id}").handler(req({ params: { id: "../innhold/tilgang" } })));
await proev("GET sikkerhetskopi som ikke finnes → 404", 404, () =>
  finn("GET", "vedlikehold/sikkerhetskopi/{id}").handler(req({ params: { id: "1999-01-01T000000" } })));

console.log("\nTømming");
await proev("POST /api/vedlikehold/tom uten JSON → 415", 415, () =>
  finn("POST", "vedlikehold/tom").handler(req({ method: "POST", headers: { "content-type": "text/plain" }, body: {} })));
await proev("POST /api/vedlikehold/tom som familie → 403", 403, () =>
  finn("POST", "vedlikehold/tom").handler(req({ method: "POST", headers: JSONH, body: {}, som: "familie" })));

const torr = await proev("POST tom uten bekreft → tørrkjøring", 200, () =>
  finn("POST", "vedlikehold/tom").handler(req({ method: "POST", headers: JSONH, body: {} })));
console.log(`         → ${torr.jsonBody?.telling?.sum} filer, slettet ${torr.jsonBody?.slettet}`);
const rortIkke = torr.jsonBody?.torrkjoring === true && torr.jsonBody?.slettet === 0;
console.log(`  ${rortIkke ? "ok  " : "FEIL"}  ${"Tørrkjøringen slettet ingenting".padEnd(46)}`);
if (!rortIkke) feilet++;

await proev("POST tom med feil antall → 409", 409, () =>
  finn("POST", "vedlikehold/tom").handler(req({ method: "POST", headers: JSONH, body: { bekreft: torr.jsonBody.telling.sum + 7 } })));

// Selve slettingen kjøres bare når man ber om det: den tar alle årene i den
// lokale Azurite-kontoen, ikke bare prøveårene.
if (process.argv.includes("--tom")) {
  const foer = torr.jsonBody.telling.sum;
  const tomt = await proev("POST tom med riktig antall → slettet", 200, () =>
    finn("POST", "vedlikehold/tom").handler(req({ method: "POST", headers: JSONH, body: { bekreft: foer } })));
  console.log(`         → slettet ${tomt.jsonBody?.slettet}, kopi ${tomt.jsonBody?.sikkerhetskopi?.id}`);
  const etterpaa = await finn("POST", "vedlikehold/tom").handler(req({ method: "POST", headers: JSONH, body: {} }));
  const tomtNaa = etterpaa.jsonBody?.telling?.sum === 0;
  console.log(`  ${tomtNaa ? "ok  " : "FEIL"}  ${"Ingenting igjen etter tømming".padEnd(46)}`);
  if (!tomtNaa) feilet++;
  const felterIgjen = await lesJson(CONTAINER.innhold, STI.felter);
  const tilgangIgjen = await lesJson(CONTAINER.innhold, STI.tilgang);
  const beholdt = Boolean(felterIgjen && tilgangIgjen);
  console.log(`  ${beholdt ? "ok  " : "FEIL"}  ${"felter.json og tilgang.json står igjen".padEnd(46)}`);
  if (!beholdt) feilet++;

  console.log("\nGjenoppretting");
  const foerKopi = tomt.jsonBody.sikkerhetskopi;
  await proev("POST gjenopprett med feil antall → 409", 409, () =>
    finn("POST", "vedlikehold/gjenopprett").handler(req({ method: "POST", headers: JSONH, body: { id: foerKopi.id, bekreft: foerKopi.antallAar + 3 } })));
  await proev("POST gjenopprett som familie → 403", 403, () =>
    finn("POST", "vedlikehold/gjenopprett").handler(req({ method: "POST", headers: JSONH, body: { id: foerKopi.id, bekreft: foerKopi.antallAar }, som: "familie" })));
  await proev("POST gjenopprett av kopi som ikke finnes → 404", 404, () =>
    finn("POST", "vedlikehold/gjenopprett").handler(req({ method: "POST", headers: JSONH, body: { id: "1999-01-01T000000", bekreft: 0 } })));

  const tilbake = await proev("POST gjenopprett fra kopien før tømmingen", 200, () =>
    finn("POST", "vedlikehold/gjenopprett").handler(req({ method: "POST", headers: JSONH, body: { id: foerKopi.id, bekreft: foerKopi.antallAar } })));
  console.log(`         → ${tilbake.jsonBody?.aar} år tilbake fra ${tilbake.jsonBody?.fra}`);

  const etterGjenoppretting = await finn("POST", "vedlikehold/tom").handler(req({ method: "POST", headers: JSONH, body: {} }));
  const alleTilbake = etterGjenoppretting.jsonBody?.telling?.aar === foerKopi.antallAar;
  console.log(`  ${alleTilbake ? "ok  " : "FEIL"}  ${"Alle årene er tilbake".padEnd(46)}`);
  if (!alleTilbake) { feilet++; console.log("         →", etterGjenoppretting.jsonBody?.telling); }

  const indeksEtter = await finn("GET", "indeks").handler(req({}));
  const indeksBygd = indeksEtter.jsonBody?.aar?.length === foerKopi.antallAar;
  console.log(`  ${indeksBygd ? "ok  " : "FEIL"}  ${"Indeksen er bygd på nytt".padEnd(46)}`);
  if (!indeksBygd) feilet++;

  const tilgangEtter = await lesJson(CONTAINER.innhold, STI.tilgang);
  const proevelisteStaar = tilgangEtter?.verdi?.personer?.some((p) => p.epost === REDAKTOER);
  console.log(`  ${proevelisteStaar ? "ok  " : "FEIL"}  ${"Gjenoppretting rørte ikke tilgangslisten".padEnd(46)}`);
  if (!proevelisteStaar) feilet++;
} else {
  console.log("  hopp  Selve slettingen (kjør med --tom for å ta den)");
}

await rydd();
await gjenopprettTilgang();

console.log(feilet === 0 ? "\nAlle kontroller gikk gjennom.\n" : `\n${feilet} kontroller feilet.\n`);
process.exit(feilet === 0 ? 0 : 1);
