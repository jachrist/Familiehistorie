/**
 * Indeksdokumentet.
 *
 * indeks.json er avledet data: alt i det kan gjenskapes fra årsdokumentene. Det
 * er grunnen til at forsiden klarer seg med ett nettverkskall uansett hvor mange
 * år som legges til, og grunnen til at det er trygt å bygge om når som helst.
 */
import type { Aarsdokument, Feltskjema, Indeks, Indeksrad } from "../../delt/typer.js";
import { CONTAINER, STI, lesJson, listAarstall, skrivJson } from "./lager.js";

/** Fjerner markup og slår sammen mellomrom. Æ, ø og å beholdes som de er. */
function flat(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function lagRad(dok: Aarsdokument, skjema: Feltskjema): Indeksrad {
  const tekster = skjema.felter
    .map((def) => flat(dok.felter[def.id] ?? ""))
    .filter((t) => t !== "");

  const bildetekster = dok.media.map((m) => m.bildetekst ?? "").filter((t) => t !== "");

  return {
    aar: dok.aar,
    tittel: flat(dok.felter.tittel ?? "").slice(0, 200),
    sammendrag: flat(dok.felter.sammendrag ?? "").slice(0, 400),
    antallBilder: dok.media.filter((m) => m.type === "bilde").length,
    antallVideoer: dok.media.filter((m) => m.type === "video").length,
    // Søket i trinn 8 leser dette feltet. Bildetekster tas med – de er ofte det
    // eneste stedet et navn eller sted er nevnt.
    sok: [String(dok.aar), ...tekster, ...bildetekster].join(" ").toLowerCase(),
  };
}

/** Leser alle årsdokumenter og skriver indeks.json på nytt. */
export async function byggIndeks(): Promise<Indeks> {
  const skjema = await lesJson<Feltskjema>(CONTAINER.innhold, STI.felter);
  if (!skjema) {
    throw new Error(
      "innhold/felter.json mangler. Kjør `npm run seed` (lokalt) eller `npm run seed:sky`."
    );
  }

  const aarstall = await listAarstall();
  const dokumenter = await Promise.all(
    aarstall.map((aar) => lesJson<Aarsdokument>(CONTAINER.innhold, STI.aar(aar)))
  );

  const rader = dokumenter
    .filter((d): d is NonNullable<typeof d> => d !== undefined)
    .map((d) => lagRad(d.verdi, skjema.verdi))
    // Nyeste først – det er rekkefølgen forsiden viser dem i.
    .sort((a, b) => b.aar - a.aar);

  const indeks: Indeks = { generert: new Date().toISOString(), aar: rader };
  await skrivJson(CONTAINER.innhold, STI.indeks, indeks);
  return indeks;
}
