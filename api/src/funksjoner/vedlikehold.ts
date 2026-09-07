import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { z } from "zod";
import type { Telling, Tommesvar } from "../../../delt/typer.js";
import { CONTAINER, STI, listBlober, slettBlob } from "../lager.js";
import { iPuljer } from "../puljer.js";
import {
  erGyldigId,
  gjenopprett,
  hentSikkerhetskopi,
  lesInnhold,
  listSikkerhetskopier,
  taSikkerhetskopi,
} from "../sikkerhetskopi.js";
import { byggIndeks } from "../indeksBygger.js";
import { feil, json } from "../svar.js";
import { krevRolle } from "../vakt.js";

/**
 * Vedlikehold fra nettleseren.
 *
 * Skriptene i `verktoy/` gjør det samme, men forutsetter et skall,
 * `npm install` og en tilkoblingsstreng i miljøet. Det er en dårlig avhengighet
 * for et nettsted som ellers drives fra en iPad. Endepunktene her gjør de samme
 * operasjonene tilgjengelige for en innlogget redaktør – med de samme
 * sikringene: tørrkjøring først, bekreftelse av antallet, og en sikkerhetskopi
 * før noe slettes.
 */

/**
 * Så mange blober slettes per kall.
 *
 * Managed functions på gratisplanen har en fast tidsgrense, og en tømming av et
 * arkiv med tusenvis av bilder rekker ikke innenfor den. Svaret sier hvor mange
 * som gjenstår, og siden ber om en runde til. Bedre enn en operasjon som ryker
 * halvveis uten å si hvor den kom.
 */
const MAKS_PER_KALL = 800;

app.http("sikkerhetskopiTa", {
  methods: ["POST"],
  route: "vedlikehold/sikkerhetskopi",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    try {
      return json(await taSikkerhetskopi(vakt.person.epost, "Manuell"));
    } catch (e) {
      return feil(503, `Klarte ikke ta sikkerhetskopi: ${melding(e)}`);
    }
  },
});

app.http("sikkerhetskopiListe", {
  methods: ["GET"],
  route: "vedlikehold/sikkerhetskopi",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    try {
      return json({ kopier: await listSikkerhetskopier() });
    } catch (e) {
      return feil(503, `Klarte ikke lese sikkerhetskopiene: ${melding(e)}`);
    }
  },
});

/**
 * Nedlasting.
 *
 * Svarer med filen som vedlegg, ikke som JSON i et API-svar, slik at en vanlig
 * lenke i nettleseren gir «Lagre i Filer» på iPad. Kapselen følger med fordi
 * dette er en navigasjon til samme opphav.
 */
