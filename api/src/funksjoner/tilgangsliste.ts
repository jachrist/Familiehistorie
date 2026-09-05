import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import type { Tilgangsliste, TilgangslisteMedEtag } from "../../../delt/typer.js";
import { CONTAINER, STI, lesJson, skrivJson } from "../lager.js";
import { tilgangslisteSkjema } from "../skjema.js";
import { feil, json } from "../svar.js";
import { tomBuffer } from "../tilgang.js";
import { erStatus } from "../lager.js";
import { krevRolle } from "../vakt.js";

app.http("tilgangHent", {
  methods: ["GET"],
  route: "tilgang",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    const lest = await lesJson<Tilgangsliste>(CONTAINER.innhold, STI.tilgang);
    if (!lest) return feil(503, "Tilgangslisten mangler.");

    const svar: TilgangslisteMedEtag = { ...lest.verdi, etag: lest.etag };
    return json(svar);
  },
});

app.http("tilgangLagre", {
  methods: ["PUT"],
  route: "tilgang",
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

    const validert = tilgangslisteSkjema.safeParse(raa);
    if (!validert.success) {
      return feil(
        422,
        "Tilgangslisten er ikke gyldig.",
        validert.error.issues.map((f) => f.message)
      );
    }

    const etag = req.headers.get("if-match") ?? undefined;
    let ny: string;
    try {
      ny = await skrivJson(CONTAINER.innhold, STI.tilgang, validert.data, { ifMatch: etag });
    } catch (e) {
      if (erStatus(e, 412)) {
        return feil(412, "Listen er endret et annet sted. Hent den på nytt og prøv igjen.");
      }
      throw e;
    }

    // Uten dette ville en endring blitt hengende i inntil ett minutt før den
    // fikk virkning – forvirrende akkurat når man tester at den virket.
    tomBuffer();

    const svar: TilgangslisteMedEtag = { ...validert.data, etag: ny };
    return json(svar);
  },
});
