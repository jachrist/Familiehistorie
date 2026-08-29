/**
 * Legger felter.json og noen eksempelår inn i lagringskontoen.
 *
 * Mot Azurite som standard. Sett LAGER_TILKOBLING for å kjøre mot Azure –
 * `npm run seed:sky` gjør det ved å hente tilkoblingsstrengen fra az CLI.
 *
 * Eksempelårene er oppdiktede. De er valgt for å vise formen på materialet:
 * tynt før 1950, tettere etterpå, slik at tiårsgrupperingen på forsiden får
 * noe å gruppere.
 */
import { BlobServiceClient } from "@azure/storage-blob";

const TILKOBLING = process.env.LAGER_TILKOBLING ?? "UseDevelopmentStorage=true";
const tjeneste = BlobServiceClient.fromConnectionString(TILKOBLING);

const FELTER = {
  versjon: 1,
  felter: [
    { id: "tittel", etikett: "Overskrift for året", type: "kort_tekst", paakrevd: true },
    { id: "sammendrag", etikett: "Ingress", type: "kort_tekst", hjelp: "Vises i søketreff og på forsiden" },
    { id: "hendelser", etikett: "Hva skjedde", type: "rik_tekst", paakrevd: true },
    { id: "familien", etikett: "Familien", type: "rik_tekst", hjelp: "Fødsler, bryllup, dødsfall, flyttinger" },
    { id: "hjem", etikett: "Hjem og hverdag", type: "rik_tekst" },
    { id: "arbeidSkole", etikett: "Arbeid og skole", type: "rik_tekst" },
    { id: "reiser", etikett: "Reiser", type: "rik_tekst" },
    { id: "kilde", etikett: "Kilde", type: "kort_tekst", hjelp: "Hvor kunnskapen om året kommer fra" },
    { id: "verdenRundt", etikett: "Verden rundt oss", type: "rik_tekst" },
  ],
};

