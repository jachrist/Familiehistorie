/**
 * Utsending av engangskoder.
 *
 * Bruker Azure Communication Services når det er satt opp. Er det ikke det –
 * altså lokalt – skrives koden i konsollen i stedet, så innloggingen kan prøves
 * uten e-postoppsett. Koden logges *bare* i det tilfellet; i drift ville en kode
 * i loggen vært en lekkasje.
 *
 * Avsenderdomenet bør være verifisert. Den Azure-genererte avsenderadressen
 * havner ofte i søppelpost, og en engangskode som ikke kommer fram er en
 * innlogging som ikke virker.
 */
import { EmailClient } from "@azure/communication-email";
import { KODE_LEVETID_MINUTTER } from "./kode.js";

function les(navn: string): string | undefined {
  const v = process.env[navn];
  return v && v.trim() !== "" ? v : undefined;
}

let klient: EmailClient | undefined;

function epostklient(): EmailClient | undefined {
  const tilkobling = les("ACS_TILKOBLING");
  if (!tilkobling) return undefined;
  klient ??= new EmailClient(tilkobling);
  return klient;
}

export function epostErSattOpp(): boolean {
  return Boolean(les("ACS_TILKOBLING") && les("EPOST_AVSENDER"));
}

export async function sendKode(epost: string, navn: string, kode: string): Promise<void> {
  const avsender = les("EPOST_AVSENDER");
  const tjeneste = epostklient();

  if (!tjeneste || !avsender) {
    console.log(
      `\n  [lokal innlogging] engangskode for ${epost}: ${kode}` +
        `\n  (ACS_TILKOBLING/EPOST_AVSENDER er ikke satt – koden sendes ikke på e-post)\n`
    );
    return;
  }

  const fornavn = navn.split(" ")[0] || "hei";
  const tekst =
    `Hei ${fornavn},\n\n` +
    `Engangskoden din til Familiehistorie er:\n\n    ${kode}\n\n` +
    `Den er gyldig i ${KODE_LEVETID_MINUTTER} minutter.\n\n` +
    `Har du ikke bedt om å logge inn, kan du se bort fra denne meldingen.\n`;

  const html =
    `<p>Hei ${flukt(fornavn)},</p>` +
    `<p>Engangskoden din til Familiehistorie er:</p>` +
    `<p style="font-size:28px;letter-spacing:6px;font-weight:700">${kode}</p>` +
    `<p>Den er gyldig i ${KODE_LEVETID_MINUTTER} minutter.</p>` +
    `<p>Har du ikke bedt om å logge inn, kan du se bort fra denne meldingen.</p>`;

  const operasjon = await tjeneste.beginSend({
    senderAddress: avsender,
    content: { subject: "Engangskode til Familiehistorie", plainText: tekst, html },
    recipients: { to: [{ address: epost, displayName: navn }] },
  });
  await operasjon.pollUntilDone();
}

function flukt(tekst: string): string {
  return tekst.replace(/[&<>"]/g, (t) =>
    t === "&" ? "&amp;" : t === "<" ? "&lt;" : t === ">" ? "&gt;" : "&quot;"
  );
}
