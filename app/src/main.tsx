import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Apifeil, noekler } from "./api/klient.js";
import { App } from "./App.js";
import "./stil.css";

/**
 * En sesjon kan utløpe midt i bruk. Da svarer et hvilket som helst endepunkt
 * 401, og eneste riktige reaksjon er å spørre serveren om hvem vi er på nytt –
 * hvorpå App viser innloggingen. Kallet mot /api/meg unntas, ellers ville et
 * 401 derfra utløst et nytt kall til samme sted.
 *
 * Selve innloggingen unntas også, og det er ikke en detalj: et feil kodeforsøk
 * svarer 401, men betyr ikke at sesjonen er borte. Behandles de to likt, blir
 * innloggingsskjemaet nullstilt hver gang noen taster feil.
 */
function paaFeil(feil: unknown, noekkel: readonly unknown[]): void {
  if (!(feil instanceof Apifeil) || !feil.erUinnlogget) return;
  if (noekkel[0] === noekler.meg[0]) return;
  koe.invalidateQueries({ queryKey: noekler.meg });
}

const koe: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (feil, sporring) => paaFeil(feil, sporring.queryKey),
  }),
  mutationCache: new MutationCache({
    onError: (feil, _variabler, _kontekst, mutasjon) => {
      if (mutasjon.meta?.innloggingsforsok) return;
      paaFeil(feil, []);
    },
  }),
  defaultOptions: {
    queries: {
      // Innholdet endres sjelden, og bare av oss selv. Da er det unødvendig å
      // hente på nytt hver gang fanen får fokus.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const rot = document.getElementById("rot");
if (!rot) throw new Error("Fant ikke #rot i index.html.");

createRoot(rot).render(
  <StrictMode>
    <QueryClientProvider client={koe}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
