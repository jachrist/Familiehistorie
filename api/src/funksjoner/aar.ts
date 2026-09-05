import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import type {
  Aarsdokument,
  AarsdokumentMedUrl,
  Feltskjema,
  MedieobjektMedUrl,
} from "../../../delt/typer.js";
import { byggIndeks } from "../indeksBygger.js";
import { CONTAINER, STI, erStatus, lesJson, skrivJson, slettBlob } from "../lager.js";
import { leseUrl } from "../sas.js";
import { validerAar } from "../skjema.js";
import { feil, json, lesAarstall } from "../svar.js";
import { krevRolle } from "../vakt.js";

/**
 * Legger kortlevde lese-URL-er på hvert medieobjekt. Stiene som lagres i
 * årsdokumentet er alltid usignerte – signaturen hører til svaret, ikke til
 * dataene.
 */
async function medUrler(media: Aarsdokument["media"]): Promise<MedieobjektMedUrl[]> {
  return Promise.all(
    media.map(async (m) => ({
      ...m,
      url: await leseUrl(CONTAINER.media, m.fil),
      miniatyrUrl: m.miniatyr ? await leseUrl(CONTAINER.media, m.miniatyr) : null,
      plakatUrl: m.plakat ? await leseUrl(CONTAINER.media, m.plakat) : null,
    }))
  );
}

app.http("aarHent", {
  methods: ["GET"],
  route: "aar/{aar}",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("familie", req);
    if (vakt.nektet) return vakt.nektet;

    const aar = lesAarstall(req.params.aar);
    if (aar === undefined) return feil(400, "Ugyldig årstall.");

    const lest = await lesJson<Aarsdokument>(CONTAINER.innhold, STI.aar(aar));
    if (!lest) return feil(404, `Året ${aar} finnes ikke.`);

    const svar: AarsdokumentMedUrl = {
      ...lest.verdi,
      media: await medUrler(lest.verdi.media ?? []),
      etag: lest.etag,
    };
    return json(svar, { headers: { ETag: lest.etag } });
  },
});

app.http("aarLagre", {
  methods: ["PUT"],
  route: "aar/{aar}",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    const aar = lesAarstall(req.params.aar);
    if (aar === undefined) return feil(400, "Ugyldig årstall.");

    const skjema = await lesJson<Feltskjema>(CONTAINER.innhold, STI.felter);
    if (!skjema) return feil(503, "Feltdefinisjonene mangler.");

    let raa: unknown;
    try {
      raa = await req.json();
    } catch {
      return feil(400, "Kroppen er ikke gyldig JSON.");
    }

    const validert = validerAar(skjema.verdi, raa);
    if (!validert.ok) return feil(422, "Året kunne ikke lagres.", validert.problemer);

    const ifMatch = req.headers.get("if-match") ?? undefined;
    const fra = await lesJson<Aarsdokument>(CONTAINER.innhold, STI.aar(aar));

    // Uten If-Match tillates bare oppretting. Da kan en klient som ikke har
    // lest dokumentet først, aldri overskrive noe uten å vite det.
    if (!ifMatch && fra) {
      return feil(409, `Året ${aar} finnes allerede. Hent det først og send ETag-en som If-Match.`);
    }

    const naa = new Date().toISOString();
    const dok: Aarsdokument = {
      aar,
      felter: validert.verdi.felter,
      media: validert.verdi.media,
      status: validert.verdi.status,
      opprettet: fra?.verdi.opprettet ?? naa,
      endret: naa,
      endretAv: vakt.person.epost,
      skjemaversjon: skjema.verdi.versjon,
    };

    let etag: string;
    try {
      etag = await skrivJson(
        CONTAINER.innhold,
        STI.aar(aar),
        dok,
        ifMatch ? { ifMatch } : { maaVaereNy: true }
      );
    } catch (e) {
      if (erStatus(e, 412)) {
        return feil(412, "Året er endret et annet sted. Last inn på nytt og prøv igjen.");
      }
      if (erStatus(e, 409)) {
        return feil(409, `Året ${aar} finnes allerede.`);
      }
      throw e;
    }

    await byggIndeks();

    const svar: AarsdokumentMedUrl = {
      ...dok,
      media: await medUrler(dok.media),
      etag,
    };
    return json(svar, { status: fra ? 200 : 201, headers: { ETag: etag } });
  },
});

app.http("aarSlett", {
  methods: ["DELETE"],
  route: "aar/{aar}",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    const aar = lesAarstall(req.params.aar);
    if (aar === undefined) return feil(400, "Ugyldig årstall.");

    const fantes = await slettBlob(CONTAINER.innhold, STI.aar(aar));
    if (!fantes) return feil(404, `Året ${aar} finnes ikke.`);

    // Mediefilene blir liggende med vilje. Blob-versjonering gjør slettingen
    // angrbar, og et år som slettes ved et uhell skal kunne gjenopprettes med
    // bildene i behold. Opprydding hører til et eget vedlikeholdsendepunkt.
    await byggIndeks();
    return json({ slettet: aar });
  },
});
