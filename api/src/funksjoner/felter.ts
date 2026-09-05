import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import type { Feltskjema } from "../../../delt/typer.js";
import { CONTAINER, STI, lesJson, skrivJson } from "../lager.js";
import { feltskjemaSkjema } from "../skjema.js";
import { feil, json } from "../svar.js";
import { krevRolle } from "../vakt.js";

app.http("felterHent", {
  methods: ["GET"],
  route: "felter",
  authLevel: "anonymous",
  handler: async (req): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("familie", req);
    if (vakt.nektet) return vakt.nektet;

    const lest = await lesJson<Feltskjema>(CONTAINER.innhold, STI.felter);
    if (!lest) {
      return feil(
        503,
        "Feltdefinisjonene mangler. Kjør `npm run seed` for å legge dem inn."
      );
    }
    return json(lest.verdi, { headers: { ETag: lest.etag } });
  },
});

app.http("felterLagre", {
  methods: ["PUT"],
  route: "felter",
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

    const validert = feltskjemaSkjema.safeParse(raa);
    if (!validert.success) {
      return feil(
        422,
        "Feltdefinisjonene er ikke gyldige.",
        validert.error.issues.map((f) => `${f.path.join(".")}: ${f.message}`)
      );
    }

    const etag = await skrivJson(CONTAINER.innhold, STI.felter, validert.data);
    return json(validert.data, { headers: { ETag: etag } });
  },
});
