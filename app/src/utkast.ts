/**
 * Autolagring av utkast til localStorage.
 *
 * Den vanligste måten å miste arbeid på er at fanen lukkes, nettet faller ut,
 * eller at man navigerer bort ved et uhell. Dette er billig forsikring mot alle
 * tre.
 *
 * Merk at dette er urelatert til sesjonen, som fra trinn 9 ligger i en
 * httpOnly-kapsel og aldri i localStorage.
 */
import type { AarsdokumentInn } from "../../delt/typer.js";

const PREFIKS = "familiehistorie:utkast:";

export interface Utkast extends AarsdokumentInn {
  lagret: string;
  /** ETag-en utkastet ble skrevet mot, så vi kan oppdage at året er endret. */
  etag?: string;
}

export function lagreUtkast(aar: number, utkast: Omit<Utkast, "lagret">): void {
  try {
    localStorage.setItem(
      PREFIKS + aar,
      JSON.stringify({ ...utkast, lagret: new Date().toISOString() })
    );
  } catch {
    // Full eller avslått lagring skal ikke stoppe redigeringen.
  }
}

export function lesUtkast(aar: number): Utkast | undefined {
  try {
    const raa = localStorage.getItem(PREFIKS + aar);
    return raa ? (JSON.parse(raa) as Utkast) : undefined;
  } catch {
    return undefined;
  }
}

export function glemUtkast(aar: number): void {
  try {
    localStorage.removeItem(PREFIKS + aar);
  } catch {
    // Ingenting å gjøre.
  }
}
