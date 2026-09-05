/**
 * Tilgangslisten – innhold/tilgang.json.
 *
 * Å legge til et familiemedlem er en oppgave i appen, ikke i Azure-portalen, og
 * listen sikkerhetskopieres sammen med resten av innholdet.
 *
 * Rollene slås opp ved *hvert* kall, ikke bare ved innlogging. Fjernes noen fra
 * listen, forsvinner tilgangen med en gang. Prisen er ett blob-oppslag i
 * minuttet, siden listen bufres kort.
 */
import type { Person, Rolle, Tilgangsliste } from "../../delt/typer.js";
import { CONTAINER, STI, lesJson } from "./lager.js";

const BUFFER_MS = 60_000;

interface Buffret {
  liste: Tilgangsliste;
  hentet: number;
}
let buffer: Buffret | undefined;

/** Kalles etter skriving, så en endring i GUI-et virker umiddelbart. */
export function tomBuffer(): void {
  buffer = undefined;
}

export async function hentTilgangsliste(): Promise<Tilgangsliste> {
  const naa = Date.now();
  if (buffer && naa - buffer.hentet < BUFFER_MS) return buffer.liste;

  const lest = await lesJson<Tilgangsliste>(CONTAINER.innhold, STI.tilgang);
  if (!lest) {
    // Fail closed. Uten liste slipper ingen inn – heller det enn en tom liste
    // som ved et uhell tolkes som «alle».
    throw new Error(
      "Tilgangslisten (innhold/tilgang.json) mangler. Kjør `npm run seed` lokalt " +
        "eller `npm run seed:sky` mot lagringskontoen for å opprette den."
    );
  }

  buffer = { liste: lest.verdi, hentet: naa };
  return lest.verdi;
}

/** Slår opp én adresse. Sammenligningen er ufølsom for store bokstaver. */
export async function finnPerson(epost: string): Promise<Person | undefined> {
  const sok = epost.trim().toLowerCase();
  const liste = await hentTilgangsliste();
  return liste.personer.find((p) => p.epost.trim().toLowerCase() === sok);
}

/**
 * `redaktoer` innebærer `familie`. Å skrive begge i JSON-en er lett å glemme,
 * og en redaktør som ikke får lese ville vært en pussig feil å lete etter.
 */
export function harRolle(person: Person, rolle: Rolle): boolean {
  if (person.roller.includes(rolle)) return true;
  return rolle === "familie" && person.roller.includes("redaktoer");
}
