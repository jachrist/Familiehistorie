/**
 * Registeret over opptak som ligger utenfor nettstedet.
 *
 * De fulle, uklippede opptakene ligger i et SharePoint-bibliotek, og spilles av
 * i SharePoints egen avspiller – den strømmer, og tåler formater og filstørrelser
 * en `<video>`-tag ikke gjør noe fornuftig med.
 *
 * Delingslenken står likevel ikke i årsteksten. To grunner:
 *
 * **Den kan byttes.** En delingslenke kan utløpe eller trekkes tilbake. Står
 * den i teksten, må hver årsside som nevner opptaket redigeres. Står den her,
 * er det én linje.
 *
 * **Den er selv legitimasjonen.** En «alle med lenken»-lenke slipper inn den som
 * har URL-en. Ligger den i sidekilden, ligger den der for alle som får tak i
 * siden. Her ligger den bak `krevRolle`, og den som ikke er logget inn ser den
 * aldri.
 *
 * Det som *ikke* oppnås: en innlogget kan følge omdirigeringen og kopiere den
 * endelige adressen. Dette er en innpakning, ikke kryptografi.
 */
import type { Opptak, Opptaksregister } from "../../delt/typer.js";
import { CONTAINER, STI, lesJson } from "./lager.js";

export const ID_MONSTER = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Verter registeret får peke på.
 *
 * Endepunktet omdirigerer fra vårt eget domene, og en åpen omdirigering er en
 * gave til den som vil få en phishing-lenke til å se ut som om den kommer fra
 * familiens nettsted. Bare redaktører kan skrive i registeret, så trusselen er
 * liten – men listen koster ingenting, og feilmeldingen sier hva som må til for
 * å utvide den.
 */
const STANDARD_VERTER = ["sharepoint.com"];

export function tillatteVerter(): string[] {
  const oppsett = (process.env.OPPTAK_VERTER ?? "").trim();
  if (!oppsett) return STANDARD_VERTER;
  return oppsett
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export interface Urlsvar {
  ok: boolean;
  grunn?: string;
}

export function sjekkUrl(raa: string): Urlsvar {
  let url: URL;
  try {
    url = new URL(raa);
  } catch {
    return { ok: false, grunn: "Adressen er ikke en gyldig URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, grunn: "Adressen må begynne med https://." };
  }

  const vert = url.hostname.toLowerCase();
  const tillatt = tillatteVerter().some((v) => vert === v || vert.endsWith(`.${v}`));
  if (!tillatt) {
    return {
      ok: false,
      grunn: `${vert} står ikke blant de tillatte vertene (${tillatteVerter().join(", ")}). Utvid OPPTAK_VERTER hvis den skal med.`,
    };
  }

  return { ok: true };
}

/**
 * Legger et starttidspunkt på lenken.
 *
 * SharePoints egen avspiller leser starttiden fra `nav`-parameteren, som er
 * base64 av et lite JSON-objekt. Det er slik «Del med starttidspunkt» i
 * SharePoint bygger lenken sin.
 *
 * Bærer lenken allerede en `nav`, står den urørt: da er den kopiert fra
 * SharePoint med tidspunktet i, og den vet best.
 *
 * Skulle avspilleren i din leietaker lese en annen parameter, er dette stedet å
 * endre – og inntil videre kan man alltid lime inn hele lenken fra SharePoints
 * delingsdialog og la `start` stå tom.
 */
export function medStarttid(raa: string, sekunder?: number | null): string {
  if (!sekunder || sekunder <= 0) return raa;

  let url: URL;
  try {
    url = new URL(raa);
  } catch {
    return raa;
  }

  if (url.searchParams.has("nav")) return raa;

  const nav = { playbackOptions: { startTimeInSeconds: Math.round(sekunder) } };
  url.searchParams.set("nav", Buffer.from(JSON.stringify(nav), "utf8").toString("base64"));
  return url.toString();
}

export async function lesRegister(): Promise<Opptaksregister> {
  const lest = await lesJson<Opptaksregister>(CONTAINER.innhold, STI.opptak);
  return lest?.verdi ?? { opptak: [] };
}

export async function finnOpptak(id: string): Promise<Opptak | undefined> {
  const register = await lesRegister();
  return register.opptak.find((o) => o.id === id);
}
