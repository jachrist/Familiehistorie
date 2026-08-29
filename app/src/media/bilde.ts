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

function tilBlob(lerret: HTMLCanvasElement, type: string, kvalitet: number): Promise<Blob> {
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
  return { blob: await tilBlob(lerret, type, kvalitet), bredde, hoyde };
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

/** Første brukbare bilde fra en videofil, til plakatbilde. */
export async function plakatFraVideo(fil: File): Promise<{ blob: Blob; varighet: number } | undefined> {
  const url = URL.createObjectURL(fil);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = url;

  try {
    await new Promise<void>((loes, avvis) => {
      video.onloadeddata = () => loes();
      video.onerror = () => avvis(new Error("Klarte ikke lese videoen."));
      setTimeout(() => avvis(new Error("Tidsavbrudd ved lesing av video.")), 15_000);
    });

    // Ett sekund inn: første bilde er ofte svart.
    video.currentTime = Math.min(1, (video.duration || 2) / 2);
    await new Promise<void>((loes) => {
      video.onseeked = () => loes();
      setTimeout(loes, 4_000);
    });

    const lerret = document.createElement("canvas");
    const forhold = Math.min(1, MAKS_KANT / Math.max(video.videoWidth, video.videoHeight));
    lerret.width = Math.round(video.videoWidth * forhold);
    lerret.height = Math.round(video.videoHeight * forhold);
    const ctx = lerret.getContext("2d");
    if (!ctx || lerret.width === 0) return undefined;
    ctx.drawImage(video, 0, 0, lerret.width, lerret.height);

    return { blob: await tilBlob(lerret, "image/jpeg", 0.8), varighet: video.duration || 0 };
  } catch {
    // Uten plakatbilde viser <video> bare en tom flate. Ikke verdt å stoppe
    // opplastingen for.
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}
