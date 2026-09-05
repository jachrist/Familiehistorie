/**
 * Kjøres av diagnose.html. Ligger i egen fil fordi CSP-en tillater
 * `script-src 'self'` og ikke inline skript.
 */
const ENDEPUNKTER = [
  { sti: "/api/ping", venter: "200 med teksten ok" },
  { sti: "/api/helse", venter: "200 med JSON" },
  { sti: "/api/meg", venter: "401 med JSON — ingen er innlogget" },
  { sti: "/api/indeks", venter: "401 med JSON" },
];

function flukt(t) {
  return String(t).replace(/[&<>]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"
  );
}

async function proev(e) {
  const start = performance.now();
  try {
    const svar = await fetch(e.sti, { cache: "no-store" });
    const tekst = await svar.text();
    return {
      ...e,
      status: svar.status,
      type: svar.headers.get("content-type") ?? "(ingen content-type)",
      lengde: tekst.length,
      kropp: tekst,
      ms: Math.round(performance.now() - start),
    };
  } catch (feil) {
    return { ...e, status: 0, type: "-", lengde: 0, kropp: String(feil), ms: Math.round(performance.now() - start) };
  }
}

const ut = document.getElementById("ut");

Promise.all(ENDEPUNKTER.map(proev)).then((rader) => {
  ut.innerHTML = rader
    .map((r) => {
      // Grønt betyr «endepunktet svarte som forventet», ikke «alt er bra».
      // En 401 fra /api/meg er riktig svar når ingen er innlogget.
      const forventet =
        (r.sti === "/api/ping" && r.status === 200 && r.kropp.trim() === "ok") ||
        (r.sti === "/api/helse" && r.status === 200 && r.lengde > 0) ||
        ((r.sti === "/api/meg" || r.sti === "/api/indeks") && r.status === 401 && r.lengde > 0);

      const kropp =
        r.lengde === 0
          ? '<pre class="tom">(tom kropp — funksjonsverten svarte ikke)</pre>'
          : `<pre>${flukt(r.kropp.slice(0, 2000))}</pre>`;

      return `
        <div class="rad">
          <span class="status ${forventet ? "ok" : "feil"}">${r.status || "nettverksfeil"}</span>
          <span class="sti">${flukt(r.sti)}</span>
          <div class="meta">venter ${flukt(r.venter)} · ${r.lengde} tegn · ${r.type} · ${r.ms} ms</div>
          ${kropp}
        </div>`;
    })
    .join("");
});
