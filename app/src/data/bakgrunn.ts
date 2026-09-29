/**
 * Bakgrunnsstoff per år: hva som skjedde i verden, i Norge og i Oslo.
 *
 * Ligger i appen, ikke i lagringskontoen, og det er et bevisst valg: dette er
 * ikke familiens innhold, men et oppslagsverk som følger koden. Det gjør at en
 * tømming ikke rører det, at en sikkerhetskopi slipper å bære det, og at en
 * rettelse kommer alle år til gode i én utrulling.
 *
 * Teksten settes inn i feltet «Verden rundt oss» med en knapp i redigeringen,
 * og kan redigeres fritt etterpå. Den er et utgangspunkt, ikke en fasit.
 *
 * Skrevet ned fra hukommelsen, ikke hentet fra kilder. Verdenshendelsene er
 * godt kjent stoff; årstall for norske og særlig Oslo-lokale ting er de som er
 * verdt en kontroll før de blir stående som familiens historie.
 */
export interface Bakgrunn {
  verden?: string;
  norge?: string;
  oslo?: string;
}

export const BAKGRUNN: Record<number, Bakgrunn> = {
  1950: {
    verden: "Koreakrigen bryter ut i juni. Den kalde krigen setter seg for alvor.",
    norge: "Gjenreisningen etter krigen preger landet. Rasjoneringen er på vei ut.",
    oslo: "Oslo feirer 900 år. Rådhuset innvies etter tjue års byggetid.",
  },
  1951: {
    verden: "Kull- og stålunionen undertegnes i Paris — den første spiren til det som blir EF.",
    norge: "Oscar Torp overtar som statsminister etter Einar Gerhardsen.",
    oslo: "Boligmangelen er stor. De første drabantbyene planlegges sørøst i byen.",
  },
  1952: {
    verden: "Elizabeth blir dronning av Storbritannia.",
    norge: "Vinter-OL i Oslo. Hjalmar «Hjallis» Andersen tar tre gull på skøyter.",
    oslo: "Lekene preger byen hele vinteren. Åpningen holdes på Bislett, hopprennet i Holmenkollen.",
  },
  1953: {
    verden:
      "Stalin dør i mars. Våpenhvile i Korea i juli. Mount Everest besteget for første gang.",
    norge: "Stortingsvalg; Arbeiderpartiet fortsetter i regjering.",
  },
  1954: {
    verden: "Frankrike taper slaget om Dien Bien Phu. Indokina deles, og Vietnam med det.",
    norge: "NRK begynner prøvesendinger med fjernsyn.",
  },
  1955: {
    verden: "Warszawapakten opprettes som motvekt til NATO.",
    norge: "Einar Gerhardsen tilbake som statsminister.",
  },
  1956: {
    verden:
      "Suez-krisen. Sovjetiske styrker slår ned opprøret i Ungarn. Khrusjtsjov tar oppgjør med Stalin.",
    norge: "Ungarske flyktninger tas imot.",
  },
  1957: {
    verden:
      "Sputnik skytes opp i oktober og romkappløpet begynner. Romatraktaten undertegnes.",
    norge: "Kong Haakon VII dør i september. Olav V blir konge.",
    oslo: "Byen tar farvel med kongen som kom hjem i 1945.",
  },
  1958: {
    verden: "Verdensutstillingen i Brussel; Atomium blir tidens symbol på framtidstro.",
    oslo: "Drabantbyene vokser fram — Lambertseter, Veitvet, Manglerud.",
  },
  1959: {
    verden:
      "Fidel Castro tar makten på Cuba. Sovjetiske sonder sender de første bildene av månens bakside.",
  },
  1960: {
    verden:
      "Et amerikansk U2-fly skytes ned over Sovjet. En rekke afrikanske kolonier blir selvstendige.",
    norge:
      "NRK starter faste fjernsynssendinger 20. august. Der det finnes et apparat, samles nabolaget.",
  },
  1961: {
    verden: "Berlinmuren bygges i august. Jurij Gagarin er først i rommet i april.",
    norge: "Påskeopprøret i Arbeiderpartiet. Sosialistisk Folkeparti stiftes.",
    oslo: "Enerhaugen saneres; høyblokkene reiser seg der trehusene sto.",
  },
  1962: {
    verden: "Cubakrisen i oktober. Verden er nærmere atomkrig enn noen gang før eller siden.",
    norge: "Kings Bay-ulykken på Svalbard i november. 21 gruvearbeidere omkommer.",
  },
  1963: {
    verden:
      "John F. Kennedy drepes i Dallas i november. Martin Luther King holder talen sin i Washington.",
    norge:
      "Kings Bay-saken feller regjeringen Gerhardsen. John Lyng leder en borgerlig regjering i knappe fire uker.",
    oslo: "Munch-museet åpner på Tøyen.",
  },
  1964: {
    verden: "USA trapper opp i Vietnam etter episoden i Tonkinbukta.",
    norge: "Beatles-bølgen når Norge. Ungdomskulturen blir synlig for alvor.",
  },
  1965: {
    verden: "USA sender de første regulære kampstyrkene til Vietnam.",
    norge:
      "Borgerlig valgseier etter tjue sammenhengende år med Arbeiderpartiet. Per Borten blir statsminister.",
  },
  1966: {
    verden: "Kulturrevolusjonen begynner i Kina.",
    oslo: "T-banen åpner. De første linjene går mellom sentrum og Lambertseter.",
  },
  1967: {
    verden:
      "Seksdagerskrigen i juni. Den første hjertetransplantasjonen utføres i Sør-Afrika.",
    norge: "Folketrygden innføres 1. januar.",
  },
  1968: {
    verden:
      "Opprørsår: Praha-våren slås ned, Martin Luther King og Robert Kennedy drepes, studentene fyller gatene i Paris.",
    norge: "Studentopprøret merkes også her, i mindre målestokk.",
  },
  1969: {
    verden: "Apollo 11 lander på månen 20. juli. Woodstock samler en generasjon.",
    norge:
      "Olje funnet på Ekofisk i romjulen. Oljealderen begynner uten at noen helt forstår det ennå.",
  },
  1970: {
    verden: "The Beatles går i oppløsning.",
    norge: "Mardøla-aksjonen. Naturvern blir en folkebevegelse.",
  },
  1971: {
    verden: "Bangladesh blir selvstendig etter krig.",
    norge:
      "Borten-regjeringen faller etter lekkasjen om EF-forhandlingene. Trygve Bratteli blir statsminister.",
  },
  1972: {
    verden: "Nixon besøker Kina. Terrorangrepet under OL i München. Innbruddet i Watergate.",
    norge:
      "Folkeavstemning om EF 25. september. Nei-siden vinner med 53,5 prosent, og Bratteli går av. NRK begynner å sende i farger.",
    oslo: "I Oslo var det ja-flertall, i motsetning til landet som helhet. Striden gikk tvers gjennom familier.",
  },
  1973: {
    verden:
      "Oljekrisen etter Yom Kippur-krigen firedobler oljeprisen. USA trekker seg ut av Vietnam.",
    norge: "Bilfrie søndager vinteren 1973–74. Stortingsvalg, og Bratteli er tilbake.",
  },
  1974: {
    verden: "Nixon går av etter Watergate. ABBA vinner Melodi Grand Prix med «Waterloo».",
  },
  1975: {
    verden:
      "Vietnamkrigen slutter; Saigon faller i april. Franco dør, og Spania begynner veien mot demokrati.",
    oslo: "Postgirobygget står ferdig ved Vaterland og blir landets høyeste hus.",
  },
  1976: {
    verden: "USA feirer 200 år. Mao dør i september.",
    norge: "Odvar Nordli blir statsminister.",
  },
  1977: {
    verden: "Elvis Presley dør i august.",
    norge:
      "Bravo-utblåsningen på Ekofisk i april. Det første store oljeutslippet i Nordsjøen.",
  },
};

