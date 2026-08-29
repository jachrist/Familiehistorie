/**
 * Tilgang til lagringskontoen.
 *
 * To måter å autentisere på, valgt av miljøet:
 *
 *   LAGER_TILKOBLING   tilkoblingsstreng – Azurite lokalt, og managed
 *                      functions på Static Web Apps' gratisplan
 *   LAGER_KONTO        kontonavn + DefaultAzureCredential – brukes når API-et
 *                      kjører et sted som har en identitet, altså en linket
 *                      Function App på Standard-planen
 *
 * Forskjellen har én konsekvens som betyr noe: SAS-signering. Med
 * tilkoblingsstreng signeres med kontonøkkelen, med identitet må det brukes en
 * user delegation key. Begge veier er implementert i sas.ts.
 */
import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";

export const CONTAINER = {
  innhold: "innhold",
  media: "media",
  originaler: "originaler",
} as const;

export const STI = {
  felter: "felter.json",
  indeks: "indeks.json",
  tilgang: "tilgang.json",
  aar: (aar: number) => `aar/${aar}.json`,
} as const;

function les(navn: string): string | undefined {
  const v = process.env[navn];
  return v && v.trim() !== "" ? v : undefined;
}

/** Kontonøkkel, hvis vi har en tilkoblingsstreng å hente den fra. */
export function delteNokler(): StorageSharedKeyCredential | undefined {
  const tilkobling = les("LAGER_TILKOBLING");
  if (!tilkobling) return undefined;

  const deler = new Map(
    tilkobling
      .split(";")
      .filter(Boolean)
      .map((bit) => {
        const skille = bit.indexOf("=");
        return [bit.slice(0, skille), bit.slice(skille + 1)] as const;
      })
  );

  // Azurite bruker en fast, offentlig kjent utviklingskonto.
  if (tilkobling.includes("UseDevelopmentStorage=true")) {
    return new StorageSharedKeyCredential(
      "devstoreaccount1",
      "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
    );
  }

  const konto = deler.get("AccountName");
  const nokkel = deler.get("AccountKey");
  return konto && nokkel ? new StorageSharedKeyCredential(konto, nokkel) : undefined;
}

let bufret: BlobServiceClient | undefined;

export function blobtjeneste(): BlobServiceClient {
  if (bufret) return bufret;

  const tilkobling = les("LAGER_TILKOBLING");
  if (tilkobling) {
    bufret = BlobServiceClient.fromConnectionString(tilkobling);
    return bufret;
  }

  const konto = les("LAGER_KONTO");
  if (!konto) {
    throw new Error(
      "Mangler lagringsoppsett: sett enten LAGER_TILKOBLING (tilkoblingsstreng) eller LAGER_KONTO (kontonavn + Managed Identity)."
    );
  }

  bufret = new BlobServiceClient(
    `https://${konto}.blob.core.windows.net`,
    new DefaultAzureCredential()
  );
  return bufret;
}

export function container(navn: string) {
  return blobtjeneste().getContainerClient(navn);
}

/** Sørger for at containerne finnes. Nødvendig lokalt; no-op i Azure. */
export async function sikreContainere(): Promise<void> {
  await Promise.all(
    Object.values(CONTAINER).map((navn) => container(navn).createIfNotExists())
  );
}

export interface LestBlob<T> {
  verdi: T;
  etag: string;
}

/** Leser og parser en JSON-blob. `undefined` hvis den ikke finnes. */
export async function lesJson<T>(
  containernavn: string,
  sti: string
): Promise<LestBlob<T> | undefined> {
  const blob = container(containernavn).getBlockBlobClient(sti);
  try {
    const svar = await blob.download();
    const tekst = await stromTilTekst(svar.readableStreamBody);
    return { verdi: JSON.parse(tekst) as T, etag: svar.etag ?? "" };
  } catch (feil) {
    if (erStatus(feil, 404)) return undefined;
    throw feil;
  }
}

export interface SkriveVilkaar {
  /** Krev at blobens ETag er denne – ellers 412. */
  ifMatch?: string;
  /** Krev at bloben ikke finnes – ellers 409. */
  maaVaereNy?: boolean;
}

/** Skriver en JSON-blob. Returnerer den nye ETag-en. */
export async function skrivJson(
  containernavn: string,
  sti: string,
  verdi: unknown,
  vilkaar: SkriveVilkaar = {}
): Promise<string> {
  const blob = container(containernavn).getBlockBlobClient(sti);
  const kropp = JSON.stringify(verdi, null, 2);

  const svar = await blob.upload(kropp, Buffer.byteLength(kropp), {
    blobHTTPHeaders: { blobContentType: "application/json; charset=utf-8" },
    conditions: vilkaar.ifMatch
      ? { ifMatch: vilkaar.ifMatch }
      : vilkaar.maaVaereNy
        ? { ifNoneMatch: "*" }
        : {},
  });

  return svar.etag ?? "";
}

export async function slettBlob(containernavn: string, sti: string): Promise<boolean> {
  const blob = container(containernavn).getBlockBlobClient(sti);
  const svar = await blob.deleteIfExists({ deleteSnapshots: "include" });
  return svar.succeeded;
}

/** Alle årstall som finnes i innhold-containeren, sortert stigende. */
export async function listAarstall(): Promise<number[]> {
  const aar: number[] = [];
  for await (const blob of container(CONTAINER.innhold).listBlobsFlat({ prefix: "aar/" })) {
    const treff = /^aar\/(\d{3,4})\.json$/.exec(blob.name);
    if (treff?.[1]) aar.push(Number(treff[1]));
  }
  return aar.sort((a, b) => a - b);
}

export function erStatus(feil: unknown, status: number): boolean {
  return typeof feil === "object" && feil !== null && "statusCode" in feil
    ? (feil as { statusCode?: number }).statusCode === status
    : false;
}

async function stromTilTekst(strom: NodeJS.ReadableStream | undefined): Promise<string> {
  if (!strom) return "";
  const biter: Buffer[] = [];
  for await (const bit of strom) {
    biter.push(typeof bit === "string" ? Buffer.from(bit) : Buffer.from(bit));
  }
  return Buffer.concat(biter).toString("utf8");
}

/** Alle blobstier i en container, med valgfritt prefiks. */
export async function listBlober(containernavn: string, prefiks = ""): Promise<string[]> {
  const navn: string[] = [];
  for await (const blob of container(containernavn).listBlobsFlat({ prefix: prefiks })) {
    navn.push(blob.name);
  }
  return navn;
}