const AAR = [
  // Tynt fram til ca. 1950, deretter fire til ti år per tiår – samme form som
  // materialet familien faktisk sitter på.
  [1868, "Gården i Vang", "Tippoldefar overtok bruket etter faren.", "<p>Overtakelsen er notert i kirkeboka for Vang. Vi vet lite mer om året enn at det skjedde.</p>", "Kirkebok, Vang"],
  [1893, "Utvandringen som ikke ble noe av", "Billettene til Amerika var kjøpt, men reisen ble utsatt.", "<p>Fortalt videre i familien: billettene var kjøpt, men kua kalvet, og reisen ble utsatt for godt.</p>", "Fortalt av bestemor, 1998"],
  [1911, "Første fotografi av slekta", "Omreisende fotograf på Hamar.", "<p>Det eldste bildet vi har der alle er navngitt på baksiden.</p>", "Album 1"],
  [1924, "Vinteren uten ved", "Den kaldeste vinteren noen kunne huske på Hedmarken.", "<p>Fortalt av bestemor i 1998. Låven måtte rives for å skaffe fyring.</p>", "Fortalt av bestemor, 1998"],
  [1938, "Bryllup før krigen", "Oldeforeldrene giftet seg om våren.", "<p>Bildene lå i en konvolutt merket bare med årstallet.</p>", "Album 1"],
  [1945, "Frigjøringen", "Flagg i Vangsvegen og ukjente folk i hagen.", "<p>To bilder tatt 8. mai, begge ute av fokus.</p>", "Album 1"],
  [1948, "Huset på Hamar", "Bestefar kjøpte tomta i Vangsvegen og begynte å bygge.", "<p>Vinteren gikk med til å hogge tømmer. Kjelleren sto ferdig til jul.</p>", "Album 2"],

  [1952, "Taket på plass", "Huset ble ferdig nok til å flytte inn i.", "<p>Innflytting i oktober, med bare halve andre etasje ferdig.</p>", "Album 2"],
  [1955, "Sommeren på Sørlandet", "Første ferie med telt i Lillesand.", "<p>Bilder fra svaberget, og fra fisketuren med onkel Arne som endte med motorstopp.</p>", "Album 2"],
  [1958, "Ny stue og fjernsyn", "Naboene kom for å se det første fjernsynet i gata.", "<p>Påbygget sto ferdig i mai. Apparatet kom i november.</p>", "Album 2"],

  [1961, "Skolestart", "Første skoledag på Ajer.", "<p>Bildet på trappa er tatt hver høst i tolv år etter dette.</p>", "Album 3"],
  [1963, "Bryllupet i Vang kirke", "Mor og far giftet seg i mai.", "<p>Hele slekta var samlet på Hamar, og det finnes smalfilm fra festen på låven etterpå.</p>", "Album 3, smalfilm"],
  [1965, "Hytta ved Mjøsa", "Reist på tre uker med hjelp fra nabolaget.", "<p>Tømmeret kom fra samme skog som huset sytten år tidligere.</p>", "Album 3"],
  [1967, "Bestefar går bort", "Han rakk å se hytta ferdig.", "<p>Begravelsen i Vang kirke, samme kirke som bryllupet.</p>", "Album 3"],

  [1972, "Flyttingen til Bergen", "Året vi pakket ned huset på Hamar og flyttet vestover.", "<p>Ny jobb, ny skole, og betydelig mer regn enn noen hadde regnet med.</p>", "Album 4"],
  [1974, "Første sommer på Vestlandet", "Turer til Fløyen og Ulriken.", "<p>En båttur i Bergen havn endte i tåke og måtte avbrytes.</p>", "Album 4"],
  [1976, "Leiligheten på Nordnes", "Vi flyttet fra Landås og inn til byen.", "<p>Tre trapper opp, utsikt til Puddefjorden.</p>", "Album 4"],
  [1979, "Konfirmasjon", "Slekta kom vestover for første gang siden flyttingen.", "<p>Tjueto til bords i en leilighet bygget for seks.</p>", "Album 5"],

  [1981, "Første bil og tur til Trondheim", "En brukt Volvo 245 i grønt.", "<p>Den lange turen nordover over Dovre, med telt i bagasjerommet.</p>", "Album 5"],
  [1983, "Sommeren hytta brant nesten", "Pipebrann, oppdaget i tide.", "<p>Brannvesenet fra Brumunddal brukte femti minutter. Naboen hadde begynt uten dem.</p>", "Album 5"],
  [1985, "Ny jobb i kommunen", "Far byttet arbeidsplass til Bergen kommune.", "<p>Etter fjorten år i samme stilling.</p>", "Album 5"],
  [1988, "Sølvbryllup", "Tjuefem år siden Vang kirke.", "<p>Feiret på hytta, med de fleste av de samme gjestene.</p>", "Album 6"],

  [1991, "Bestemor flytter til Bergen", "Huset på Hamar ble solgt.", "<p>Det tok tre helger å tømme det. Mye av det som er i dette arkivet, kom fram da.</p>", "Album 6"],
  [1994, "Lillehammer", "OL på fjernsyn hver eneste kveld i februar.", "<p>Vi var på Hamar under skøytene, i Vikingskipet.</p>", "Album 6, video"],
  [1996, "Første datamaskin", "En Pentium med modem i gangen.", "<p>Telefonregningen den høsten er også en del av familiehistorien.</p>", "Album 7"],
  [1998, "Bestemor forteller", "Vi satte oss ned med kassettspiller.", "<p>Fire timer opptak om Hamar, om 1924 og om utvandringen som ikke ble noe av.</p>", "Kassett, digitalisert 2016"],

  [2001, "Studietid", "Flyttet hjemmefra for første gang.", "<p>Hybel på Møhlenpris, tolv kvadratmeter.</p>", "Digitalt"],
  [2003, "Barnebarn nummer én", "Ida ble født i mars.", "<p>Første generasjonsbilde med fire ledd, tatt i stua på Nordnes.</p>", "Digitalt"],
  [2006, "Bryllup nummer to i slekta", "Samme kirke, nytt par.", "<p>Vang kirke igjen, 43 år etter forrige gang.</p>", "Digitalt"],
  [2008, "Bestemor går bort", "97 år gammel.", "<p>Hun rakk å høre opptaket fra 1998 spilt tilbake.</p>", "Digitalt"],

  [2011, "Hytta bygges om", "Innlagt vann, 46 år etter at den ble reist.", "<p>Samme grunnmur, nytt av alt annet.</p>", "Digitalt"],
  [2014, "Barnebarn nummer tre", "Jakob ble født i september.", "<p>Bildet på trappa på hytta er nå fem generasjoner dypt, om man teller bakover i album.</p>", "Digitalt"],
  [2016, "Kassettene digitaliseres", "Fire timer med bestemor, endelig trygt lagret.", "<p>Opptaket fra 1998 lå på en kassett som nesten hadde løsnet.</p>", "Digitalt"],
  [2019, "Femti år siden", "Jubileumsfest på Hamar med slektninger fra hele landet.", "<p>Mange gamle bilder kom fram fra skuffer ingen visste om. Dette arkivet ble bestemt der.</p>", "Digitalt"],

  [2021, "Året hjemme", "Hytta ble brukt mer enn på tjue år.", "<p>Ingen store hendelser, men uvanlig mange bilder.</p>", "Digitalt"],
  [2024, "Arkivet begynner", "Vi begynte å samle alt på ett sted.", "<p>Skanningen av album 1 til 7 startet i januar.</p>", "Digitalt"],
];


