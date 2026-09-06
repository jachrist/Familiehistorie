/**
 * Utsending av engangskoder via Resend.
 *
 * Ett HTTP-kall med en API-nøkkel. Ingen SDK, ingen ekstra avhengighet, ingen
 * ressurser å opprette i Azure. Det erstatter Azure Communication Services,
 * der to ressurser, et domene og et koblingssteg måtte stemme før noe kunne
 * sendes – og der en melding som ikke kom fram ikke sa hvorfor.
 *
 * Lokalt, uten nøkkel, skrives koden i konsollen i stedet. I drift kastes en
 * feil hvis oppsettet mangler: å logge koden der ville lagt gyldig legitimasjon
 * i Application Insights, og en stille «ingen e-post ble sendt» er vanskeligere
 * å oppdage enn en feil.
 */
import { KODE_LEVETID_MINUTTER } from "./kode.js";

/** Overstyres bare av prøver som vil fange kallet. Ellers Resends endepunkt. */
const RESEND_URL = process.env.RESEND_URL || "https://api.resend.com/emails";

function les(navn: string): string | undefined {
  const v = process.env[navn];
  return v && v.trim() !== "" ? v : undefined;
}

function erLokalt(): boolean {
  return (process.env.MILJO ?? "drift").toLowerCase() === "lokalt";
}

export function epostErSattOpp(): boolean {
  return Boolean(les("RESEND_NOKKEL") && les("EPOST_AVSENDER"));
}

export async function sendKode(epost: string, navn: string, kode: string): Promise<void> {
  const nokkel = les("RESEND_NOKKEL");
  const avsender = les("EPOST_AVSENDER");

  if (!nokkel || !avsender) {
    if (!erLokalt()) {
      throw new Error(
        "RESEND_NOKKEL og EPOST_AVSENDER er ikke satt. Ingen engangskoder kan sendes."
      );
    }
    console.log(
      `\n  [lokal innlogging] engangskode for ${epost}: ${kode}` +
        `\n  (RESEND_NOKKEL/EPOST_AVSENDER er ikke satt – koden sendes ikke på e-post)\n`
    );
    return;
  }

  const fornavn = navn.split(" ")[0] || "hei";

  const svar = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${nokkel}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: avsender,
      to: [epost],
      subject: `Engangskode til Familiehistorie: ${kode}`,
      text: tekstversjon(fornavn, kode),
      html: htmlversjon(fornavn, kode),
    }),
  });

  if (!svar.ok) {
    // Resend svarer med JSON når noe er galt. Meldingen derfra er den eneste
    // som sier hva som faktisk skjedde, så den tas med videre – uten koden.
    const detalj = await svar.text().catch(() => "");
    throw new Error(
      `Resend avviste utsendingen (HTTP ${svar.status}): ${detalj.slice(0, 400)}`
    );
  }
}

/**
 * Koden står også i emnefeltet. Det er ikke slurv: på telefon er den da
 * synlig i varselet, og de fleste slipper å åpne meldingen i det hele tatt.
 */
function tekstversjon(fornavn: string, kode: string): string {
  return (
    `Hei ${fornavn},\n\n` +
    `Engangskoden din til Familiehistorie er:\n\n    ${kode}\n\n` +
    `Den er gyldig i ${KODE_LEVETID_MINUTTER} minutter.\n\n` +
    `Har du ikke bedt om å logge inn, kan du se bort fra denne meldingen.\n`
  );
}

function htmlversjon(fornavn: string, kode: string): string {
  return (
    `<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.6;color:#101b2d">` +
    `<p>Hei ${flukt(fornavn)},</p>` +
    `<p>Engangskoden din til Familiehistorie er:</p>` +
    `<p style="font-size:30px;letter-spacing:8px;font-weight:700;margin:24px 0">${kode}</p>` +
    `<p>Den er gyldig i ${KODE_LEVETID_MINUTTER} minutter.</p>` +
    `<p style="color:#56657d;font-size:14px">Har du ikke bedt om å logge inn, kan du se bort fra denne meldingen.</p>` +
    `</div>`
  );
}

function flukt(tekst: string): string {
  return tekst.replace(/[&<>"]/g, (t) =>
    t === "&" ? "&amp;" : t === "<" ? "&lt;" : t === ">" ? "&gt;" : "&quot;"
  );
}
