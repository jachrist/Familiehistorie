/**
 * Adgangskontroll.
 *
 * Fordi innloggingen er vår egen og ikke Static Web Apps' innebygde, kan ikke
 * staticwebapp.config.json beskytte noe – SWA kjenner ikke et token vi utsteder
 * selv. All autorisasjon ligger derfor her, og hvert endepunkt kaller
 * `krevRolle()` først.
 *
 * TRINN 9 fyller ut denne filen: validering av fh_sesjon-kapselen og oppslag mot
 * innhold/tilgang.json. Fram til da slipper alt gjennom. Formen er på plass, så
 * trinn 9 blir å fylle ut ett sted i stedet for å endre alle endepunktene.
 */
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import { feil } from "./svar.js";

export type Rolle = "familie" | "redaktoer";

export interface Innlogget {
  epost: string;
  navn: string;
  roller: Rolle[];
}

/** Sann så lenge API-et kjører uten innlogging, altså fram til trinn 9. */
export const INNLOGGING_MANGLER = true;

/**
 * Returnerer `undefined` når kallet er tillatt, ellers et ferdig feilsvar som
 * endepunktet skal returnere uendret.
 */
export function krevRolle(
  rolle: Rolle,
  foresporsel: HttpRequest
): HttpResponseInit | undefined {
  const jsonKrav = krevJson(foresporsel);
  if (jsonKrav) return jsonKrav;

  if (INNLOGGING_MANGLER) return undefined;

  // Trinn 9: les fh_sesjon, slå opp roller i tilgangslisten, sjekk `rolle`.
  return feil(501, "Innlogging er ikke tatt i bruk ennå.");
}

/**
 * Skriveoperasjoner må sendes som JSON. Kravet er halve CSRF-vernet i trinn 9
 * (et HTML-skjema kan ikke produsere application/json), og det er billigere å
 * ha det på plass fra starten enn å oppdage i ettertid at en klient har begynt
 * å sende noe annet.
 */
function krevJson(foresporsel: HttpRequest): HttpResponseInit | undefined {
  // DELETE har normalt ingen kropp, og unntas derfor.
  if (!["POST", "PUT", "PATCH"].includes(foresporsel.method)) return undefined;

  const type = foresporsel.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) {
    return feil(415, "Skriveoperasjoner må sendes som application/json.");
  }
  return undefined;
}
