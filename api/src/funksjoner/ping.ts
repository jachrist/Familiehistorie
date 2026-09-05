import { app, type HttpResponseInit } from "@azure/functions";

/**
 * Livstegn. Ingen avhengigheter, ingen lagring, ingen innlogging.
 *
 * Finnes for å skille to feil fra hverandre: svarer denne, men ikke resten,
 * ligger feilen i det enkelte endepunktet. Svarer den ikke, er hele
 * Functions-appen nede – og da er det ikke noe poeng i å lete i koden.
 */
app.http("ping", {
  methods: ["GET"],
  route: "ping",
  authLevel: "anonymous",
  handler: async (): Promise<HttpResponseInit> => ({
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body: "ok",
  }),
});
