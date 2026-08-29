import { useEffect, useRef } from "react";
import type { Indeksrad } from "../../../delt/typer.js";

interface Props {
  rad: Indeksrad;
  apen: boolean;
  /** Sant når året ble åpnet via URL ved innlasting – da rulles det til syne. */
  rullTil: boolean;
  onVeksle: () => void;
}

function medietekst(rad: Indeksrad): string {
  const deler: string[] = [];
  if (rad.antallBilder > 0) {
    deler.push(rad.antallBilder === 1 ? "1 bilde" : `${rad.antallBilder} bilder`);
  }
  if (rad.antallVideoer > 0) {
    deler.push(rad.antallVideoer === 1 ? "1 film" : `${rad.antallVideoer} filmer`);
  }
  return deler.join(" · ");
}

export function AarRad({ rad, apen, rullTil, onVeksle }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rullTil) return;
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [rullTil]);

  const panelId = `aar-${rad.aar}-panel`;
  const knappId = `aar-${rad.aar}-knapp`;

  return (
    <div className="aar" ref={ref} data-apen={apen || undefined}>
      <button
        type="button"
        className="aar-hode"
        id={knappId}
        aria-expanded={apen}
        aria-controls={panelId}
        onClick={onVeksle}
      >
        <span className="aar-tall">{rad.aar}</span>
        <span className="aar-tittel">{rad.tittel || <em>Uten overskrift</em>}</span>
        <span className="aar-media">{medietekst(rad)}</span>
      </button>

      <div id={panelId} role="region" aria-labelledby={knappId} hidden={!apen} className="aar-panel">
        {rad.sammendrag ? (
          <p className="aar-sammendrag">{rad.sammendrag}</p>
        ) : (
          <p className="aar-tom">Dette året har ingen ingress ennå.</p>
        )}
        <p className="aar-merknad">
          Tekstfeltene og mediegalleriet kommer i trinn 5. Forsiden viser inntil videre det
          indeksdokumentet inneholder.
        </p>
      </div>
    </div>
  );
}
