/**
 * Video i nettleseren: metadata, plakatbilde, og vurdering av om filen er
 * transkodet.
 *
 * Det siste er ikke pynt. Med ~11 timer ferdig klippet materiale er forskjellen
 * på råfiler og transkodet 1080p omtrent 2 500 GB mot 30 GB – og en opplasting
 * som tar kvelden mot en som går unna. Feilen er lett å gjøre: en fil fra
 * telefonen ser ut som en hvilken som helst annen fil, og oppdages først på
 * regningen. Derfor sjekkes bitraten før opplastingen starter, ikke etterpå.
 */
import { lerretTilBlob, MAKS_KANT } from "./bilde.js";
import { formatterBytes, formatterVarighet, tall } from "../format.js";

/**
 * Over dette regnes filen som utranskodet.
 *
 * Anbefalingen er 1080p H.264 på ~6 Mbit/s. Taket ligger litt over, så et klipp
 * med mye bevegelse ikke gir falsk alarm. Råfiler fra telefon og kamera ligger
 * rundt 50.
 */
export const ANBEFALT_MBIT = 8;

/**
 * Under disse grensene vurderes ikke bitraten.
 *
 * Korte klipp har nok faste kostnader til at bitraten blir misvisende, og en
 * liten fil er uansett ikke et lagringsproblem uansett hvor «feil» den er.
 */
const MINSTE_VARIGHET = 3;
const MINSTE_STORRELSE = 25 * 1024 * 1024;

/** Uten varighet å regne på er størrelsen alene det eneste holdepunktet. */
const MISTENKELIG_UTEN_VARIGHET = 300 * 1024 * 1024;

export interface Videometa {
  varighet: number;
  bredde: number;
  hoyde: number;
}

export interface Videovurdering {
  mistenkelig: boolean;
  /** `null` når varigheten ikke lot seg lese. */
  mbit: number | null;
  varighet: number | null;
  begrunnelse: string;
}

/** Leser lengde og oppløsning uten å laste ned mer enn nødvendig. */
export function lesVideometa(fil: Blob): Promise<Videometa | undefined> {
  return medVideoelement(fil, "metadata", async (video) => ({
    varighet: Number.isFinite(video.duration) ? video.duration : 0,
    bredde: video.videoWidth,
    hoyde: video.videoHeight,
  }));
}

export function vurderTranskoding(bytes: number, meta?: Videometa): Videovurdering {
  // Klarte ikke nettleseren å lese filen, kan den heller ikke spille den av på
  // årssiden. Det er verdt en advarsel i seg selv, uansett størrelse: en
  // .mov rett fra kameraet er ofte i et format ingen nettleser kan vise.
  if (!meta) {
    return {
      mistenkelig: true,
      mbit: null,
      varighet: null,
      begrunnelse:
        `Nettleseren klarte ikke lese denne filen (${formatterBytes(bytes)}). ` +
        `Da kan den heller ikke spilles av på årssiden, og den får ikke plakatbilde. ` +
        `Transkode den til H.264 i MP4 først.`,
    };
  }

  const varighet = meta.varighet;
  if (!varighet || varighet < MINSTE_VARIGHET) {
    const mistenkelig = bytes > MISTENKELIG_UTEN_VARIGHET;
    return {
      mistenkelig,
      mbit: null,
      varighet: varighet || null,
      begrunnelse: mistenkelig
        ? `Filen er ${formatterBytes(bytes)}, og lengden lot seg ikke lese. Er den transkodet?`
        : "",
    };
  }

  const mbit = (bytes * 8) / varighet / 1_000_000;
  const mistenkelig = bytes > MINSTE_STORRELSE && mbit > ANBEFALT_MBIT;

  return {
    mistenkelig,
    mbit,
    varighet,
    begrunnelse: mistenkelig
      ? `${formatterBytes(bytes)} på ${formatterVarighet(varighet)} er ${tall(mbit, 0)} Mbit/s. ` +
        `Transkodet 1080p ligger rundt 6. Filen er trolig ikke transkodet.`
      : "",
  };
}

