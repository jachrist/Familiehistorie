/**
 * Adgangskontroll.
 *
 * Fordi innloggingen er vår egen og ikke Static Web Apps' innebygde, kan ikke
 * staticwebapp.config.json beskytte noe – SWA kjenner ikke et token vi utsteder
 * selv. All autorisasjon ligger derfor her, og hvert endepunkt kaller
 * `krevRolle()` først.
 *
 * Rekkefølgen er med vilje: Content-Type sjekkes før sesjonen. Et kall med feil
 * innpakning skal avvises likt enten det kommer fra en innlogget eller ikke.
 */
import type { HttpRequest, HttpResponseInit } from "@azure/functions";
import type { Person, Rolle } from "../../delt/typer.js";
import { KAPSELNAVN, kapselFra, lesToken } from "./sesjon.js";
import { feil } from "./svar.js";
import { finnPerson, harRolle } from "./tilgang.js";

export type { Rolle };

/**
 * Enten et ferdig feilsvar som endepunktet returnerer uendret, eller personen
 * kallet kommer fra. Aldri begge.
 */
export type Vaktsvar =
  | { nektet: HttpResponseInit; person?: undefined }
  | { nektet?: undefined; person: Person };

export async function krevRolle(rolle: Rolle, foresporsel: HttpRequest): Promise<Vaktsvar> {
  const jsonKrav = krevJson(foresporsel);
  if (jsonKrav) return { nektet: jsonKrav };

  const person = await innlogget(foresporsel);
  if (!person) {
    return { nektet: feil(401, "Du må logge inn for å se dette.") };
  }

  if (!harRolle(person, rolle)) {
    return { nektet: feil(403, "Du har ikke tilgang til dette.") };
  }

  return { person };
}

/**
 * Personen bak kapselen, eller `undefined`. Rollene hentes fra tilgangslisten,
 * ikke fra tokenet – fjernes noen fra listen, slutter tilgangen umiddelbart.
 */
export async function innlogget(foresporsel: HttpRequest): Promise<Person | undefined> {
  const token = kapselFra(foresporsel.headers.get("cookie"), KAPSELNAVN);
  const sesjon = lesToken(token);
  if (!sesjon) return undefined;

  return await finnPerson(sesjon.epost);
}

/**
 * Skriveoperasjoner må sendes som JSON. Kravet er halve CSRF-vernet
 * (et HTML-skjema kan ikke produsere application/json), sammen med
 * `SameSite=Strict` på kapselen.
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
