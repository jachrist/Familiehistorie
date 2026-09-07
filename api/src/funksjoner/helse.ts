import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import type { Tilgangsliste } from "../../../delt/typer.js";
import { epostErSattOpp } from "../epost.js";
import { sisteUtfall, sjekkTabellager } from "../hendelse.js";
import { CONTAINER, STI, lesJson } from "../lager.js";
import { json } from "../svar.js";
import { harRolle } from "../tilgang.js";
import { innlogget } from "../vakt.js";

/**
 * Er oppsettet på plass?
 *
 * Uten innlogging, med vilje: den som ikke kommer inn, er nettopp den som
 * trenger svaret. For en som ikke er logget inn er svaret bare ja/nei om
 * hvorvidt hver del *er konfigurert* – aldri med verdier, og aldri med hvem som
 * står på tilgangslisten.
 *
 * Bakgrunnen er at /api/auth/kode alltid svarer 202 for ikke å røpe hvem som er
 * i familien. Det er riktig, men gjør at et oppsett som mangler ser nøyaktig ut
 * som et vellykket kall. Da må svaret finnes et annet sted.
 *
 * En innlogget redaktør får i tillegg de maskerte adressene og utfallet av
 * siste kodebestilling. De sto tidligere i det åpne svaret, fordi den offentlige
 * diagnosesiden trengte dem. Den siden er fjernet, og da er det ingen grunn til
 * at hvem som helst skal kunne telle familiemedlemmer.
 */

/**
 * `jan.christiansen@jcconsulting.no` → `ja***@jcconsulting.no`.
 *
 * Nok til at man kjenner igjen sin egen adresse, for lite til at noen kan gjette
 * seg til andres – også en redaktør ser bare dette.
 */
function masker(epost: string): string {
  const [lokal = "", domene = ""] = epost.split("@");
  return `${lokal.slice(0, 2)}***@${domene}`;
}

app.http("helse", {
  methods: ["GET"],
  route: "helse",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const person = await innlogget(req).catch(() => undefined);
    const erRedaktoer = person ? harRolle(person, "redaktoer") : false;

    const svar = {
      lager: false,
      tabellager: false,
      tilgangsliste: false,
      antallPersoner: 0,
      antallRedaktoerer: 0,
      epostOppsett: epostErSattOpp(),
      avsenderdomene: process.env.EPOST_AVSENDER?.split("@")[1] ?? null,
      sesjonsnokkel: (process.env.SESJON_HEMMELIGHET ?? "").trim().length >= 32,
      miljo: process.env.MILJO ?? "drift",
      merknader: [] as string[],
    };

    let adresser: string[] = [];

    try {
      const lest = await lesJson<Tilgangsliste>(CONTAINER.innhold, STI.tilgang);
      svar.lager = true;
      if (lest) {
        svar.tilgangsliste = true;
        svar.antallPersoner = lest.verdi.personer.length;
        svar.antallRedaktoerer = lest.verdi.personer.filter((p) =>
          p.roller.includes("redaktoer")
        ).length;
        adresser = lest.verdi.personer.map((p) => masker(p.epost));
      }
    } catch (e) {
      svar.merknader.push(
        `Fikk ikke lest fra lagringskontoen: ${e instanceof Error ? e.message : "ukjent feil"}`
      );
    }

    // Tabellen brukes av rate-limiteren og av kodelagringen, begge *før*
    // e-posten sendes. Svarer den ikke, kommer ingen kode fram uansett hvor
    // riktig e-postoppsettet er.
    const tabellfeil = await sjekkTabellager();
    svar.tabellager = tabellfeil === null;
    if (tabellfeil) {
      svar.merknader.push(
        `Table Storage svarer ikke: ${tabellfeil}. Ingen engangskoder kan lages.`
      );
    }

    if (!svar.lager) svar.merknader.push("LAGER_TILKOBLING mangler eller er feil.");
    if (svar.lager && !svar.tilgangsliste) {
      svar.merknader.push("innhold/tilgang.json finnes ikke. Kjør npm run seed:sky.");
    }
    if (!svar.sesjonsnokkel) {
      svar.merknader.push("SESJON_HEMMELIGHET mangler eller er kortere enn 32 tegn.");
    }
    if (!svar.epostOppsett) {
      svar.merknader.push(
        "RESEND_NOKKEL og/eller EPOST_AVSENDER mangler. Ingen engangskoder kan sendes."
      );
    }

    const ok = svar.merknader.length === 0;

    // Alltid 200, også når noe mangler. Et diagnoseendepunkt som svarer 5xx er
    // lett å miste bak en proxy eller et CDN som bytter ut kroppen med sin
    // egen tomme feilside – og da forsvinner nettopp svaret man kom for.
    // Verdien står i `ok` og i merknadene i stedet.
    if (!erRedaktoer) return json({ ok, ...svar });

    return json({
      ok,
      ...svar,
      adresser,
      // Hva som faktisk skjedde sist noen ba om en kode. Svarer i sanntid, i
      // motsetning til Application Insights.
      sisteKodebestilling: await sisteUtfall(),
    });
  },
});
