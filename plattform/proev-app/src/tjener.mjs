/**
 * Prøveapp for plattformoppsettet.
 *
 * Hensikten er ikke appen, men å bevise at infrastrukturen henger sammen:
 * reverse proxy, TLS, container som starter på nytt, disk som overlever
 * omstart, utrulling som faktisk traff, og sikkerhetskopi som får med seg
 * dataene.
 *
 * Den treffer med vilje de samme primitivene som Familiehistorie:
 * skriver filer til disk, serverer dem tilbake, og har et helsesjekk-endepunkt.
 *
 * Ingen avhengigheter. Da er det ingenting mellom deg og feilen når noe ryker.
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { hostname } from "node:os";

const PORT = Number(process.env.PORT ?? 8080);
const DATAKATALOG = resolve(process.env.DATAKATALOG ?? "/data");
const VERSJON = process.env.VERSJON ?? "ukjent";
const BYGGET = process.env.BYGGET ?? "ukjent";
const MAKS_BYTES = 25 * 1024 * 1024;

const TYPER = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "text/plain": ".txt",
};
const ETTER_ENDELSE = Object.fromEntries(
  Object.entries(TYPER).map(([type, endelse]) => [endelse, type])
);

const startet = Date.now();

/**
 * Et filnavn fra en klient er alltid mistenkelig. Vi beholder bare tegn vi
 * kjenner, og kutter alt som kan tolkes som en katalogsti.
 */
function trygtNavn(raa) {
  const bare = (raa ?? "").split(/[\\/]/).pop() ?? "";
  const rensket = bare
    .normalize("NFC")
    .replace(/[^\w.æøåÆØÅ-]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);
  return rensket === "" ? "uten-navn" : rensket;
}

function json(rs, status, kropp) {
  const tekst = JSON.stringify(kropp, null, 2);
  rs.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  rs.end(tekst);
}

async function lesKropp(rq, maks) {
  const biter = [];
  let lengde = 0;
  for await (const bit of rq) {
    lengde += bit.length;
    if (lengde > maks) throw new Error("For stor");
    biter.push(bit);
  }
  return Buffer.concat(biter);
}

async function listFiler() {
  const navn = await readdir(DATAKATALOG).catch(() => []);
  const filer = await Promise.all(
    navn.map(async (n) => {
      const s = await stat(join(DATAKATALOG, n)).catch(() => undefined);
      return s?.isFile() ? { navn: n, bytes: s.size, endret: s.mtime.toISOString() } : undefined;
    })
  );
  return filer.filter((f) => f !== undefined).sort((a, b) => b.endret.localeCompare(a.endret));
}

