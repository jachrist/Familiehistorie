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