/**
 * Eksempelårene refererer ikke til ekte mediefiler – tallene finnes bare for at
 * forsiden skal vise noe realistisk. Derfor tomme media-lister, og antallene
 * regnes ut av indeksbyggeren fra det som faktisk ligger der (altså null).
 * Feltet under holder likevel på tallene, så det er tydelig hva som er ment.
 */
function lagAar([aar, tittel, sammendrag, hendelser, kilde]) {
  const naa = new Date().toISOString();
  return {
    aar,
    felter: { tittel, sammendrag, hendelser, kilde },
    media: [],
    status: "publisert",
    opprettet: naa,
    endret: naa,
    endretAv: "seed",
    skjemaversjon: FELTER.versjon,
  };
}

async function skriv(container, sti, verdi) {
  const kropp = JSON.stringify(verdi, null, 2);
  await tjeneste
    .getContainerClient(container)
    .getBlockBlobClient(sti)
    .upload(kropp, Buffer.byteLength(kropp), {
      blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
    });
}

function flat(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function main() {
  for (const navn of ["innhold", "media", "originaler"]) {
    await tjeneste.getContainerClient(navn).createIfNotExists();
  }

  await skriv("innhold", "felter.json", FELTER);
  console.log("✓ felter.json");

  const dokumenter = AAR.map(lagAar);
  for (const dok of dokumenter) {
    await skriv("innhold", `aar/${dok.aar}.json`, dok);
  }
  console.log(`✓ ${dokumenter.length} årsdokumenter`);

  const indeks = {
    generert: new Date().toISOString(),
    aar: dokumenter
      .map((d) => ({
        aar: d.aar,
        tittel: d.felter.tittel ?? "",
        sammendrag: d.felter.sammendrag ?? "",
        antallBilder: 0,
        antallVideoer: 0,
        sok: [String(d.aar), ...Object.values(d.felter).map(flat)].join(" ").toLowerCase(),
      }))
      .sort((a, b) => b.aar - a.aar),
  };
  await skriv("innhold", "indeks.json", indeks);
  console.log("✓ indeks.json");

  console.log(`\nFerdig mot ${TILKOBLING.includes("UseDevelopmentStorage") ? "Azurite" : "Azure"}.`);
}

main().catch((e) => {
  console.error("\nSeed feilet:", e.message);
  if (String(e.message).includes("ECONNREFUSED")) {
    console.error("Kjører Azurite? Prøv `npm run azurite` i et eget skall.");
  }
  process.exit(1);
});
