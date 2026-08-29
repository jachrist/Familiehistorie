/**
 * Validering og sanitering av årsdokumenter.
 *
 * Skjemaet bygges fra felter.json, ikke fra kode – det er hele poenget med at
 * feltene er data. Legges et felt til i felter.json, valideres det uten at noe
 * her endres.
 *
 * Saniteringen skjer på serveren. Årssidene lagrer HTML som vises for andre
 * familiemedlemmer, og det er den ene realistiske XSS-veien inn i dette
 * nettstedet. Sanitering bare i nettleseren ville ikke vært en
 * sikkerhetskontroll.
 */
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import type { Feltskjema, Medieobjekt } from "../../delt/typer.js";

/** Bevisst liten liste. Redigering skal ikke kunne produsere vilkårlig markup. */
const TILLATT: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "blockquote", "h3", "h4"],
  allowedAttributes: { a: ["href", "title"] },
  allowedSchemes: ["http", "https", "mailto"],
  // Uten dette blir en lenke til et annet nettsted en liten
  // window.opener-svakhet.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
  },
};

export function saniterRikTekst(raa: string): string {
  return sanitizeHtml(raa, TILLATT).trim();
}

/** All markup fjernes; entiteter dekodes ikke tilbake til tegn som kan tolkes. */
export function saniterKortTekst(raa: string): string {
  return sanitizeHtml(raa, { allowedTags: [], allowedAttributes: {} }).trim();
}

export const medieSkjema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(["bilde", "video"]),
  fil: z.string().min(1).max(512),
  miniatyr: z.string().max(512).nullish(),
  plakat: z.string().max(512).nullish(),
  bildetekst: z.string().max(2000).optional(),
  tatt: z.string().max(32).nullish(),
  bredde: z.number().int().positive().nullish(),
  hoyde: z.number().int().positive().nullish(),
  varighet: z.number().nonnegative().nullish(),
  rekkefolge: z.number().int(),
});

export interface ValidertAar {
  felter: Record<string, string>;
  media: Medieobjekt[];
  status: "utkast" | "publisert";
}

export type Valideringsresultat =
  | { ok: true; verdi: ValidertAar }
  | { ok: false; problemer: string[] };

/**
 * Validerer og saniterer i én operasjon. Ukjente feltnøkler forkastes stille –
 * de er som regel rester fra en eldre skjemaversjon, og å avvise hele lagringen
 * for dem ville gjort feltendringer unødig smertefulle.
 */
export function validerAar(skjema: Feltskjema, raa: unknown): Valideringsresultat {
  const ytre = z
    .object({
      felter: z.record(z.string(), z.string()),
      media: z.array(medieSkjema).max(500),
      status: z.enum(["utkast", "publisert"]).optional(),
    })
    .safeParse(raa);

  if (!ytre.success) {
    return {
      ok: false,
      problemer: ytre.error.issues.map((f) => `${f.path.join(".") || "kropp"}: ${f.message}`),
    };
  }

  const problemer: string[] = [];
  const felter: Record<string, string> = {};

  for (const def of skjema.felter) {
    const raaVerdi = ytre.data.felter[def.id] ?? "";
    const rensket =
      def.type === "rik_tekst" ? saniterRikTekst(raaVerdi) : saniterKortTekst(raaVerdi);

    if (def.paakrevd && rensket === "") {
      problemer.push(`${def.etikett} må fylles ut.`);
    }
    if (def.type === "kort_tekst" && rensket.length > 300) {
      problemer.push(`${def.etikett} kan være maks 300 tegn.`);
    }
    if (rensket !== "") felter[def.id] = rensket;
  }

  if (problemer.length > 0) return { ok: false, problemer };

  return {
    ok: true,
    verdi: {
      felter,
      media: ytre.data.media as Medieobjekt[],
      status: ytre.data.status ?? "publisert",
    },
  };
}

export const feltskjemaSkjema = z.object({
  versjon: z.number().int().positive(),
  felter: z
    .array(
      z.object({
        id: z
          .string()
          .min(1)
          .max(40)
          // Feltnøkler blir til JSON-nøkler og til navn i skjemaet, så de
          // holdes bevisst enkle.
          .regex(/^[a-zA-Z][a-zA-Z0-9]*$/, "må starte med bokstav og bare inneholde bokstaver og tall"),
        etikett: z.string().min(1).max(120),
        type: z.enum(["kort_tekst", "rik_tekst"]),
        paakrevd: z.boolean().optional(),
        hjelp: z.string().max(300).optional(),
      })
    )
    .min(1)
    .max(50),
});
