/**
 * Tømmer innholdet, slik at ekte materiale kan legges inn i en ren container.
 *
 * Sletter årsdokumentene og indeksen. Med `--media` også bilder og video.
 * Rører **aldri** felter.json eller tilgang.json – feltdefinisjonene er
 * oppsett, og tilgangslisten er veien inn.
 *
 * Tørrkjøring med vilje: uten `--slett` viser den bare hva den ville tatt.
 * Samme konvensjon som `POST /api/vedlikehold/rydd-media`, og verdt å ha på et
 * skript som ellers kan tømme et helt arkiv med én tastetrykkfeil.
 *
 *   npm run tom                     # mot Azurite, viser hva som finnes
 *   npm run tom -- --slett          # gjør det
 *   npm run tom:sky -- --slett      # mot Azure
 *   npm run tom:sky -- --slett --media
 */
let BlobServiceClient;
try {
  ({ BlobServiceClient } = await import("@azure/storage-blob"));
} catch (e) {
  if (e?.code !== "ERR_MODULE_NOT_FOUND") throw e;
  console.error("\n✖ Avhengighetene er ikke installert.\n  Kjør `npm install` i rota av repoet først.\n");
  process.exit(1);
}

const TILKOBLING = process.env.LAGER_TILKOBLING ?? "UseDevelopmentStorage=true";
const tjeneste = BlobServiceClient.fromConnectionString(TILKOBLING);

const argumenter = process.argv.slice(2);
const skalSlette = argumenter.includes("--slett");
const taMedMedia = argumenter.includes("--media");
const erAzurite = TILKOBLING.includes("UseDevelopmentStorage");

async function listStier(container, prefiks = "") {
  const stier = [];
  const klient = tjeneste.getContainerClient(container);
  if (!(await klient.exists())) return stier;
  for await (const blob of klient.listBlobsFlat({ prefix: prefiks })) {
    stier.push(blob.name);
  }
  return stier;
}

async function slett(container, stier) {
  const klient = tjeneste.getContainerClient(container);
  // Sekvensielt med vilje. Et par hundre blober tar sekunder, og en feil
  // midtveis er lettere å forstå når det ikke skjer femti ting samtidig.
  for (const sti of stier) {
    await klient.getBlockBlobClient(sti).deleteIfExists({ deleteSnapshots: "include" });
  }
}

/** Krever at antallet skrives inn. Å taste `ja` i vane er for lett. */
async function bekreft(antall) {
  if (!process.stdin.isTTY) return true;

  const { createInterface } = await import("node:readline/promises");
  const linje = createInterface({ input: process.stdin, output: process.stdout });
  const svar = await linje.question(`\nSkriv antallet for å bekrefte sletting (${antall}): `);
  linje.close();

  if (svar.trim() !== String(antall)) {
    console.log("Avbrutt. Ingenting er slettet.");
    return false;
  }
  return true;
}

async function main() {
  const aar = await listStier("innhold", "aar/");
  const indeks = (await listStier("innhold", "indeks.json")).filter((s) => s === "indeks.json");
  const media = taMedMedia ? await listStier("media") : [];
  const originaler = taMedMedia ? await listStier("originaler") : [];

  console.log(`\nMot ${erAzurite ? "Azurite" : "Azure"}:\n`);
  console.log(`  ${String(aar.length).padStart(5)} årsdokumenter`);
  console.log(`  ${String(indeks.length).padStart(5)} indeks`);
  if (taMedMedia) {
    console.log(`  ${String(media.length).padStart(5)} mediefiler`);
    console.log(`  ${String(originaler.length).padStart(5)} originaler`);
  } else {
    console.log("        (media og originaler røres ikke – bruk --media)");
  }
  console.log("\n  felter.json og tilgang.json røres aldri.");

  const antall = aar.length + indeks.length + media.length + originaler.length;
  if (antall === 0) {
    console.log("\nIngenting å slette.\n");
    return;
  }

  if (!skalSlette) {
    console.log(`\nTørrkjøring. Legg til --slett for å slette disse ${antall}.\n`);
    return;
  }

  if (!(await bekreft(antall))) return;

  await slett("innhold", [...aar, ...indeks]);
  if (taMedMedia) {
    await slett("media", media);
    await slett("originaler", originaler);
  }

  console.log(`\n✓ Slettet ${antall} blober.`);
  console.log("  Indeksen bygges på nytt av API-et ved første oppslag.");
  if (!erAzurite) {
    console.log("  I Azure er versjonering og soft delete på – dette kan angres i 30 dager.");
  }
  console.log("");
}

main().catch((e) => {
  console.error("\nTømming feilet:", e.message);
  if (String(e.message).includes("ECONNREFUSED")) {
    console.error("Kjører Azurite? Prøv `npm run azurite` i et eget skall.");
  }
  process.exit(1);
});
