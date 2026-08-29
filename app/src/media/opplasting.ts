/**
 * Opplasting av media direkte til Blob Storage.
 *
 * Filene går utenom API-et: det utsteder en kortlevd skrive-SAS, og nettleseren
 * laster opp rett til lagringskontoen. For video er det nødvendig — Functions
 * har både størrelses- og tidsbegrensninger — og for bilder gjør det
 * opplastingen merkbart raskere.
 *
 * XMLHttpRequest, ikke fetch: bare den rapporterer fremdrift under opplasting.
 */

/** Over denne grensen deles filen i blokker, så fremdriften blir jevn. */
const BLOKKGRENSE = 8 * 1024 * 1024;
const BLOKKSTORRELSE = 4 * 1024 * 1024;

export type Fremdrift = (andel: number) => void;

function sendBlob(
  url: string,
  kropp: Blob | ArrayBuffer,
  hoder: Record<string, string>,
  onFremdrift?: Fremdrift,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((loes, avvis) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    for (const [navn, verdi] of Object.entries(hoder)) xhr.setRequestHeader(navn, verdi);

    if (onFremdrift) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onFremdrift(e.loaded / e.total);
      };
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? loes()
        : avvis(new Error(`Opplasting feilet (${xhr.status}). ${xhr.responseText.slice(0, 200)}`));
    xhr.onerror = () => avvis(new Error("Nettverksfeil under opplasting."));
    xhr.onabort = () => avvis(new DOMException("Avbrutt", "AbortError"));

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(kropp);
  });
}

/** Blokk-ID-er må være like lange og base64-kodet. */
function blokkId(nummer: number): string {
  return btoa(String(nummer).padStart(6, "0"));
}

export async function lastOpp(
  sasUrl: string,
  fil: Blob,
  onFremdrift?: Fremdrift,
  signal?: AbortSignal
): Promise<void> {
  const type = fil.type || "application/octet-stream";

  if (fil.size <= BLOKKGRENSE) {
    await sendBlob(
      sasUrl,
      fil,
      { "x-ms-blob-type": "BlockBlob", "content-type": type },
      onFremdrift,
      signal
    );
    return;
  }

  // Blokkvis: hver blokk lastes opp for seg, og settes sammen til slutt.
  const antall = Math.ceil(fil.size / BLOKKSTORRELSE);
  const ider: string[] = [];
  let ferdigBytes = 0;

  for (let i = 0; i < antall; i++) {
    if (signal?.aborted) throw new DOMException("Avbrutt", "AbortError");
    const start = i * BLOKKSTORRELSE;
    const bit = fil.slice(start, Math.min(start + BLOKKSTORRELSE, fil.size));
    const id = blokkId(i);
    ider.push(id);

    await sendBlob(
      `${sasUrl}&comp=block&blockid=${encodeURIComponent(id)}`,
      bit,
      { "content-type": type },
      (andel) => onFremdrift?.((ferdigBytes + andel * bit.size) / fil.size),
      signal
    );
    ferdigBytes += bit.size;
  }

  const liste =
    `<?xml version="1.0" encoding="utf-8"?><BlockList>` +
    ider.map((id) => `<Latest>${id}</Latest>`).join("") +
    `</BlockList>`;

  await sendBlob(
    `${sasUrl}&comp=blocklist`,
    new Blob([liste], { type: "application/xml" }),
    { "x-ms-blob-content-type": type },
    undefined,
    signal
  );
  onFremdrift?.(1);
}

/** Kjører oppgaver med et tak på hvor mange som går samtidig. */
export async function iParallell<T>(
  oppgaver: (() => Promise<T>)[],
  samtidig = 3
): Promise<PromiseSettledResult<T>[]> {
  const resultater: PromiseSettledResult<T>[] = new Array(oppgaver.length);
  let neste = 0;

  async function arbeider() {
    while (neste < oppgaver.length) {
      const i = neste++;
      try {
        resultater[i] = { status: "fulfilled", value: await oppgaver[i]!() };
      } catch (e) {
        resultater[i] = { status: "rejected", reason: e };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(samtidig, oppgaver.length) }, arbeider));
  return resultater;
}
