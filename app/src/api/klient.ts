/**
 * Typet klient mot /api.
 *
 * Ingen sesjonshåndtering her: fra trinn 9 ligger sesjonen i en
 * httpOnly-kapsel som nettleseren sender selv. `credentials: "same-origin"` er
 * standard, men skrives ut for å gjøre det tydelig at det er meningen.
 */
import type { AarsdokumentMedUrl, Feltskjema, Indeks } from "../../../delt/typer.js";

export class Apifeil extends Error {
  constructor(
    readonly status: number,
    melding: string,
    readonly detaljer?: unknown
  ) {
    super(melding);
    this.name = "Apifeil";
  }
}

async function hent<T>(sti: string, init?: RequestInit): Promise<T> {
  let svar: Response;
  try {
    svar = await fetch(sti, { credentials: "same-origin", ...init });
  } catch {
    throw new Apifeil(0, "Fikk ikke kontakt med serveren. Er du på nett?");
  }

  if (!svar.ok) {
    let melding = `Noe gikk galt (${svar.status}).`;
    let detaljer: unknown;
    try {
      const kropp = (await svar.json()) as { feil?: string; detaljer?: unknown };
      if (kropp.feil) melding = kropp.feil;
      detaljer = kropp.detaljer;
    } catch {
      // Serveren svarte ikke JSON. Standardmeldingen over er da det beste vi har.
    }
    throw new Apifeil(svar.status, melding, detaljer);
  }

  return (await svar.json()) as T;
}

export const api = {
  indeks: () => hent<Indeks>("/api/indeks"),
  felter: () => hent<Feltskjema>("/api/felter"),
  aar: (aar: number) => hent<AarsdokumentMedUrl>(`/api/aar/${aar}`),
};
