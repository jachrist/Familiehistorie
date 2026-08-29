/**
 * Opptaksdato fra EXIF.
 *
 * Med rundt 2 250 bilder som skal inn manuelt, sparer dette to felter per
 * bilde: datoen, og forslaget om hvilket år bildet hører hjemme i.
 */
import exifr from "exifr";

export interface Exifdata {
  /** ISO-dato, «1972-08-14». */
  tatt?: string;
  aar?: number;
}

export async function lesExif(fil: File): Promise<Exifdata> {
  try {
    const data = await exifr.parse(fil, {
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
    });
    const dato: unknown = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.ModifyDate;
    if (!(dato instanceof Date) || Number.isNaN(dato.getTime())) return {};

    const aar = dato.getFullYear();
    // Kameraer uten batteri i klokka datostempler gjerne 1970 eller 1980.
    if (aar < 1826 || aar > new Date().getFullYear() + 1) return {};

    return { tatt: dato.toISOString().slice(0, 10), aar };
  } catch {
    // Skannede bilder og de fleste videoer har ingen EXIF. Helt normalt.
    return {};
  }
}

/** Årstallet som går igjen i en bunke filer, hvis det er et tydelig flertall. */
export function vanligsteAar(aarstall: (number | undefined)[]): number | undefined {
  const antall = new Map<number, number>();
  for (const a of aarstall) {
    if (a !== undefined) antall.set(a, (antall.get(a) ?? 0) + 1);
  }
  if (antall.size === 0) return undefined;
  const [beste] = [...antall.entries()].sort((a, b) => b[1] - a[1]);
  return beste?.[0];
}
