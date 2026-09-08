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
import { ID_MONSTER, sjekkUrl } from "./opptak.js";

/** Bevisst liten liste. Redigering skal ikke kunne produsere vilkårlig markup. */
const TILLATT: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "em", "u", "a", "ul", "ol", "li", "blockquote", "h3", "h4"],
  // `target` og `rel` står her fordi transformen under setter dem: filtreringen
  // kjører etterpå, og attributter som ikke er tillatt blir fjernet igjen. Uten
  // dem gjorde transformen ingenting, og lenker åpnet seg i samme fane.
  allowedAttributes: { a: ["href", "title", "target", "rel"] },
  allowedSchemes: ["http", "https", "mailto"],
  // En lenke ut av nettstedet skal åpne seg ved siden av årssiden, ikke i
  // stedet for den – og `noopener` hindrer at siden den åpner får en peker
  // tilbake til vår.
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

/**
 * Tilgangslisten. Navnet saniteres som kort tekst – det vises i GUI-et, og en
 * liste over familiemedlemmer skal ikke kunne bli en vei inn for markup.
 *
 * Minst én redaktør må stå igjen. Uten den regelen kan en redaktør fjerne sin
 * egen rolle og låse alle ute av redigeringen, uten noen vei tilbake i appen.
 */
export const tilgangslisteSkjema = z
  .object({
    personer: z
      .array(
        z.object({
          epost: z.string().trim().toLowerCase().min(3).max(254).email(),
          navn: z.string().trim().min(1).max(120).transform(saniterKortTekst),
          roller: z.array(z.enum(["familie", "redaktoer"])).min(1).max(2),
        })
      )
      .min(1)
      .max(200),
  })
  .refine((l) => l.personer.some((p) => p.roller.includes("redaktoer")), {
    message: "Minst én person må ha rollen «redaktoer».",
  })
  .refine(
    (l) => new Set(l.personer.map((p) => p.epost)).size === l.personer.length,
    { message: "Samme e-postadresse står oppført flere ganger." }
  );

/**
 * Opptaksregisteret.
 *
 * Id-en havner i en URL og i årstekster, så den holdes bevisst kjedelig: små
 * bokstaver, tall og bindestrek. Da tåler den å bli skrevet av for hånd, limt
 * inn i en e-post og lest opp i telefonen.
 */
export const opptakSkjema = z.object({
  opptak: z
    .array(
      z.object({
        id: z
          .string()
          .trim()
          .toLowerCase()
          .regex(ID_MONSTER, "Id-en kan bare inneholde små bokstaver, tall og bindestrek."),
        tittel: z.string().trim().min(1, "Opptaket må ha en tittel.").max(200),
        url: z
          .string()
          .trim()
          .max(2000)
          .superRefine((verdi, ctx) => {
            const svar = sjekkUrl(verdi);
            if (!svar.ok) ctx.addIssue({ code: "custom", message: svar.grunn });
          }),
        // Et døgn er rikelig, og hindrer at en tastefeil sender avspilleren til
        // et tidspunkt som ikke finnes.
        start: z.number().int().min(0).max(86_400).nullish(),
        notat: z.string().trim().max(500).optional(),
      })
    )
    .max(500)
    .superRefine((opptak, ctx) => {
      const sett = new Set<string>();
      for (const o of opptak) {
        if (sett.has(o.id)) {
          ctx.addIssue({ code: "custom", message: `Id-en «${o.id}» er brukt mer enn én gang.` });
        }
        sett.add(o.id);
      }
    }),
});