/**
 * Første brukbare bilde fra en videofil, til plakatbilde.
 *
 * Ett sekund inn, ikke helt i starten: åpningsbildet er ofte svart, en
 * overgang, eller kameraet som fortsatt stiller inn.
 */
export function plakatFraVideo(
  fil: Blob,
  meta?: Videometa
): Promise<{ blob: Blob; varighet: number } | undefined> {
  // Feiler noe underveis, kommer `undefined` tilbake. Uten plakatbilde viser
  // <video> bare en tom flate, og det er ikke verdt å stoppe opplastingen for –
  // plakatbildet kan velges for hånd etterpå.
  return medVideoelement(fil, "auto", async (video) => {
    const varighet = meta?.varighet || video.duration || 0;
    await spolTil(video, Math.min(1, varighet / 2 || 0));
    return { blob: await fangFrame(video), varighet };
  });
}

/**
 * Bildet som vises akkurat nå, som JPEG.
 *
 * Krever at videoen er lastet uten å gjøre lerretet «tainted». For en fil fra
 * disken går det av seg selv; for en som ligger i Blob må elementet ha
 * `crossOrigin="anonymous"`, og lagringskontoens CORS-regler må slippe gjennom
 * `Range` – ellers kan man ikke spole i den heller.
 */
export async function fangFrame(video: HTMLVideoElement): Promise<Blob> {
  const bredde = video.videoWidth;
  const hoyde = video.videoHeight;
  if (!bredde || !hoyde) throw new Error("Videoen har ingen bildeflate å hente fra.");

  const forhold = Math.min(1, MAKS_KANT / Math.max(bredde, hoyde));
  const lerret = document.createElement("canvas");
  lerret.width = Math.round(bredde * forhold);
  lerret.height = Math.round(hoyde * forhold);

  const ctx = lerret.getContext("2d");
  if (!ctx) throw new Error("Nettleseren støtter ikke canvas.");
  ctx.drawImage(video, 0, 0, lerret.width, lerret.height);

  try {
    return await lerretTilBlob(lerret, "image/jpeg", 0.8);
  } catch {
    // SecurityError: lerretet er «tainted» fordi videoen ble lastet uten CORS.
    throw new Error(
      "Fikk ikke hentet bildet ut av videoen. Lagringskontoens CORS-regler må slippe gjennom videoen."
    );
  }
}

export function spolTil(video: HTMLVideoElement, sekunder: number): Promise<void> {
  return new Promise((loes) => {
    if (Math.abs(video.currentTime - sekunder) < 0.05) return loes();
    video.onseeked = () => loes();
    // Spoling som aldri fullfører skal ikke låse noe. Bildet blir da det som
    // allerede sto der, som er godt nok til et plakatbilde.
    setTimeout(loes, 4_000);
    video.currentTime = sekunder;
  });
}

/**
 * Lager et videoelement for en fil, venter til det er lesbart, kjører `arbeid`,
 * og rydder opp – også når noe feiler underveis.
 */
async function medVideoelement<T>(
  fil: Blob,
  preload: "metadata" | "auto",
  arbeid: (video: HTMLVideoElement) => Promise<T>
): Promise<T | undefined> {
  const url = URL.createObjectURL(fil);
  const video = document.createElement("video");
  video.preload = preload;
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  try {
    await new Promise<void>((loes, avvis) => {
      const klar = () => loes();
      if (preload === "metadata") video.onloadedmetadata = klar;
      else video.onloadeddata = klar;
      video.onerror = () => avvis(new Error("Klarte ikke lese videoen."));
      setTimeout(() => avvis(new Error("Tidsavbrudd ved lesing av video.")), 15_000);
    });
    return await arbeid(video);
  } catch {
    return undefined;
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}
