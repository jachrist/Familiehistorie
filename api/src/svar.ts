/** Felles svarformat. Alle feilmeldinger er norske og ment å kunne vises. */
import type { HttpResponseInit } from "@azure/functions";

export function json(kropp: unknown, ekstra: Partial<HttpResponseInit> = {}): HttpResponseInit {
  return {
    status: 200,
    jsonBody: kropp,
    ...ekstra,
    headers: { "Cache-Control": "no-store", ...(ekstra.headers ?? {}) },
  };
}

export function feil(status: number, melding: string, detaljer?: unknown): HttpResponseInit {
  return {
    status,
    jsonBody: detaljer === undefined ? { feil: melding } : { feil: melding, detaljer },
    headers: { "Cache-Control": "no-store" },
  };
}

/** Årstall vi godtar. Rommer fire generasjoner bakover med god margin. */
export const AAR_MIN = 1500;
export const AAR_MAKS = 2200;

export function lesAarstall(raa: string | undefined): number | undefined {
  if (!raa || !/^\d{3,4}$/.test(raa)) return undefined;
  const aar = Number(raa);
  return aar >= AAR_MIN && aar <= AAR_MAKS ? aar : undefined;
}
