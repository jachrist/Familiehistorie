/**
 * Table Storage i samme lagringskonto som blobene.
 *
 * Her ligger det som skal utløpe og telles: engangskoder og tellere for
 * rate-limiting. Det er ikke å innføre en database – tabelltjenesten er en del
 * av kontoen som allerede finnes, og passer for korte, nøkkelbaserte oppslag.
 * Årsdokumentene blir liggende i Blob.
 *
 * Autentiseringen følger samme to-veis mønster som lager.ts: tilkoblingsstreng
 * (Azurite lokalt, managed functions i Azure) eller kontonavn + identitet.
 */
import { TableClient, TableServiceClient } from "@azure/data-tables";
import { DefaultAzureCredential } from "@azure/identity";

export const TABELL = {
  /** Utestående engangskoder, én rad per e-postadresse. */
  koder: "koder",
  /** Tellere for hvor ofte en adresse kan be om kode. */
  sperrer: "sperrer",
} as const;

function les(navn: string): string | undefined {
  const v = process.env[navn];
  return v && v.trim() !== "" ? v : undefined;
}

const klienter = new Map<string, Promise<TableClient>>();

/**
 * Klient for én tabell. Tabellen opprettes ved første bruk – nødvendig lokalt,
 * og en billig no-op i Azure.
 */
export function tabell(navn: string): Promise<TableClient> {
  const finnes = klienter.get(navn);
  if (finnes) return finnes;

  const opprett = (async () => {
    const tilkobling = les("LAGER_TILKOBLING");
    const klient = tilkobling
      ? TableClient.fromConnectionString(tilkobling, navn, { allowInsecureConnection: true })
      : new TableClient(
          `https://${kontonavn()}.table.core.windows.net`,
          navn,
          new DefaultAzureCredential()
        );

    await klient.createTable().catch((e: unknown) => {
      // TableAlreadyExists er det normale utfallet og ikke en feil.
      if (!erTabellFinnes(e)) throw e;
    });
    return klient;
  })();

  klienter.set(navn, opprett);
  return opprett;
}

function kontonavn(): string {
  const konto = les("LAGER_KONTO");
  if (!konto) {
    throw new Error(
      "Mangler lagringsoppsett: sett enten LAGER_TILKOBLING eller LAGER_KONTO."
    );
  }
  return konto;
}

function erTabellFinnes(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    (e as { statusCode?: number }).statusCode === 409
  );
}

/** Sann når feilen er «fant ikke raden». */
export function erIkkeFunnet(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    (e as { statusCode?: number }).statusCode === 404
  );
}

/**
 * Brukes bare av røykprøven: tabelltjenesten i Azurite beholder rader mellom
 * kjøringer, og en prøve skal ikke arve tilstand fra forrige.
 */
export async function slettTabeller(): Promise<void> {
  const tilkobling = les("LAGER_TILKOBLING");
  if (!tilkobling) throw new Error("slettTabeller() er bare ment for lokal bruk.");

  const tjeneste = TableServiceClient.fromConnectionString(tilkobling, {
    allowInsecureConnection: true,
  });
  for (const navn of Object.values(TABELL)) {
    await tjeneste.deleteTable(navn).catch(() => undefined);
    klienter.delete(navn);
  }
}