app.http("sikkerhetskopiHent", {
  methods: ["GET"],
  route: "vedlikehold/sikkerhetskopi/{id}",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const vakt = await krevRolle("redaktoer", req);
    if (vakt.nektet) return vakt.nektet;

    const id = req.params.id ?? "";
    if (!erGyldigId(id)) return feil(400, "Ugyldig referanse til sikkerhetskopi.");

    const tekst = await hentSikkerhetskopi(id);
    if (tekst === undefined) return feil(404, "Fant ikke sikkerhetskopien.");

    return {
      status: 200,
      body: tekst,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="familiehistorie-${id}.json"`,
        "Cache-Control": "no-store",
      },
    };
  },
});

const gjenopprettSkjema = z.object({
  id: z.string().trim(),
  /** Antall år i kopien, slik siden viste det. Samme sikring som ved tømming. */
  bekreft: z.number().int().nonnegative(),
});

/**
 * Skriver en tidligere kopi tilbake.
 *
 * Tar en kopi av dagens innhold først. Å gjenopprette feil kopi er en like
 * plausibel feil som å tømme ved et uhell, og skal kunne angres på samme måte.
 */
app.http("sikkerhetskopiGjenopprett", {
  methods: ["POST"],
  route: "vedlikehold/gjenopprett",
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

    const validert = gjenopprettSkjema.safeParse(raa);
    if (!validert.success) {
      return feil(422, "Ugyldig forespørsel.", validert.error.issues.map((f) => f.message));
    }
    const { id, bekreft } = validert.data;
    if (!erGyldigId(id)) return feil(400, "Ugyldig referanse til sikkerhetskopi.");

    const innhold = await lesInnhold(id);
    if (!innhold) return feil(404, "Fant ikke sikkerhetskopien.");

    if (bekreft !== innhold.aar.length) {
      return feil(
        409,
        `Kopien inneholder ${innhold.aar.length} år, ikke ${bekreft}. Last siden på nytt.`
      );
    }

    let foer;
    try {
      foer = await taSikkerhetskopi(vakt.person.epost, "Før gjenoppretting");
    } catch (e) {
      return feil(
        503,
        `Tok ikke sikkerhetskopi av det som ligger der nå, og gjenopprettet derfor ingenting: ${melding(e)}`
      );
    }

    const skrevet = await gjenopprett(innhold);
    // Indeksen er avledet, og ville ellers beskrevet arkivet slik det var før.
    await byggIndeks();

    return json({ ...skrevet, fra: id, sikkerhetskopi: foer });
  },
});

const tomSkjema = z.object({
  /** Ta med bilder og video. Uten dette røres bare tekstinnholdet. */
  media: z.boolean().optional().default(false),
  /**
   * Antallet klienten så i tørrkjøringen. Uten det er kallet en tørrkjøring.
   * Stemmer det ikke med det som ligger der nå, avvises kallet: da har noe
   * endret seg siden listen ble vist, og man vet ikke lenger hva man sletter.
   */
  bekreft: z.number().int().nonnegative().optional(),
});

app.http("tomInnhold", {
  methods: ["POST"],
  route: "vedlikehold/tom",
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

    const validert = tomSkjema.safeParse(raa);
    if (!validert.success) {
      return feil(422, "Ugyldig forespørsel.", validert.error.issues.map((f) => f.message));
    }
    const { media: taMedMedia, bekreft } = validert.data;

    const maal = await finnMaal(taMedMedia);
    const telling = tell(maal);

    if (bekreft === undefined) {
      const svar: Tommesvar = {
        torrkjoring: true,
        telling,
        slettet: 0,
        gjenstaar: 0,
        sikkerhetskopi: null,
      };
      return json(svar);
    }

    if (bekreft !== telling.sum) {
      return feil(
        409,
        `Innholdet er endret siden du talte opp. Det ligger ${telling.sum} filer der nå, ikke ${bekreft}. Tell opp på nytt.`
      );
    }

    // Sikkerhetskopien tas før noe slettes, uten at noen ber om det. Det er den
    // eneste operasjonen i appen som ikke kan angres fra appen selv, og en kopi
    // koster noen kilobyte.
    let kopi;
    try {
      kopi = await taSikkerhetskopi(vakt.person.epost, "Før tømming");
    } catch (e) {
      return feil(
        503,
        `Tok ikke sikkerhetskopi, og slettet derfor ingenting: ${melding(e)}`
      );
    }

    const denne = maal.slice(0, MAKS_PER_KALL);
    await iPuljer(denne, 12, ([containernavn, sti]) => slettBlob(containernavn, sti));

    const svar: Tommesvar = {
      torrkjoring: false,
      telling,
      slettet: denne.length,
      gjenstaar: maal.length - denne.length,
      sikkerhetskopi: kopi,
    };
    return json(svar);
  },
});

type Maal = [container: string, sti: string];

/**
 * Hva en tømming ville tatt.
 *
 * `felter.json` og `tilgang.json` er filtrert bort her, ikke bare utelatt av
 * prefikset: feltdefinisjonene er oppsett, og tilgangslisten er veien inn igjen.
 * Å slette dem ville låst alle ute av et nettsted som samtidig var tomt.
 */
async function finnMaal(taMedMedia: boolean): Promise<Maal[]> {
  const innhold = (await listBlober(CONTAINER.innhold)).filter(
    (sti) =>
      sti !== STI.felter && sti !== STI.tilgang && (sti === STI.indeks || /^aar\/\d{3,4}\.json$/.test(sti))
  );

  const maal: Maal[] = innhold.map((sti) => [CONTAINER.innhold, sti]);
  if (!taMedMedia) return maal;

  for (const navn of [CONTAINER.media, CONTAINER.originaler]) {
    for (const sti of await listBlober(navn)) maal.push([navn, sti]);
  }
  return maal;
}

function tell(maal: Maal[]): Telling {
  const i = (navn: string, filter: (sti: string) => boolean = () => true) =>
    maal.filter(([c, sti]) => c === navn && filter(sti)).length;

  const aar = i(CONTAINER.innhold, (sti) => sti.startsWith("aar/"));
  const indeks = i(CONTAINER.innhold, (sti) => sti === STI.indeks);
  const media = i(CONTAINER.media);
  const originaler = i(CONTAINER.originaler);

  return { aar, indeks, media, originaler, sum: maal.length };
}

function melding(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}
