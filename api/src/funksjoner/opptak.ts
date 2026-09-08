import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import type { Opptaksregister } from "../../../delt/typer.js";
import { CONTAINER, STI, lesJson, skrivJson } from "../lager.js";
import { ID_MONSTER, finnOpptak, medStarttid, tillatteVerter } from "../opptak.js";
import { opptakSkjema } from "../skjema.js";
import { feil, json } from "../svar.js";
import { harRolle } from "../tilgang.js";
import { innlogget, krevRolle } from "../vakt.js";

app.http("opptakHent", {
  methods: ["GET"],
  route: "opptak",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    const lest = await lesJson<Opptaksregister>(CONTAINER.innhold, STI.opptak);
    return json(
      { opptak: lest?.verdi.opptak ?? [], etag: lest?.etag ?? "", verter: tillatteVerter() },
      { headers: lest?.etag ? { ETag: lest.etag } : {} }
    );
  },
});

app.http("opptakLagre", {
  methods: ["PUT"],
  route: "opptak",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    let raa: unknown;
    try {
      raa = await req.json();
    } catch {
      return feil(400, "Kroppen er ikke gyldig JSON.");
    }

    const validert = opptakSkjema.safeParse(raa);
    if (!validert.success) {
      return feil(
        422,
        "Registeret er ikke gyldig.",
        validert.error.issues.map((f) => f.message)
      );
    }

    const etag = req.headers.get("if-match") ?? undefined;
    const finnes = await lesJson<Opptaksregister>(CONTAINER.innhold, STI.opptak);

    // Første lagring har ingenting å låse mot; deretter kreves ETag, slik at to
    // redaktører ikke skriver over hverandre.
    if (finnes && !etag) return feil(409, "Registeret finnes allerede. Hent det på nytt først.");

    try {
      const ny = await skrivJson(
        CONTAINER.innhold,
        STI.opptak,
        validert.data,
        etag ? { ifMatch: etag } : { maaVaereNy: true }
      );
      return json({ ...validert.data, etag: ny }, { headers: { ETag: ny } });
    } catch (e) {
      if (typeof e === "object" && e !== null && "statusCode" in e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 412 || status === 409) {
          return feil(412, "Registeret er endret et annet sted. Hent det på nytt.");
        }
      }
      throw e;
    }
  },
});

/**
 * Sender en innlogget videre til opptaket.
 *
 * Svarer med en liten HTML-side i stedet for JSON når noe er galt. Dette
 * endepunktet nås ved at noen klikker på en lenke i en årstekst, og da er en
 * side med en setning og en vei tilbake riktigere enn et JSON-objekt.
 */
app.http("opptakAapne", {
  methods: ["GET"],
  route: "opptak/{id}",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const id = (req.params.id ?? "").trim().toLowerCase();
    if (!ID_MONSTER.test(id)) {
      return side(400, "Ugyldig lenke", "Adressen ser ikke ut som en opptakslenke.");
    }

    const person = await innlogget(req);
    if (!person || !harRolle(person, "familie")) {
      return side(
        401,
        "Du må logge inn",
        "Opptakene er private. Logg inn på Familiehistorie først, så virker lenken."
      );
    }

    const opptak = await finnOpptak(id);
    if (!opptak) {
      return side(
        404,
        "Fant ikke opptaket",
        "Lenken peker på et opptak som ikke står i registeret lenger. Si fra til den som vedlikeholder nettstedet."
      );
    }

    return {
      status: 302,
      headers: {
        Location: medStarttid(opptak.url, opptak.start),
        // Uten dette kan nettleseren huske omdirigeringen, og en byttet lenke
        // ville fortsatt sendt folk til den gamle.
        "Cache-Control": "no-store",
      },
    };
  },
});

function side(status: number, tittel: string, tekst: string): HttpResponseInit {
  const html =
    `<!doctype html><html lang="no"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${flukt(tittel)}</title><style>` +
    `body{margin:0;background:#eef1f6;color:#101b2d;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.6}` +
    `main{max-width:34rem;margin:0 auto;padding:15vh 20px}` +
    `h1{font-size:1.5rem;margin:0 0 12px}p{margin:0 0 20px;color:#56657d}` +
    `a{color:#14508c}` +
    `@media(prefers-color-scheme:dark){body{background:#0b1018;color:#e3e9f1}p{color:#96a6bc}a{color:#74aae4}}` +
    `</style></head><body><main>` +
    `<h1>${flukt(tittel)}</h1><p>${flukt(tekst)}</p><p><a href="/">Til Familiehistorie</a></p>` +
    `</main></body></html>`;

  return {
    status,
    body: html,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  };
}

function flukt(tekst: string): string {
  return tekst.replace(/[&<>"]/g, (t) =>
    t === "&" ? "&amp;" : t === "<" ? "&lt;" : t === ">" ? "&gt;" : "&quot;"
  );
}
