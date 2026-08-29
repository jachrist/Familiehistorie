/**
 * Minimal datahenting.
 *
 * Bevisst ikke TanStack Query ennå. Trinn 4 leser ett dokument og skriver
 * ingenting; da er et bibliotek for cache-invalidering og optimistiske
 * oppdateringer vekt uten nytte. Det hører hjemme i trinn 6, når redigering
 * kommer.
 */
import { useEffect, useState } from "react";
import { Apifeil } from "./klient.js";

export type Tilstand<T> =
  | { status: "laster" }
  | { status: "klar"; data: T }
  | { status: "feil"; feil: Apifeil };

export function useHent<T>(hent: () => Promise<T>, nokler: unknown[] = []): Tilstand<T> {
  const [tilstand, settTilstand] = useState<Tilstand<T>>({ status: "laster" });

  useEffect(() => {
    let gjeldende = true;
    settTilstand({ status: "laster" });

    hent()
      .then((data) => {
        if (gjeldende) settTilstand({ status: "klar", data });
      })
      .catch((e: unknown) => {
        if (!gjeldende) return;
        settTilstand({
          status: "feil",
          feil: e instanceof Apifeil ? e : new Apifeil(0, "Ukjent feil."),
        });
      });

    return () => {
      // Hindrer at et svar fra en forespørsel vi har gått bort fra, overskriver
      // tilstanden til den vi venter på nå.
      gjeldende = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, nokler);

  return tilstand;
}
