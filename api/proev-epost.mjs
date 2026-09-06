/**
 * Prøve av e-postutsendingen.
 *
 * Starter en stubb som utgir seg for å være Resend, og sjekker at forespørselen
 * ser ut som den skal – uten å sende en eneste ekte melding. Det er den delen
 * som kan verifiseres uten nettverk og uten å bruke av kvoten.
 *
 * Det prøven *ikke* dekker er leveringen: at nøkkelen er gyldig, at
 * avsenderdomenet er verifisert, og at meldingen kommer fram. Det viser seg
 * bare i drift.
 *
 *   npm run proev:epost
 */
import { createServer } from "node:http";

let fanget;
let svarstatus = 200;
const stubb = createServer((req, res) => {
  let kropp = "";
  req.on("data", (b) => (kropp += b));
  req.on("end", () => {
    fanget = { metode: req.method, sti: req.url, hoder: req.headers, kropp: JSON.parse(kropp) };
    res.writeHead(svarstatus, { "content-type": "application/json" });
    res.end(svarstatus === 200 ? '{"id":"abc-123"}' : '{"message":"Domain not verified"}');
  });
});
await new Promise((r) => stubb.listen(0, "127.0.0.1", r));
const port = stubb.address().port;

process.env.RESEND_URL = `http://127.0.0.1:${port}/emails`;
process.env.RESEND_NOKKEL = "re_proeve_noekkel";
process.env.EPOST_AVSENDER = "Familiehistorie <ikke-svar@eksempel.no>";
process.env.MILJO = "drift";

const { sendKode, epostErSattOpp } = await import("./dist/src/epost.js");

let feil = 0;
function sjekk(navn, ok, detalj) {
  console.log(`  ${ok ? "ok  " : "FEIL"}  ${navn}`);
  if (!ok) { feil++; console.log("        ", detalj); }
}

sjekk("epostErSattOpp() er sann", epostErSattOpp() === true);

await sendKode("tante@eksempel.no", "Tante Kari", "493015");

sjekk("POST mot /emails", fanget.metode === "POST" && fanget.sti === "/emails", `${fanget.metode} ${fanget.sti}`);
sjekk("Bearer-nøkkel i Authorization", fanget.hoder.authorization === "Bearer re_proeve_noekkel", fanget.hoder.authorization);
sjekk("content-type application/json", (fanget.hoder["content-type"] ?? "").startsWith("application/json"));
sjekk("from er avsenderen", fanget.kropp.from === "Familiehistorie <ikke-svar@eksempel.no>", fanget.kropp.from);
sjekk("to er en liste med mottakeren", Array.isArray(fanget.kropp.to) && fanget.kropp.to[0] === "tante@eksempel.no", JSON.stringify(fanget.kropp.to));
sjekk("koden står i emnefeltet", fanget.kropp.subject.includes("493015"), fanget.kropp.subject);
sjekk("koden står i tekstversjonen", fanget.kropp.text.includes("493015"));
sjekk("koden står i html-versjonen", fanget.kropp.html.includes("493015"));
sjekk("fornavn brukt i hilsenen", fanget.kropp.text.startsWith("Hei Tante,"), fanget.kropp.text.slice(0, 20));
sjekk("levetid nevnt", fanget.kropp.text.includes("10 minutter"));

// Feilsvar skal kaste, med Resends egen melding – og uten koden.
svarstatus = 422;
let kastet;
try { await sendKode("tante@eksempel.no", "Tante Kari", "111111"); } catch (e) { kastet = e; }
sjekk("feilsvar kaster", Boolean(kastet), "ingen feil kastet");
sjekk("feilmeldingen tar med Resends grunn", kastet?.message.includes("Domain not verified"), kastet?.message);
sjekk("feilmeldingen lekker ikke koden", !kastet?.message.includes("111111"), kastet?.message);

// Uten nøkkel i drift skal det kastes, ikke logges.
delete process.env.RESEND_NOKKEL;
let kastet2;
try { await sendKode("a@b.no", "A", "222222"); } catch (e) { kastet2 = e; }
sjekk("manglende oppsett i drift kaster", Boolean(kastet2), "ingen feil kastet");

stubb.close();
console.log(feil === 0 ? "\nAlle kontroller gikk gjennom.\n" : `\n${feil} kontroller feilet.\n`);
process.exit(feil === 0 ? 0 : 1);
