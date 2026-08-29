import { app, type HttpRequest, type HttpResponseInit } from "@azure/functions";
import { ulid } from "ulid";
import { z } from "zod";
import type { Aarsdokument, Opplastingsmaal, Opplastingssvar } from "../../../delt/typer.js";
import { CONTAINER, STI, lesJson, listAarstall, listBlober, slettBlob } from "../lager.js";
import { SKRIVE_MINUTTER, skriveUrl } from "../sas.js";
import { AAR_MAKS, AAR_MIN, feil, json } from "../svar.js";
import { krevRolle } from "../vakt.js";

/**
 * Filendelser vi utsteder skrive-SAS for. Listen er en tillatelsesliste, ikke en
 * blokkeringsliste: en SAS er en nøkkel til å skrive i lagringskontoen, og den
 * skal bare kunne peke på noe vi faktisk vil ha der.
 */
const ENDELSER: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const foresporselSkjema = z.object({
  aar: z.number().int().min(AAR_MIN).max(AAR_MAKS),
  filer: z
    .array(
      z.object({
        filnavn: z.string().min(1).max(300),
        type: z.string().min(1).max(100),
      })
    )
    .min(1)
    // Redigerings-GUI-et laster opp mange filer om gangen; taket er høyt nok
    // til at et helt album kan slippes inn på én gang.
    .max(60),
});

app.http("mediaOpplasting", {
  methods: ["POST"],
  route: "media/opplasting",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const nektet = krevRolle("redaktoer", req);
    if (nektet) return nektet;

    let raa: unknown;
    try {
      raa = await req.json();
    } catch {
      return feil(400, "Kroppen er ikke gyldig JSON.");
    }

    const validert = foresporselSkjema.safeParse(raa);
    if (!validert.success) {
      return feil(
        422,
        "Opplastingsforespørselen er ikke gyldig.",
        validert.error.issues.map((f) => `${f.path.join(".")}: ${f.message}`)
      );
    }

    const { aar, filer } = validert.data;
    const ukjente = filer.filter((f) => !ENDELSER[f.type.toLowerCase()]);
    if (ukjente.length > 0) {
      return feil(
        415,
        "Filtypen støttes ikke.",
        ukjente.map((f) => `${f.filnavn}: ${f.type}`)
      );
    }

    // Klientens filnavn brukes aldri i stien. ULID gir unikhet og kronologisk
    // sortering, og fjerner hele spørsmålet om hvordan æøå, mellomrom og
    // katalogseparatorer i et filnavn skal håndteres.
    const maal: Opplastingsmaal[] = await Promise.all(
      filer.map(async (f) => {
        const endelse = ENDELSER[f.type.toLowerCase()]!;
        const sti = `${aar}/${ulid()}.${endelse}`;
        return { fil: sti, opplastingsUrl: await skriveUrl(CONTAINER.media, sti) };
      })
    );

    const svar: Opplastingssvar = {
      maal,
      utloper: new Date(Date.now() + SKRIVE_MINUTTER * 60_000).toISOString(),
    };
    return json(svar);
  },
});

/**
 * Sletter mediefiler ingen årsdokumenter viser til.
 *
 * Bevisst en oppryddingsoperasjon og ikke sletting per fil: fjerner man et bilde
 * i redigeringen, forsvinner det fra årsdokumentet, men blobben blir liggende
 * til man rydder. Da er «fjern» angrbart så lenge man ikke har lagret, og en
 * sletting av et helt år tar ikke bildene med seg.
 */
app.http("mediaRydd", {
  methods: ["POST"],
  route: "vedlikehold/rydd-media",
  authLevel: "anonymous",
  handler: async (req: HttpRequest): Promise<HttpResponseInit> => {
    const nektet = krevRolle("redaktoer", req);
    if (nektet) return nektet;

    const aarstall = await listAarstall();
    const dokumenter = await Promise.all(
      aarstall.map((aar) => lesJson<Aarsdokument>(CONTAINER.innhold, STI.aar(aar)))
    );

    const brukt = new Set<string>();
    for (const d of dokumenter) {
      for (const m of d?.verdi.media ?? []) {
        for (const sti of [m.fil, m.miniatyr, m.plakat]) {
          if (sti) brukt.add(sti);
        }
      }
    }

    const alle = await listBlober(CONTAINER.media);
    const ubrukte = alle.filter((sti) => !brukt.has(sti));

    // Tørrkjøring med mindre klienten uttrykkelig ber om sletting.
    const url = new URL(req.url);
    if (url.searchParams.get("slett") !== "ja") {
      return json({ ubrukte, slettet: 0, torrkjoring: true });
    }

    await Promise.all(ubrukte.map((sti) => slettBlob(CONTAINER.media, sti)));
    return json({ ubrukte, slettet: ubrukte.length, torrkjoring: false });
  },
});