function side(filer) {
  const rader =
    filer.length === 0
      ? `<p class="tom">Ingen filer ennå. Last opp noe for å teste at disken overlever en omstart.</p>`
      : `<ul class="filer">${filer
          .map(
            (f) => `<li>
              <a href="/filer/${encodeURIComponent(f.navn)}">${escape(f.navn)}</a>
              <span>${(f.bytes / 1024).toFixed(1)} kB · ${escape(f.endret.slice(0, 19).replace("T", " "))}</span>
            </li>`
          )
          .join("")}</ul>`;

  return `<!doctype html><html lang="nb"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prøveapp</title>
<style>
  :root{--g:#F4F3F0;--f:#fff;--b:#1C1A17;--s:#5A554C;--m:#8C867A;--l:#D3CFC6;--a:#2F6B4F;color-scheme:light}
  @media(prefers-color-scheme:dark){:root{--g:#14130F;--f:#1D1B17;--b:#EDEAE3;--s:#A8A196;--m:#7B7469;--l:#332F28;--a:#7FBF9C;color-scheme:dark}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--g);color:var(--b);font:16px/1.6 system-ui,sans-serif}
  .ark{max-width:680px;margin:0 auto;padding:48px 24px 80px}
  h1{margin:0 0 4px;font-size:30px;letter-spacing:-.02em}
  .u{margin:0 0 28px;color:var(--s)}
  .kort{background:var(--f);border:1px solid var(--l);border-radius:8px;padding:18px 20px;margin:0 0 18px}
  dl{display:grid;grid-template-columns:auto 1fr;gap:6px 18px;margin:0;font-size:14.5px}
  dt{color:var(--m)}
  dd{margin:0;font-variant-numeric:tabular-nums;word-break:break-all}
  .slipp{border:1.5px dashed var(--l);border-radius:8px;padding:26px 20px;text-align:center;background:var(--f)}
  .slipp.over{border-color:var(--a)}
  input[type=file]{position:absolute;width:1px;height:1px;opacity:0}
  label.velg{color:var(--a);text-decoration:underline;cursor:pointer}
  .filer{list-style:none;margin:14px 0 0;padding:0;display:flex;flex-direction:column;gap:1px;background:var(--l);border:1px solid var(--l);border-radius:6px;overflow:hidden}
  .filer li{background:var(--f);padding:9px 13px;display:flex;justify-content:space-between;gap:14px;font-size:14.5px}
  .filer span{color:var(--m);white-space:nowrap;font-variant-numeric:tabular-nums}
  .filer a{color:var(--b)}
  .tom{color:var(--m);font-style:italic;margin:14px 0 0}
  #status{margin:12px 0 0;font-size:14px;color:var(--s);min-height:1.4em}
  h2{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--m);margin:26px 0 8px;font-weight:600}
</style></head><body><div class="ark">
<h1>Prøveapp</h1>
<p class="u">Beviser at plattformen henger sammen. Appen er poengløs med vilje.</p>

<h2>Denne instansen</h2>
<div class="kort"><dl>
  <dt>Versjon</dt><dd>${escape(VERSJON)}</dd>
  <dt>Bygget</dt><dd>${escape(BYGGET)}</dd>
  <dt>Vert</dt><dd>${escape(hostname())}</dd>
  <dt>Oppe i</dt><dd>${Math.floor((Date.now() - startet) / 1000)} s</dd>
  <dt>Datakatalog</dt><dd>${escape(DATAKATALOG)}</dd>
</dl></div>

<h2>Disk</h2>
<div class="slipp" id="slipp">
  <p style="margin:0">Slipp en fil her, eller <label class="velg">velg en<input type="file" id="fil" accept="${Object.keys(TYPER).join(",")}"></label>.</p>
  <p style="margin:8px 0 0;font-size:13px;color:var(--m)">Maks 25 MB. Filene skal overleve <code>docker compose restart</code>.</p>
</div>
<p id="status"></p>
${rader}

</div><script>
const slipp=document.getElementById('slipp'),felt=document.getElementById('fil'),status=document.getElementById('status');
async function sendFil(f){
  if(!f)return;
  status.textContent='Laster opp '+f.name+' …';
  try{
    const r=await fetch('/opplasting/'+encodeURIComponent(f.name),{method:'PUT',headers:{'content-type':f.type||'application/octet-stream'},body:f});
    const s=await r.json();
    if(!r.ok)throw new Error(s.feil||('HTTP '+r.status));
    status.textContent='Lagret som '+s.navn;
    setTimeout(()=>location.reload(),600);
  }catch(e){status.textContent='Feilet: '+e.message}
}
felt.addEventListener('change',e=>sendFil(e.target.files[0]));
slipp.addEventListener('dragover',e=>{e.preventDefault();slipp.classList.add('over')});
slipp.addEventListener('dragleave',()=>slipp.classList.remove('over'));
slipp.addEventListener('drop',e=>{e.preventDefault();slipp.classList.remove('over');sendFil(e.dataTransfer.files[0])});
</script></body></html>`;
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const tjener = createServer(async (rq, rs) => {
  const url = new URL(rq.url ?? "/", `http://${rq.headers.host ?? "localhost"}`);
  const sti = decodeURIComponent(url.pathname);

  try {
    if (sti === "/helse") {
      // Caddy og eventuell overvåking spør her. Skal være billig og ærlig.
      await stat(DATAKATALOG);
      return json(rs, 200, { status: "ok", versjon: VERSJON, oppetidSekunder: Math.floor((Date.now() - startet) / 1000) });
    }

    if (sti === "/versjon") {
      return json(rs, 200, { versjon: VERSJON, bygget: BYGGET, vert: hostname(), node: process.version });
    }

    if (sti === "/" && rq.method === "GET") {
      const kropp = side(await listFiler());
      rs.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      return rs.end(kropp);
    }

    if (sti.startsWith("/opplasting/") && rq.method === "PUT") {
      const type = (rq.headers["content-type"] ?? "").split(";")[0].trim();
      const endelse = TYPER[type];
      if (!endelse) return json(rs, 415, { feil: `Filtypen ${type || "ukjent"} støttes ikke.` });

      const oenskeNavn = trygtNavn(sti.slice("/opplasting/".length));
      const navn = extname(oenskeNavn).toLowerCase() === endelse ? oenskeNavn : oenskeNavn + endelse;

      let data;
      try {
        data = await lesKropp(rq, MAKS_BYTES);
      } catch {
        return json(rs, 413, { feil: "Filen er større enn 25 MB." });
      }

      await mkdir(DATAKATALOG, { recursive: true });
      await writeFile(join(DATAKATALOG, navn), data);
      return json(rs, 201, { navn, bytes: data.length });
    }

    if (sti.startsWith("/filer/") && rq.method === "GET") {
      const navn = trygtNavn(sti.slice("/filer/".length));
      const full = join(DATAKATALOG, navn);
      // Dobbeltsjekk at vi ikke har kommet oss ut av datakatalogen.
      if (!full.startsWith(DATAKATALOG + "/") && full !== DATAKATALOG) {
        return json(rs, 400, { feil: "Ugyldig filnavn." });
      }
      const s = await stat(full).catch(() => undefined);
      if (!s?.isFile()) return json(rs, 404, { feil: "Finnes ikke." });

      rs.writeHead(200, {
        "content-type": ETTER_ENDELSE[extname(navn).toLowerCase()] ?? "application/octet-stream",
        "content-length": s.size,
        "cache-control": "public, max-age=3600",
      });
      return createReadStream(full).pipe(rs);
    }

    return json(rs, 404, { feil: "Ukjent sti." });
  } catch (e) {
    console.error(`${rq.method} ${sti} feilet:`, e);
    return json(rs, 500, { feil: "Uventet feil." });
  }
});

// Bind til alle grensesnitt inne i containeren; Compose slipper bare
// localhost inn utenfra, og Caddy er det eneste som snakker med oss.
tjener.listen(PORT, "0.0.0.0", () => {
  console.log(`Prøveapp ${VERSJON} lytter på ${PORT}, data i ${DATAKATALOG}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} mottatt, avslutter pent.`);
    tjener.close(() => process.exit(0));
    // Docker gir oss ti sekunder; ta ikke hele.
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
