/**
 * Registeret over de fulle, uklippede opptakene.
 *
 * Et opptak ligger ett av to steder, og registeret holder orden på hvilket:
 *
 * **I vår egen `opptak`-container.** Dette er den raske veien, og den som bør
 * velges. Nettleseren får videofila fra samme sted som resten av nettstedet,
 * og en scenelenke lander på tidspunktet med én gang.
 *
 * **Bak en delingslenke til SharePoint.** Veien som fantes først. Den fungerer,
 * men på iPad fanger OneDrive-appen lenken opp, og det blir noen trykk innom
 * OneDrives eget nettsted før filmen vises.
 *
 * Delingslenken står uansett ikke i årsteksten. To grunner:
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
import { opptakUrl } from "./sas.js";

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

/**
 * Stien til en fil i opptak-containeren.
 *
 * Sjekken fanger skrivefeil, ikke angrep: det er en redaktør som velger fila,
 * og den velges fra listen over hva som faktisk ligger i containeren. Men en
 * sti med et tomt ledd eller et kontrolltegn skal si fra her og nå, i stedet
 * for å bli en uforståelig 404 fra Azure den dagen noen klikker på en
 * scenelenke.
 *
 * Alt annet slipper gjennom. Tegn som `%` og `#` hører til i filnavn folk
 * faktisk lager, og blir kodet riktig når adressen bygges – en strengere regel
 * ville bare gjort det umulig å velge en fil som står i listen.
 */
export function sjekkFil(raa: string): Urlsvar {
  if (raa.startsWith("/") || raa.endsWith("/")) {
    return { ok: false, grunn: "Stien kan ikke begynne eller slutte med skråstrek." };
  }
  if (raa.split("/").some((d) => d === "" || d === "." || d === "..")) {
    return { ok: false, grunn: "Stien har et tomt eller ugyldig ledd." };
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\\]/.test(raa)) {
    return { ok: false, grunn: "Stien inneholder tegn som ikke hører hjemme i et filnavn." };
  }
  return { ok: true };
}

/**
 * Innholdstypen vi ber Blob Storage svare med.
 *
 * Filene lastes opp med azcopy, som gjetter typen ut fra endelsen og noen
 * ganger bommer. Bommer den, laster nettleseren videoen ned i stedet for å
 * spille den. Her settes typen ut fra endelsen igjen – og kjenner vi ikke
 * endelsen, lar vi blobens egen stå.
 */
export function innholdstype(sti: string): string | undefined {
  const endelse = sti.toLowerCase().split(".").pop() ?? "";
  return TYPER[endelse];
}

const TYPER: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  m2ts: "video/mp2t",
  mts: "video/mp2t",
};

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
 * SharePoint med tidspunktet i, og den vet best. For en scenelenke gjelder det
 * motsatte – da er tidspunktet hele poenget, og `overstyr` setter det uansett.
 *
 * Skulle avspilleren i din leietaker lese en annen parameter, er dette stedet å
 * endre – og inntil videre kan man alltid lime inn hele lenken fra SharePoints
 * delingsdialog og la `start` stå tom.
 */
export function medStarttid(raa: string, sekunder?: number | null, overstyr = false): string {
  if (sekunder === undefined || sekunder === null) return raa;
  if (sekunder <= 0 && !overstyr) return raa;

  let url: URL;
  try {
    url = new URL(raa);
  } catch {
    return raa;
  }

  if (url.searchParams.has("nav") && !overstyr) return raa;

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

/**
 * Adressen som spiller av fila direkte, uten OneDrives nettsted.
 *
 * `?download=1` gir nettleseren selve videofila i stedet for å åpne viewer-en,
 * og `#t=<sekunder>` er mediefragmentet nettleserens egen spiller forstår.
 * Forskjellen er merkbar: viewer-en er en hel applikasjon som må lastes,
 * autentisere og slå opp delingstokenet før et bilde vises. Dette er ett
 * trykk.
 *
 * Prisen er at nettleseren må kunne dekode formatet selv. Transkodet H.264 i
 * MP4 går overalt; en gammel .mov eller .wmv gjør det ikke, og da er viewer-en
 * – som transkoder underveis – den som faktisk virker. Derfor kan hvert opptak
 * velge.
 *
 * Krever også at delingslenken tillater nedlasting. Slås «blokker nedlasting»
 * på i SharePoint, slutter dette å virke.
 */
export function direkteUrl(raa: string, sekunder?: number | null): string {
  let url: URL;
  try {
    url = new URL(raa);
  } catch {
    return raa;
  }

  // Et starttidspunkt kan ligge i `nav` fra SharePoints egen delingsdialog.
  // Den parameteren betyr ingenting uten viewer-en, så tiden hentes ut og
  // settes som mediefragment i stedet for å gå tapt.
  const fraNav = sekunder ?? startFraNav(url.searchParams.get("nav"));
  url.searchParams.delete("nav");
  url.searchParams.set("download", "1");

  const uten = url.toString().split("#")[0]!;
  return fraNav && fraNav > 0 ? `${uten}#t=${Math.round(fraNav)}` : uten;
}

function startFraNav(nav: string | null): number | undefined {
  if (!nav) return undefined;
  try {
    const tolket = JSON.parse(Buffer.from(nav, "base64").toString("utf8")) as {
      playbackOptions?: { startTimeInSeconds?: number };
    };
    const sek = tolket.playbackOptions?.startTimeInSeconds;
    return typeof sek === "number" && sek > 0 ? sek : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Adressen et klikk på en opptakslenke skal ende på.
 *
 * Ligger opptaket i vårt eget lager, signeres en kortlevd adresse rett til
 * fila. Ellers er det delingslenken, i den formen opptaket er satt opp med.
 */
export async function avspillingsUrl(
  opptak: Pick<Opptak, "url" | "fil" | "avspilling">,
  sekunder?: number | null
): Promise<string> {
  if (opptak.fil) {
    const url = await opptakUrl(opptak.fil, innholdstype(opptak.fil));
    // Fragmentet sendes aldri til Azure, så signaturen er urørt – men
    // nettleseren leser det og spoler dit med én gang.
    return sekunder && sekunder > 0 ? `${url}#t=${Math.round(sekunder)}` : url;
  }

  if (!opptak.url) return "/";

  return opptak.avspilling === "viewer"
    ? medStarttid(opptak.url, sekunder, sekunder !== undefined && sekunder !== null)
    : direkteUrl(opptak.url, sekunder);
}
