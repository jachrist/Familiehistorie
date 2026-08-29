import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.js";
import "./stil.css";

const koe = new QueryClient({
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
