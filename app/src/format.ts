/** Formatering som brukes flere steder. Norsk desimalkomma. */

export function formatterBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  if (bytes < 1024 * 1024 * 1024) return `${tall(bytes / 1024 / 1024, 1)} MB`;
  return `${tall(bytes / 1024 / 1024 / 1024, 1)} GB`;
}

/** `195` → `3:15`. Timer tas med når klippet er langt nok til å trenge det. */
export function formatterVarighet(sekunder: number): string {
  const hele = Math.round(sekunder);
  const t = Math.floor(hele / 3600);
  const m = Math.floor((hele % 3600) / 60);
  const s = hele % 60;
  return t > 0
    ? `${t}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function tall(verdi: number, desimaler = 0): string {
  return verdi.toLocaleString("nb-NO", {
    minimumFractionDigits: desimaler,
    maximumFractionDigits: desimaler,
  });
}

/**
 * `1:23` eller `83` → 83 sekunder. `undefined` når feltet er tomt eller tull.
 *
 * Godtar begge former med vilje: den som leser av et tidspunkt i en avspiller
 * skriver `1:23`, og den som kopierer et tall fra et annet verktøy skriver 83.
 */
export function lesTid(raa: string): number | undefined {
  const tekst = raa.trim();
  if (!tekst) return undefined;

  const deler = tekst.split(":");
  if (deler.length > 3 || deler.some((d) => !/^\d+$/.test(d))) return undefined;

  return deler.reduce((sum, d) => sum * 60 + Number(d), 0);
}
