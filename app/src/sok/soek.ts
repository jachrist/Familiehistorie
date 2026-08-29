/**
 * Søk i nettleseren.
 *
 * Forsiden har allerede lastet indeksdokumentet, som inneholder all søkbar
 * tekst. Søket kjøres derfor lokalt: ingen søketjeneste å betale for, ingen
 * ventetid per tastetrykk. Ved rundt 90 år er indeksen et par hundre kilobyte.
 */
import MiniSearch, { type SearchResult } from "minisearch";
import type { Indeksrad } from "../../../delt/typer.js";

/**
 * «Sørlandet» skal finnes både som «sørlandet» og «sorlandet».
 *
 * Æ, ø og å beholdes i den indekserte formen — de skal ikke erstattes. Men i
 * tillegg indekseres en foldet variant, slik at begge skrivemåter treffer. Det
 * koster noen kilobyte og sparer den som skriver fort, eller sitter ved et
 * tastatur uten norske tegn.
 */
export function fold(term: string): string {
  return term
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o");
}

function behandleTerm(term: string): string | string[] {
  const smaa = term.toLowerCase();
  const foldet = fold(smaa);
  return foldet === smaa ? smaa : [smaa, foldet];
}

export function byggSokeindeks(rader: Indeksrad[]): MiniSearch<Indeksrad> {
  const indeks = new MiniSearch<Indeksrad>({
    idField: "aar",
    fields: ["tittel", "sammendrag", "sok"],
    storeFields: ["aar"],
    processTerm: behandleTerm,
  });
  indeks.addAll(rader);
  return indeks;
}

export interface Treff {
  aar: number;
  /** Ordene som faktisk traff, til utheving. */
  ord: string[];
}

export function sok(indeks: MiniSearch<Indeksrad>, spoersmaal: string): Treff[] {
  const rensket = spoersmaal.trim();
  if (rensket === "") return [];

  const resultat = indeks.search(rensket, {
    prefix: true,
    // Toleranse for skrivefeil betyr mer enn man tror når man søker på
    // slektsnavn og stedsnavn man bare har hørt.
    //
    // Men ikke på tall: med toleranse ga «1972» også 1974, 1976 og 1952, siden
    // de er én endring unna. Skriver man et årstall, mener man det årstallet.
    // Prefiks beholdes, så «197» fortsatt finner hele tiåret.
    fuzzy: (term) => (/^\d+$/.test(term) ? false : 0.2),
    boost: { tittel: 4, sammendrag: 2 },
  }) as (SearchResult & { aar: number })[];

  return resultat.map((r) => ({ aar: r.aar, ord: r.terms }));
}

export interface Bit {
  tekst: string;
  traff: boolean;
}

/** Deler en tekst i biter, der de som traff er markert. */
export function marker(tekst: string, ord: string[]): Bit[] {
  if (ord.length === 0 || tekst === "") return [{ tekst, traff: false }];

  const foldet = fold(tekst.toLowerCase());
  // Folding kan endre lengden (æ → ae), og da stemmer ikke posisjonene med den
  // opprinnelige teksten. Da uthever vi heller ikke, framfor å utheve feil sted.
  if (foldet.length !== tekst.length) return [{ tekst, traff: false }];

  const posisjoner: [number, number][] = [];
  for (const o of ord) {
    const naal = fold(o.toLowerCase());
    if (naal === "") continue;
    let fra = 0;
    let at: number;
    while ((at = foldet.indexOf(naal, fra)) !== -1) {
      // Bare ved ordstart. Ellers uthever «år» midt inne i «måltider».
      const foer = at === 0 ? "" : foldet[at - 1]!;
      if (at === 0 || !/[\p{L}\p{N}]/u.test(foer)) posisjoner.push([at, at + naal.length]);
      fra = at + naal.length;
    }
  }
  if (posisjoner.length === 0) return [{ tekst, traff: false }];

  posisjoner.sort((a, b) => a[0] - b[0]);
  const biter: Bit[] = [];
  let pos = 0;
  for (const [start, slutt] of posisjoner) {
    if (start < pos) continue;
    if (start > pos) biter.push({ tekst: tekst.slice(pos, start), traff: false });
    biter.push({ tekst: tekst.slice(start, slutt), traff: true });
    pos = slutt;
  }
  if (pos < tekst.length) biter.push({ tekst: tekst.slice(pos), traff: false });
  return biter;
}

const UTDRAG = 150;

/**
 * Et utdrag rundt første treff, så man ser *hvorfor* året kom med. Uten det er
 * et søketreff bare et årstall.
 */
export function utdrag(tekst: string, ord: string[]): Bit[] | undefined {
  const foldet = fold(tekst.toLowerCase());
  let foerste = -1;
  for (const o of ord) {
    const at = foldet.indexOf(fold(o.toLowerCase()));
    if (at !== -1 && (foerste === -1 || at < foerste)) foerste = at;
  }
  if (foerste === -1) return undefined;

  let start = Math.max(0, foerste - 55);
  let slutt = Math.min(tekst.length, start + UTDRAG);
  // Klipp ved ordgrenser, ikke midt i et ord.
  if (start > 0) {
    const mellomrom = tekst.indexOf(" ", start);
    if (mellomrom !== -1 && mellomrom < foerste) start = mellomrom + 1;
  }
  if (slutt < tekst.length) {
    const mellomrom = tekst.lastIndexOf(" ", slutt);
    if (mellomrom > foerste) slutt = mellomrom;
  }

  const biter = marker(tekst.slice(start, slutt), ord);
  if (start > 0) biter.unshift({ tekst: "… ", traff: false });
  if (slutt < tekst.length) biter.push({ tekst: " …", traff: false });
  return biter;
}
