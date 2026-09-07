/**
 * Bildebehandling i nettleseren.
 *
 * Nedskalering før opplasting er ikke bare en optimalisering: et album på 2 250
 * bilder er forskjellen på 1,5 GB og 11 GB, og på en opplasting som går unna og
 * en som tar kvelden. Miniatyren lages i samme slengen, så galleriet slipper å
 * laste fullformat.
 */
export const MAKS_KANT = 2400;
export const MINIATYR_KANT = 400;

export interface Behandletbilde {
  web: Blob;
  miniatyr: Blob;
  bredde: number;
  hoyde: number;
  /** MIME-type for de behandlede filene. Kan avvike fra originalens. */
  type: string;
}

async function tegn(fil: File): Promise<ImageBitmap> {
  // createImageBitmap tar hensyn til EXIF-orientering, slik at bilder tatt på
  // høykant ikke blir liggende.
  return createImageBitmap(fil, { imageOrientation: "from-image" });
}

function skaler(kilde: ImageBitmap, maksKant: number) {
  const forhold = Math.min(1, maksKant / Math.max(kilde.width, kilde.height));
  return {
    bredde: Math.round(kilde.width * forhold),
    hoyde: Math.round(kilde.height * forhold),
  };
}

export function lerretTilBlob(
  lerret: HTMLCanvasElement,
  type: string,
  kvalitet: number
): Promise<Blob> {
  return new Promise((loes, avvis) => {
    lerret.toBlob(
      (b) => (b ? loes(b) : avvis(new Error("Klarte ikke komprimere bildet."))),
      type,
      kvalitet
    );
  });
}

async function render(kilde: ImageBitmap, maksKant: number, type: string, kvalitet: number) {
  const { bredde, hoyde } = skaler(kilde, maksKant);
  const lerret = document.createElement("canvas");
  lerret.width = bredde;
  lerret.height = hoyde;
  const ctx = lerret.getContext("2d");
  if (!ctx) throw new Error("Nettleseren støtter ikke canvas.");
  ctx.drawImage(kilde, 0, 0, bredde, hoyde);
  return { blob: await lerretTilBlob(lerret, type, kvalitet), bredde, hoyde };
}

/** Nettleserstøtte for WebP varierer; JPEG er tryggere som fallback. */
function velgType(): string {
  const lerret = document.createElement("canvas");
  lerret.width = lerret.height = 1;
  return lerret.toDataURL("image/webp").startsWith("data:image/webp")
    ? "image/webp"
    : "image/jpeg";
}

export async function behandleBilde(fil: File): Promise<Behandletbilde> {
  const kilde = await tegn(fil);
  try {
    const type = velgType();
    const web = await render(kilde, MAKS_KANT, type, 0.82);
    const miniatyr = await render(kilde, MINIATYR_KANT, type, 0.75);
    return {
      web: web.blob,
      miniatyr: miniatyr.blob,
      bredde: web.bredde,
      hoyde: web.hoyde,
      type,
    };
  } finally {
    kilde.close();
  }
}
