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
import { TABELL, erIkkeFunnet, iTabell } from "./tabell.js";

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
    await iTabell(TABELL.sperrer, (klient) =>
      klient.upsertEntity<Rad>(
        {
          partitionKey: PARTISJON,
          rowKey: RAD,
          tidspunkt: new Date().toISOString(),
          utfall: rens(utfall),
        },
        "Replace"
      )
    );
  } catch {
    // En diagnoselinje som feiler skal aldri velte innloggingen.
  }
}

export async function sisteUtfall(): Promise<Utfall | null> {
  try {
    const rad = await iTabell(TABELL.sperrer, (klient) =>
      klient.getEntity<Rad>(PARTISJON, RAD)
    );
    return { tidspunkt: rad.tidspunkt, utfall: rad.utfall };
  } catch (e) {
    if (erIkkeFunnet(e)) return null;
    return null;
  }
}

/**
 * Virker Table Storage i det hele tatt?
 *
 * Kodebestillingen treffer tabellen to ganger – rate-limiteren og lagring av
 * koden – **før** e-posten forsøkes. Feiler den, kommer man aldri til
 * utsendingen, og både Resends logg og postkassen står tomme uten at noe
 * peker på hvorfor.
 *
 * `lager: true` i /api/helse sier bare at *Blob* svarer. Dette er den andre
 * halvparten. Returnerer `null` når alt er i orden, ellers grunnen.
 */
export async function sjekkTabellager(): Promise<string | null> {
  try {
    await iTabell(TABELL.sperrer, (klient) =>
      klient.getEntity<Rad>(PARTISJON, "finnes-neppe").catch((e: unknown) => {
        // «Fant ikke raden» er et vellykket svar her: tabellen er tilgjengelig.
        if (!erIkkeFunnet(e)) throw e;
      })
    );
    return null;
  } catch (e) {
    return e instanceof Error ? e.message.slice(0, 200) : "ukjent feil";
  }
}
