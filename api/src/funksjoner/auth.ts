import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { z } from "zod";
import type { Innlogget } from "../../../delt/typer.js";
import { sendKode } from "../epost.js";
import { KODE_LEVETID_MINUTTER, bekreftKode, kanBestille, lagKode } from "../kode.js";
import { boerFornyes, fjernKapsel, settKapsel, utstedToken, KAPSELNAVN, kapselFra, lesToken } from "../sesjon.js";
import { feil, json } from "../svar.js";
import { finnPerson } from "../tilgang.js";
import { innlogget } from "../vakt.js";

const epostSkjema = z.object({
  epost: z.string().trim().min(3).max(254).email(),
});

const verifiserSkjema = epostSkjema.extend({
  kode: z
    .string()
    .trim()
    // Familien kommer til å lime inn koden med mellomrom i. Det er ikke en feil
    // verdt å avvise et innloggingsforsøk for.
    .transform((k) => k.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Koden er seks siffer.")),
});

async function lesKropp<T>(
  req: HttpRequest,
  skjema: z.ZodType<T>
): Promise<{ data: T; nektet?: undefined } | { data?: undefined; nektet: HttpResponseInit }> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return { nektet: feil(415, "Forespørselen må sendes som application/json.") };
  }

  let raa: unknown;
  try {
    raa = await req.json();
  } catch {
    return { nektet: feil(400, "Kroppen er ikke gyldig JSON.") };
  }

  const validert = skjema.safeParse(raa);
  if (!validert.success) {
    return { nektet: feil(422, "Ugyldig forespørsel.", validert.error.issues.map((f) => f.message)) };
  }
  return { data: validert.data };
}

/**
 * Bestiller en engangskode.
 *
 * Svarer alltid 202, uansett om adressen står i tilgangslisten, om taket for
 * bestillinger er nådd, eller om e-postutsendingen feilet. Et endepunkt som
 * svarte forskjellig, ville fortalt hvem som er i familien til hvem som helst
 * som gjettet på adresser.
 */
app.http("authKode", {
  methods: ["POST"],
  route: "auth/kode",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const kropp = await lesKropp(req, epostSkjema);
    if (kropp.nektet) return kropp.nektet;

    const svar = json(
      {
        sendt: true,
        gyldigMinutter: KODE_LEVETID_MINUTTER,
        beskjed: `Får vi treff på adressen, kommer det en kode på e-post. Den er gyldig i ${KODE_LEVETID_MINUTTER} minutter.`,
      },
      { status: 202 }
    );

    try {
      const person = await finnPerson(kropp.data.epost);
      if (!person) return svar;
      if (!(await kanBestille(person.epost))) return svar;

      const kode = await lagKode(person.epost);
      await sendKode(person.epost, person.navn, kode);
    } catch (e) {
      // Logges, men lekker ikke ut. Klienten skal ikke kunne skille «finnes
      // ikke» fra «noe gikk galt hos oss».
      console.error("Klarte ikke sende engangskode:", e);
    }

    return svar;
  },
});

app.http("authVerifiser", {
  methods: ["POST"],
  route: "auth/verifiser",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const kropp = await lesKropp(req, verifiserSkjema);
    if (kropp.nektet) return kropp.nektet;

    const person = await finnPerson(kropp.data.epost);
    // Ukjent adresse behandles som feil kode. Samme svar, samme statuskode.
    if (!person) return feil(401, "Koden stemmer ikke, eller den har gått ut.");

    const utfall = await bekreftKode(person.epost, kropp.data.kode);
    if (utfall === "for_mange_forsok") {
      return feil(429, "For mange forsøk. Be om en ny kode.");
    }
    if (utfall !== "ok") {
      return feil(401, "Koden stemmer ikke, eller den har gått ut.");
    }

    const meg: Innlogget = { epost: person.epost, navn: person.navn, roller: person.roller };
    return json(meg, { headers: { "Set-Cookie": settKapsel(utstedToken(person.epost)) } });
  },
});

/**
 * Hvem er innlogget nå.
 *
 * Klienten kan ikke lese kapselen, så dette er eneste vei til å vite om noen er
 * logget inn – og en forbedring i seg selv: serveren er eneste kilde til hvilke
 * roller som gjelder akkurat nå.
 *
 * Sesjonen fornyes her, ikke ved hvert kall. SPA-en spør ved oppstart, så en
 * som bruker nettstedet jevnlig blir aldri logget ut.
 */
app.http("meg", {
  methods: ["GET"],
  route: "meg",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const person = await innlogget(req);
    if (!person) return feil(401, "Ikke innlogget.");

    const meg: Innlogget = { epost: person.epost, navn: person.navn, roller: person.roller };

    const sesjon = lesToken(kapselFra(req.headers.get("cookie"), KAPSELNAVN));
    if (sesjon && boerFornyes(sesjon)) {
      return json(meg, { headers: { "Set-Cookie": settKapsel(utstedToken(person.epost)) } });
    }
    return json(meg);
  },
});

app.http("authLoggUt", {
  methods: ["POST"],
  route: "auth/logg-ut",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const type = req.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("application/json")) {
      return feil(415, "Forespørselen må sendes som application/json.");
    }
    // Utlogging krever ingen gyldig sesjon: å be om å bli logget ut når man
    // allerede er det, skal ikke være en feil.
    return json({ loggetUt: true }, { headers: { "Set-Cookie": fjernKapsel() } });
  },
});
