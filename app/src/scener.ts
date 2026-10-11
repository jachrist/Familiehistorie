/**
 * Scenelister: fra notatene man skriver mens man ser filmen, til lenker i en
 * årstekst.
 *
 * Listene blir til mens man spoler gjennom timevis av opptak og skriver tid og
 * beskrivelse for hånd. Da blir tidspunktene rotete, og det skal de få lov til
 * å være — en parser som krever `12:30` er ubrukelig for den som sitter med
 * fjernkontrollen i den ene hånden.
 *
 * Disse er alle fra en ekte liste, og betyr det samme som linja under:
 *
 *     0.12.44      →  12:44
 *     0 0 1 45     →  1:45     (minuttfeltet «01» ble delt i to)
 *     0 6 0 0.     →  6:00     (sekundfeltet «00» ble delt i to)
 *     0.0.8.45     →  8:45     (minuttfeltet «08» ble delt i to)
 *     1.00.50      →  1:00:50
 *
 * Regelen som dekker alle: samle sifrene i tidsangivelsen, og les dem fra
 * høyre — to sekunder, to minutter, resten timer.
 */
import { formatterVarighet } from "./format.js";

export interface Scene {
  /** Sekunder inn i opptaket. */
  start: number;
  tittel: string;
  /** Året scenen hører til, når listen dekker flere. */
  aar?: number | null;
}

export interface Avvist {
  /** Linjenummer i det som ble limt inn, fra 1. */
  linje: number;
  tekst: string;
  grunn: string;
}

export interface Tolkning {
  scener: Scene[];
  avviste: Avvist[];
  /** Fra en «Video: …»-linje, hvis den finnes. */
  tittel?: string;
  /** Scener som kommer før den forrige i tid. Som regel en feillesing. */
  uordnede: number[];
}

const VIDEOLINJE = /^video\s*:\s*(.+)$/i;
const AARSLINJE = /^(19|20)\d{2}$/;

/**
 * Deler en linje i tidsangivelse og beskrivelse.
 *
 * Grensen er vanskelig fordi beskrivelsen kan begynne med et tall:
 * «0.22.33 1. juledagslunsj i Havnabakken». Her er `1.` et ordenstall, ikke en
 * del av tiden.
 *
 * Skillet: en fjerde tallgruppe regnes bare med når de tre første er enkle
 * sifre. Det er signaturen til et tosifret felt som har blitt delt – `0 0 1 45`
 * – mens `0.22.33` etterfulgt av `1` har tosifrede grupper og er altså ferdig.
 */
function delLinje(linje: string): { sifre: string; tekst: string } | undefined {
  const grupper: string[] = [];
  let i = 0;

  while (i < linje.length && grupper.length < 4) {
    const rest = linje.slice(i);
    const treff = /^(\d{1,2})([\s.:,]+|$)/.exec(rest);
    if (!treff) break;

    const gruppe = treff[1]!;
    if (grupper.length === 3) {
      const treEnkle = grupper.every((g) => g.length === 1);
      if (!treEnkle) break;
    }

    grupper.push(gruppe);
    i += treff[0].length;
  }

  if (grupper.length === 0) return undefined;

  // Et etterslepende punktum hører til tiden, ikke til beskrivelsen: «0 6 0 0.»
  const tekst = linje.slice(i).replace(/^[.\s]+/, "").trim();
  return { sifre: grupper.join(""), tekst };
}

/** `"01244"` → 764 sekunder. `undefined` når tallene ikke gir en gyldig tid. */
export function sifreTilSekunder(sifre: string): number | undefined {
  if (!/^\d{1,6}$/.test(sifre)) return undefined;

  const padded = sifre.padStart(6, "0");
  const timer = Number(padded.slice(0, 2));
  const minutter = Number(padded.slice(2, 4));
  const sekunder = Number(padded.slice(4, 6));

  if (minutter > 59 || sekunder > 59) return undefined;
  return timer * 3600 + minutter * 60 + sekunder;
}

export function tolkSceneliste(raa: string): Tolkning {
  const scener: Scene[] = [];
  const avviste: Avvist[] = [];
  const uordnede: number[] = [];
  let tittel: string | undefined;
  let aar: number | null = null;
  let forrige = -1;

  raa.split(/\r?\n/).forEach((raaLinje, nr) => {
    const linje = raaLinje.trim();
    if (!linje) return;

    const video = VIDEOLINJE.exec(linje);
    if (video) {
      tittel = video[1]!.trim();
      return;
    }

    if (AARSLINJE.test(linje)) {
      aar = Number(linje);
      return;
    }

    const delt = delLinje(linje);
    if (!delt) {
      avviste.push({ linje: nr + 1, tekst: linje, grunn: "Fant ingen tid i starten av linja." });
      return;
    }

    const start = sifreTilSekunder(delt.sifre);
    if (start === undefined) {
      avviste.push({ linje: nr + 1, tekst: linje, grunn: "Tiden lot seg ikke tolke." });
      return;
    }
    if (!delt.tekst) {
      avviste.push({ linje: nr + 1, tekst: linje, grunn: "Linja har tid, men ingen beskrivelse." });
      return;
    }

    if (start < forrige) uordnede.push(scener.length);
    forrige = start;

    scener.push({ start, tittel: delt.tekst, aar });
  });

  return { scener, avviste, tittel, uordnede };
}

/**
 * Scenene som hører til et år.
 *
 * Scener uten årstall hører til alle: en liste uten årsoverskrifter dekker ett
 * opptak fra ett år, og da er det året man redigerer som gjelder.
 */
export function scenerFor(scener: Scene[] | undefined, aar: number): Scene[] {
  return (scener ?? []).filter((s) => s.aar == null || s.aar === aar);
}

/**
 * Scenelisten som HTML, klar til å settes inn i et rik tekst-felt.
 *
 * Bare `<p>`, `<strong>`, `<ul>`, `<li>` og `<a>` – alle på serverens liste
 * over tillatte merker, så den overlever lagring uendret.
 *
 * Lenkene peker på tiden, ikke på et scenenummer. Omrokkerer du listen senere,
 * fortsetter lenkene som alt står i en årstekst å peke riktig.
 */
export function sceneListeSomHtml(opptaksId: string, overskrift: string, scener: Scene[]): string {
  if (scener.length === 0) return "";

  const punkter = scener
    .map(
      (s) =>
        `<li><a href="/api/opptak/${encodeURIComponent(opptaksId)}/${s.start}">` +
        `${formatterVarighet(s.start)}</a> ${flukt(s.tittel)}</li>`
    )
    .join("");

  const tittel = overskrift.trim();
  return (tittel ? `<p><strong>${flukt(tittel)}</strong></p>` : "") + `<ul>${punkter}</ul>`;
}

function flukt(tekst: string): string {
  return tekst.replace(/[&<>]/g, (t) => (t === "&" ? "&amp;" : t === "<" ? "&lt;" : "&gt;"));
}
