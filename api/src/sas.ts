/**
 * Kortlevde SAS-URL-er.
 *
 * Alt media ligger i private containere. Klienten får aldri en varig URL – den
 * får en signert som utløper. Lese-URL-er følger med årsdokumentet, skrive-URL-er
 * utstedes av /api/media/opplasting.
 *
 * Signeringen skjer på to måter avhengig av hvordan API-et er autentisert mot
 * lagringskontoen (se lager.ts). Med kontonøkkel signeres direkte; med Managed
 * Identity må det først hentes en user delegation key, som selv er kortlevd og
 * derfor bufres.
 */
import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  type UserDelegationKey,
} from "@azure/storage-blob";
import { blobtjeneste, delteNokler } from "./lager.js";

export const LESE_MINUTTER = 60;
export const SKRIVE_MINUTTER = 15;

interface BufretNokkel {
  nokkel: UserDelegationKey;
  kontonavn: string;
  utloper: number;
}
let bufret: BufretNokkel | undefined;

async function delegeringsnokkel(): Promise<BufretNokkel> {
  const naa = Date.now();
  // Fornyes i god tid før den utløper, så en SAS aldri signeres med en nøkkel
  // som rekker å bli ugyldig mens den er i bruk.
  if (bufret && bufret.utloper - naa > 10 * 60_000) return bufret;

  const tjeneste = blobtjeneste();
  const start = new Date(naa - 5 * 60_000);
  const slutt = new Date(naa + 6 * 60 * 60_000);
  const nokkel = await tjeneste.getUserDelegationKey(start, slutt);

  bufret = {
    nokkel,
    kontonavn: tjeneste.accountName,
    utloper: slutt.getTime(),
  };
  return bufret;
}

async function signer(
  containerNavn: string,
  blobNavn: string,
  tillatelser: BlobSASPermissions,
  minutter: number
): Promise<string> {
  const utloper = new Date(Date.now() + minutter * 60_000);
  // Litt slingringsmonn bakover dekker klokkeavvik mellom Azure-tjenester.
  const starter = new Date(Date.now() - 5 * 60_000);

  const felles = {
    containerName: containerNavn,
    blobName: blobNavn,
    permissions: tillatelser,
    startsOn: starter,
    expiresOn: utloper,
  };

  const nokler = delteNokler();
  const sporring = nokler
    ? generateBlobSASQueryParameters(felles, nokler).toString()
    : await (async () => {
        const { nokkel, kontonavn } = await delegeringsnokkel();
        return generateBlobSASQueryParameters(felles, nokkel, kontonavn).toString();
      })();

  const url = blobtjeneste()
    .getContainerClient(containerNavn)
    .getBlockBlobClient(blobNavn).url;

  return `${url}?${sporring}`;
}

/** Lese-URL for én fil. `sti` er relativ til containeren. */
export function leseUrl(containerNavn: string, sti: string): Promise<string> {
  return signer(containerNavn, sti, BlobSASPermissions.from({ read: true }), LESE_MINUTTER);
}

/** Skrive-URL for én fil. Tillater opprettelse og blokkvis opplasting. */
export function skriveUrl(containerNavn: string, sti: string): Promise<string> {
  return signer(
    containerNavn,
    sti,
    BlobSASPermissions.from({ create: true, write: true }),
    SKRIVE_MINUTTER
  );
}