/** Feltet bakgrunnen hører hjemme i. Samsvarer med `felter.json`. */
export const BAKGRUNNSFELT = "verdenRundt";

const TRADER = [
  ["Verden", (b: Bakgrunn) => b.verden],
  ["Norge", (b: Bakgrunn) => b.norge],
  ["Oslo", (b: Bakgrunn) => b.oslo],
] as const;

/**
 * Bakgrunnen for et år som HTML, klar til å settes inn i et rik tekst-felt.
 * `undefined` for år vi ikke har noe om.
 *
 * Bare `<p>` og `<strong>`, som begge står på serverens liste over tillatte
 * merker – det som settes inn her skal overleve saniteringen uendret.
 */
export function bakgrunnSomHtml(aar: number): string | undefined {
  const post = BAKGRUNN[aar];
  if (!post) return undefined;

  const avsnitt = TRADER.flatMap(([etikett, les]) => {
    const tekst = les(post);
    return tekst ? [`<p><strong>${etikett}:</strong> ${flukt(tekst)}</p>`] : [];
  });

  return avsnitt.length > 0 ? avsnitt.join("") : undefined;
}

function flukt(tekst: string): string {
  return tekst.replace(/[&<>]/g, (t) => (t === "&" ? "&amp;" : t === "<" ? "&lt;" : "&gt;"));
}
