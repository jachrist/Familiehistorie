/**
 * Utfallet av siste kodebestilling, lagret ett sted.
 *
 * `/api/auth/kode` svarer alltid 202, og skal gjøre det. Prisen er at den som
 * drifter nettstedet ikke ser hva som skjedde – og Application Insights på
 * gratisplanen kan ligge timer etter, noe som gjorde den ubrukelig til å svare
 * på et spørsmål man har akkurat nå.
 *
 * Derfor én rad: hva som skjedde sist, og når. Uten adresse og uten kode, så
 * den kan vises til hvem som helst uten å røpe hvem som står på listen.
 */
import { TABELL, erIkkeFunnet, tabell } from "./tabell.js";

const PARTISJON = "diagnose";
const RAD = "siste-kodebestilling";

export interface Utfall {
  tidspunkt: string;
  utfall: string;
}

interface Rad {
  partitionKey: string;
  rowKey: string;
  tidspunkt: string;
  utfall: string;
}

/**
 * E-postadresser fjernes før lagring. Feilmeldinger fra en e-posttjeneste
 * inneholder gjerne mottakeren, og den hører ikke hjemme i noe som vises uten
 * innlogging.
 */
function rens(tekst: string): string {
  return tekst.replace(/[^\s@]+@[^\s@]+\.[^\s@,"')]+/g, "‹adresse›").slice(0, 300);
}

export async function noterUtfall(utfall: string): Promise<void> {
  try {
    const klient = await tabell(TABELL.sperrer);
    await klient.upsertEntity<Rad>(
      {
        partitionKey: PARTISJON,
        rowKey: RAD,
        tidspunkt: new Date().toISOString(),
        utfall: rens(utfall),
      },
      "Replace"
    );
  } catch {
    // En diagnoselinje som feiler skal aldri velte innloggingen.
  }
}

export async function sisteUtfall(): Promise<Utfall | null> {
  try {
    const klient = await tabell(TABELL.sperrer);
    const rad = await klient.getEntity<Rad>(PARTISJON, RAD);
    return { tidspunkt: rad.tidspunkt, utfall: rad.utfall };
  } catch (e) {
    if (erIkkeFunnet(e)) return null;
    return null;
  }
}
