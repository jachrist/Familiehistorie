import { app, type HttpResponseInit } from "@azure/functions";
import type { Tilgangsliste } from "../../../delt/typer.js";
import { epostErSattOpp } from "../epost.js";
import { sisteUtfall, sjekkTabellager } from "../hendelse.js";
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
/**
 * `jan.christiansen@jcconsulting.no` → `ja***@jcconsulting.no`.
 *
 * Nok til at man kjenner igjen sin egen adresse, for lite til at noen kan
 * gjette seg til andres. Det er en bevisst oppmyking av regelen om at
 * endepunktene ikke røper hvem som står på listen: uten den kan en som er
 * låst ute ikke se om det er adressen eller noe annet som er feil, og da må
 * svaret hentes fra en logg som kan ligge timer etter.
 */
function masker(epost: string): string {
  const [lokal = "", domene = ""] = epost.split("@");
  return `${lokal.slice(0, 2)}***@${domene}`;
}

app.http("helse", {
  methods: ["GET"],
  route: "helse",
  authLevel: "anonymous",
  handler: async (): Promise<HttpResponseInit> => {
    const svar = {
      lager: false,
      tabellager: false,
      tilgangsliste: false,
      antallPersoner: 0,
      antallRedaktoerer: 0,
      adresser: [] as string[],
      epostOppsett: epostErSattOpp(),
      avsenderdomene: process.env.EPOST_AVSENDER?.split("@")[1] ?? null,
      sesjonsnokkel: (process.env.SESJON_HEMMELIGHET ?? "").trim().length >= 32,
      miljo: process.env.MILJO ?? "drift",
      // Hva som faktisk skjedde sist noen ba om en kode. Svarer i sanntid, i
      // motsetning til Application Insights.
      sisteKodebestilling: await sisteUtfall(),
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
        svar.adresser = lest.verdi.personer.map((p) => masker(p.epost));
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

    // Alltid 200, også når noe mangler. Et diagnoseendepunkt som svarer 5xx er
    // lett å miste bak en proxy eller et CDN som bytter ut kroppen med sin
    // egen tomme feilside – og da forsvinner nettopp svaret man kom for.
    // Verdien står i `ok` og i merknadene i stedet.
    return json({ ok: svar.merknader.length === 0, ...svar });
  },
});
