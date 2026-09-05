/**
 * Hvem er innlogget.
 *
 * Sesjonen ligger i en httpOnly-kapsel klienten ikke kan lese, så dette er
 * eneste kilde. Det er en forbedring: rollene kommer fra serveren ved hvert
 * oppslag, ikke fra noe klienten husker fra sist.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Innlogget } from "../../../delt/typer.js";
import { Apifeil, api, noekler } from "../api/klient.js";

export function useOkt() {
  const tilstand = useQuery({
    queryKey: noekler.meg,
    queryFn: api.meg,
    // 401 er et gyldig svar her, ikke en feil å prøve på nytt.
    retry: false,
    staleTime: 5 * 60_000,
  });

  const uinnlogget =
    tilstand.isError && tilstand.error instanceof Apifeil && tilstand.error.erUinnlogget;

  return {
    ...tilstand,
    innlogget: tilstand.data,
    uinnlogget,
    erRedaktoer: tilstand.data?.roller.includes("redaktoer") ?? false,
    /** Noe annet enn 401 – serveren er nede, eller tilgangslisten mangler. */
    feilet: tilstand.isError && !uinnlogget ? tilstand.error : undefined,
  };
}

export function useLoggUt() {
  return useMutation({
    meta: { innloggingsforsok: true },
    mutationFn: api.loggUt,
    onSuccess: () => {
      // Full sidelasting, ikke bare tømming av mellomlageret. Det er den eneste
      // måten å være sikker på at ingenting av forrige brukers innhold ligger
      // igjen i minnet – verken i spørringsbufferet eller i komponenttilstand.
      // `queryClient.clear()` ble prøvd først og etterlot observatørene i en
      // tilstand der forsiden ble stående med tomme felter.
      window.location.assign("/");
    },
  });
}

/** Brukes av innloggingssiden når koden er godtatt. */
export function settInnlogget(
  koe: ReturnType<typeof useQueryClient>,
  meg: Innlogget
): void {
  koe.setQueryData(noekler.meg, meg);
}

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Merker mutasjoner der 401 betyr «feil kode», ikke «utløpt sesjon».
       * Uten dette ville et feiltastet siffer nullstilt innloggingsskjemaet.
       */
      innloggingsforsok?: boolean;
    };
  }
}
