import { useRef, useState } from "react";
import { api } from "../api/klient.js";
import { lastOpp } from "../media/opplasting.js";
import { fangFrame } from "../media/video.js";
import { formatterVarighet } from "../format.js";

/**
 * Plakatbildet velges for hånd.
 *
 * Automatikken tar bildet ett sekund inn i klippet, som stemmer overraskende
 * ofte og feiler stygt når det ikke gjør det – en overgang, et svart bilde,
 * eller kameraet som fortsatt stiller inn. Da er det bedre å kunne spole til et
 * bilde som viser hva klippet handler om, enn å måtte transkode på nytt.
 *
 * Bildet hentes fra videoen slik den ligger i Blob. Det krever at elementet
 * lastes med `crossOrigin`, ellers blir lerretet «tainted» og bildet kan ikke
 * hentes ut – og at CORS-reglene slipper gjennom `Range`, som spolingen uansett
 * er avhengig av.
 */
interface Props {
  aar: number;
  videoUrl: string;
  onValgt: (plakat: string, varighet: number | null) => void;
  onLukk: () => void;
}

export function Plakatvelger({ aar, videoUrl, onValgt, onLukk }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [jobber, settJobber] = useState(false);
  const [feil, settFeil] = useState<string>();
  const [varighet, settVarighet] = useState<number | null>(null);

  async function bruk() {
    const element = video.current;
    if (!element) return;

    settJobber(true);
    settFeil(undefined);
    try {
      const blob = await fangFrame(element);
      const { maal } = await api.opplastingsmaal({
        aar,
        filer: [{ filnavn: "plakat.jpg", type: "image/jpeg" }],
      });
      const mal = maal[0];
      if (!mal) throw new Error("Fikk ingen opplastingsadresse.");

      await lastOpp(mal.opplastingsUrl, blob);
      onValgt(mal.fil, varighet);
    } catch (e) {
      settFeil(e instanceof Error ? e.message : "Klarte ikke lagre plakatbildet.");
    } finally {
      settJobber(false);
    }
  }

  return (
    <div className="plakatvelger">
      <p className="plakatvelger-hjelp">
        Spol til bildet du vil bruke, og trykk «Bruk dette bildet». Det som vises
        akkurat nå, blir plakatbildet.
      </p>

      <video
        ref={video}
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          settVarighet(Number.isFinite(d) ? d : null);
        }}
        onError={() =>
          settFeil("Klarte ikke laste videoen. Er CORS-reglene på lagringskontoen satt?")
        }
      />

      {feil && (
        <p className="beskjed-liten beskjed-feil" role="alert">
          {feil}
        </p>
      )}

      <div className="plakatvelger-knapper">
        <button type="button" className="knapp" disabled={jobber} onClick={() => void bruk()}>
          {jobber ? "Lagrer …" : "Bruk dette bildet"}
        </button>
        <button type="button" className="knapp-sekundaer" disabled={jobber} onClick={onLukk}>
          Avbryt
        </button>
        {varighet !== null && (
          <span className="plakatvelger-tid">{formatterVarighet(varighet)}</span>
        )}
      </div>
    </div>
  );
}
