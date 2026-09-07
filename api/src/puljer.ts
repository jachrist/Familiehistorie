/**
 * Kjører mange småoppgaver mot lagringskontoen uten å slippe alle løs samtidig.
 *
 * `Promise.all` over noen hundre sletteoperasjoner åpner noen hundre
 * forbindelser. Det gjør ikke jobben raskere – lagringskontoen strupes – og en
 * feil midt i blir vanskeligere å lese fordi alt annet fortsatt er i gang.
 */
export async function iPuljer<T, R>(
  elementer: readonly T[],
  bredde: number,
  arbeid: (element: T) => Promise<R>
): Promise<R[]> {
  const svar = new Array<R>(elementer.length);
  let neste = 0;

  const arbeidere = Array.from(
    { length: Math.max(1, Math.min(bredde, elementer.length)) },
    async () => {
      for (let i = neste++; i < elementer.length; i = neste++) {
        svar[i] = await arbeid(elementer[i]!);
      }
    }
  );

  await Promise.all(arbeidere);
  return svar;
}
