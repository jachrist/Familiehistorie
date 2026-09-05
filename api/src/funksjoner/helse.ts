import { app, type HttpResponseInit } from "@azure/functions";
import type { Tilgangsliste } from "../../../delt/typer.js";
import { epostErSattOpp } from "../epost.js";
import { CONTAINER, STI, lesJson } from "../lager.js";
import { json } from "../svar.js";

/**
 * Er oppsettet på plass?
 *
 * Uten innlogging, med vilje: den som ikke kommer inn, er nettopp den som
 * trenger svaret. Endepunktet svarer bare ja/nei om hvorvidt hver del *er
 * konfigurert* – aldri med verdier, aldri med hvem som står på tilgangslisten.
 *
 * Bakgrunnen er at /api/auth/kode alltid svarer 202 for ikke å røpe hvem som er
 * i familien. Det er riktig, men gjør at et oppsett som mangler ser nøyaktig ut
 * som et vellykket kall. Da må svaret finnes et annet sted.
 */
app.http("helse", {
  methods: ["GET"],
  route: "helse",
  authLevel: "anonymous",
  handler: async (): Promise<HttpResponseInit> => {
    const svar = {
      lager: false,
      tilgangsliste: false,
      antallPersoner: 0,
      antallRedaktoerer: 0,
      epostOppsett: epostErSattOpp(),
      avsenderdomene: process.env.EPOST_AVSENDER?.split("@")[1] ?? null,
      sesjonsnokkel: (process.env.SESJON_HEMMELIGHET ?? "").trim().length >= 32,
      miljo: process.env.MILJO ?? "drift",
      merknader: [] as string[],
    };

    try {
      const lest = await lesJson<Tilgangsliste>(CONTAINER.innhold, STI.tilgang);
      svar.lager = true;
      if (lest) {
        svar.tilgangsliste = true;
        svar.antallPersoner = lest.verdi.personer.length;
        svar.antallRedaktoerer = lest.verdi.personer.filter((p) =>
          p.roller.includes("redaktoer")
        ).length;
      }
    } catch (e) {
      svar.merknader.push(
        `Fikk ikke lest fra lagringskontoen: ${e instanceof Error ? e.message : "ukjent feil"}`
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
        "ACS_TILKOBLING og/eller EPOST_AVSENDER mangler. Ingen engangskoder kan sendes."
      );
    }

    // Alltid 200, også når noe mangler. Et diagnoseendepunkt som svarer 5xx er
    // lett å miste bak en proxy eller et CDN som bytter ut kroppen med sin
    // egen tomme feilside – og da forsvinner nettopp svaret man kom for.
    // Verdien står i `ok` og i merknadene i stedet.
    return json({ ok: svar.merknader.length === 0, ...svar });
  },
});
