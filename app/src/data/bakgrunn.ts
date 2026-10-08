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
  1978: {
    verden: "Den første «prøverørsbabyen» blir født i England. Johannes Paul II blir pave.",
    norge: "Stortinget vedtar selvbestemt abort.",
  },
  1979: {
    verden:
      "Revolusjonen i Iran. Sovjetisk invasjon i Afghanistan. Margaret Thatcher blir britisk statsminister.",
    norge: "Alta-saken tilspisser seg. Demonstrasjonene mot utbyggingen samler folk fra hele landet.",
  },
  1980: {
    verden: "Mange land boikotter OL i Moskva. John Lennon drepes i New York i desember.",
    norge: "Alexander Kielland-ulykken 27. mars. 123 mennesker omkommer i Nordsjøen.",
  },
  1981: {
    verden: "Ronald Reagan blir president. De første tilfellene av det som får navnet aids beskrives.",
    norge:
      "Gro Harlem Brundtland blir landets første kvinnelige statsminister i februar. Etter valget overtar Kåre Willoch.",
  },
  1982: {
    verden: "Falklandskrigen mellom Storbritannia og Argentina.",
  },
  1983: {
    verden:
      "Den kalde krigen er på sitt kaldeste. Frykten for atomkrig preger tiåret og popkulturen med det.",
  },
  1984: {
    verden: "Sultkatastrofen i Etiopia. Band Aid samler inn penger over hele Europa.",
  },
  1985: {
    verden:
      "Mikhail Gorbatsjov blir sovjetisk leder og åpner for glasnost og perestrojka. Live Aid sendes verden over.",
    norge: "Stortingsvalg; Willoch-regjeringen fortsetter med knapp margin.",
  },
  1986: {
    verden:
      "Tsjernobyl-ulykken i april. Romfergen Challenger havarerer i januar. Olof Palme drepes i Stockholm i februar.",
    norge:
      "Nedfall fra Tsjernobyl rammer fjellområdene. Gro Harlem Brundtland danner regjering med åtte kvinnelige statsråder.",
  },
  1987: {
    verden: "INF-avtalen fjerner en hel klasse atomvåpen fra Europa.",
    norge:
      "Brundtland-kommisjonens rapport «Vår felles framtid» setter bærekraftig utvikling på dagsordenen.",
  },
  1988: {
    verden: "Sovjetunionen begynner å trekke styrkene ut av Afghanistan.",
  },
  1989: {
    verden:
      "Berlinmuren faller 9. november, og kommunistregimene i Øst-Europa kollapser på få måneder. Opprøret på Den himmelske freds plass slås ned i juni.",
    norge: "Jan P. Syse danner borgerlig regjering.",
  },
  1990: {
    verden: "Tyskland gjenforenes. Nelson Mandela løslates etter 27 år.",
    norge:
      "Brannen på Scandinavian Star i april; 159 omkommer. Gro Harlem Brundtland tilbake som statsminister.",
  },
  1991: {
    verden: "Sovjetunionen oppløses ved årsskiftet. Golfkrigen.",
    norge: "Kong Olav V dør i januar. Harald V blir konge.",
    oslo: "Byen tar farvel med folkekongen; folk setter lys utenfor slottet i januarkulden.",
  },
  1992: {
    verden: "Krigen i Bosnia bryter ut. Miljøtoppmøtet i Rio.",
  },
  1993: {
    verden: "EU opprettes gjennom Maastricht-traktaten.",
    norge:
      "Oslo-avtalen undertegnes i Washington. Norske diplomater hadde meklet i hemmelighet mellom Israel og PLO.",
  },
  1994: {
    verden: "Folkemordet i Rwanda. Apartheid tar slutt, og Nelson Mandela blir president.",
    norge:
      "Vinter-OL på Lillehammer i februar. Folkeavstemning om EU i november; nei-siden vinner igjen, med 52,2 prosent.",
  },
  1995: {
    verden: "Krigen i Bosnia ender med Dayton-avtalen.",
    norge: "Storflommen på Østlandet i mai — «Vesleofsen».",
  },
  1996: {
    verden: "Internett begynner å nå vanlige hjem.",
    norge: "Thorbjørn Jagland overtar som statsminister etter Gro Harlem Brundtland.",
  },
  1997: {
    verden: "Prinsesse Diana omkommer i Paris i august.",
    norge: "Kjell Magne Bondevik danner sentrumsregjering.",
  },
  1998: {
    verden: "Google grunnlegges.",
    norge:
      "Bondevik sykmeldes offentlig for depresjon. Måten det ble møtt på, endret hvordan psykisk helse omtales.",
  },
  1999: {
    verden: "Krigen i Kosovo; NATO bomber Serbia. Frykten for «år 2000-problemet» preger høsten.",
  },
  2000: {
    verden: "Tusenårsskiftet passerer uten datakollaps.",
    norge: "Jens Stoltenberg blir statsminister for første gang.",
  },
  2001: {
    verden: "Terrorangrepene mot USA 11. september.",
    norge: "Bondevik tilbake som statsminister etter valget.",
  },
  2002: {
    verden: "Euroen kommer som sedler og mynt i tolv land.",
  },
  2003: {
    verden: "USA invaderer Irak.",
  },
  2004: {
    verden:
      "Flodbølgen i Indiahavet andre juledag; rundt 230 000 omkommer. Facebook grunnlegges.",
    norge: "Mange nordmenn rammes av flodbølgen i Thailand.",
    oslo: "«Skrik» og «Madonna» stjeles fra Munch-museet i august.",
  },
  2005: {
    verden: "YouTube starter.",
    norge:
      "Norge feirer hundre år som selvstendig stat. Stoltenberg danner rødgrønn flertallsregjering.",
  },
  2006: {
    oslo: "De stjålne Munch-maleriene kommer til rette.",
  },
  2007: {
    verden: "Den første iPhonen lanseres.",
  },
  2008: {
    verden:
      "Finanskrisen; Lehman Brothers går konkurs i september. Barack Obama velges til president.",
    oslo: "Operaen i Bjørvika åpner i april.",
  },
  2009: {
    verden: "Svineinfluensaen sprer seg, og massevaksinering settes i gang.",
  },
  2010: {
    verden: "Askeskyen fra Eyjafjallajökull stanser flytrafikken i Europa i april.",
  },
  2011: {
    verden: "Den arabiske våren. Osama bin Laden drepes.",
    norge:
      "Terrorangrepene 22. juli. 77 mennesker drepes i regjeringskvartalet og på Utøya.",
    oslo: "Bomben rammer regjeringskvartalet. Dagene etter fyller rosetoget gatene.",
  },
  2012: {
    norge: "Rettssaken etter 22. juli går for Oslo tingrett.",
  },
  2013: {
    verden: "Snowden-avsløringene om masseovervåking.",
    norge: "Erna Solberg blir statsminister.",
  },
  2014: {
    verden: "Russland annekterer Krim. Ebolautbruddet i Vest-Afrika.",
    norge: "Grunnloven fyller 200 år.",
  },
  2015: {
    verden:
      "Flyktningkrisen i Europa. Terrorangrepene i Paris i november. Klimaavtalen i Paris i desember.",
    norge: "Flyktninger kommer også over Storskog i nord.",
  },
  2016: {
    verden: "Storbritannia stemmer for å forlate EU. Donald Trump velges til president.",
  },
  2017: {
    verden: "#MeToo sprer seg over hele verden.",
    norge: "Solberg-regjeringen fortsetter etter valget.",
  },
  2018: {
    verden: "En av de varmeste somrene som er målt i Nord-Europa.",
    norge: "Tørkesommeren rammer landbruket hardt.",
  },
  2019: {
    verden: "Greta Thunberg og skolestreiken for klimaet preger året.",
  },
  2020: {
    verden: "Koronapandemien. Store deler av verden stenger ned i mars.",
    norge: "Norge stenger ned 12. mars — de mest inngripende tiltakene i fredstid.",
    oslo: "Tomme gater, hjemmekontor og stengte skoler.",
  },
  2021: {
    verden: "Stormingen av Kongressen 6. januar. Vaksinene kommer utover året.",
    norge: "Jonas Gahr Støre blir statsminister. Gjenåpningen kommer i september.",
  },
  2022: {
    verden:
      "Russland invaderer Ukraina 24. februar. Energipriser og inflasjon skyter i været.",
    norge: "Strømprisene blir hovedtema. Ukrainske flyktninger tas imot.",
    oslo: "Skytingen i sentrum natt til 25. juni, like før Pride-toget.",
  },
  2023: {
    verden:
      "Kunstig intelligens blir allemannseie. Krigen i Gaza bryter ut i oktober.",
    norge: "Ekstremværet «Hans» i august gir flom og skred på Østlandet.",
  },
  2024: {
    verden: "Valgår i store deler av verden. Trump velges til president på nytt.",
  },
  2025: {
    verden: "Trump tiltrer for andre gang i januar.",
    norge:
      "Senterpartiet går ut av regjeringen i januar, og Støre fortsetter med en ren Arbeiderparti-regjering. Stortingsvalg i september.",
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
