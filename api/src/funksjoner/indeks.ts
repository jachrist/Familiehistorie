import { app, type HttpResponseInit } from "@azure/functions";
import type { Indeks } from "../../../delt/typer.js";
import { byggIndeks } from "../indeksBygger.js";
import { CONTAINER, STI, lesJson } from "../lager.js";
import { feil, json } from "../svar.js";
import { krevRolle } from "../vakt.js";

app.http("indeksHent", {
  methods: ["GET"],
  route: "indeks",
  authLevel: "anonymous",
  handler: async (req): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("familie", req);
    if (vakt.nektet) return vakt.nektet;

    const lest = await lesJson<Indeks>(CONTAINER.innhold, STI.indeks);
    // Mangler indeksen, bygges den heller enn å feile. Den er avledet data, og
    // et tomt arkiv har ganske enkelt ikke rukket å få en ennå.
    if (!lest) {
      try {
        return json(await byggIndeks());
      } catch (e) {
        return feil(503, e instanceof Error ? e.message : "Klarte ikke bygge indeksen.");
      }
    }
    return json(lest.verdi, { headers: { ETag: lest.etag } });
  },
});

app.http("indeksBygg", {
  methods: ["POST"],
  route: "vedlikehold/bygg-indeks",
  authLevel: "anonymous",
  handler: async (req): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    try {
      return json(await byggIndeks());
    } catch (e) {
      return feil(503, e instanceof Error ? e.message : "Klarte ikke bygge indeksen.");
    }
  },
});
