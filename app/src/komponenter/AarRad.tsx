import { useEffect, useRef } from "react";
import type { Indeksrad } from "../../../delt/typer.js";
import { type Bit, marker, utdrag } from "../sok/soek.js";
import { Aarsinnhold } from "./Aarsinnhold.js";
import { Uthevet } from "./Sokefelt.js";

interface Props {
  rad: Indeksrad;
  apen: boolean;
  /** Sant når året ble åpnet via URL ved innlasting – da rulles det til syne. */
  rullTil: boolean;
  /** Ordene som traff i søket. Tom liste når det ikke søkes. */
  trefford: string[];
  onVeksle: () => void;
}

/** Søketeksten uten «1972 · Flyttingen til Bergen · », som raden viser selv. */
function utenInnledning(rad: Indeksrad): string {
  const innledning = `${rad.aar} · ${rad.tittel} · `;
  return rad.sok.startsWith(innledning) ? rad.sok.slice(innledning.length) : rad.sok;
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

export function AarRad({ rad, apen, rullTil, trefford, onVeksle }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rullTil) return;
    ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [rullTil]);

  const panelId = `aar-${rad.aar}-panel`;
  const knappId = `aar-${rad.aar}-knapp`;
  const soker = trefford.length > 0;

  // Ved søk vises et utdrag rundt treffet i stedet for ingressen, slik at man
  // ser hvorfor året kom med. Traff bare tittelen, holder ingressen.
  //
  // Årstall og tittel står allerede i raden over, og innleder også søketeksten.
  // De klippes bort, ellers gjentar utdraget det man nettopp har lest.
  const bit: Bit[] | undefined = soker
    ? (utdrag(utenInnledning(rad), trefford) ??
      (rad.sammendrag ? marker(rad.sammendrag, trefford) : undefined))
    : undefined;

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
        <span className="aar-tittel">
          {rad.tittel ? (
            soker ? <Uthevet biter={marker(rad.tittel, trefford)} /> : rad.tittel
          ) : (
            <em>Uten overskrift</em>
          )}
        </span>
        <span className="aar-media">{medietekst(rad)}</span>
      </button>

      {/* Utdraget vises uten at raden må åpnes – poenget er å se treffet. */}
      {soker && !apen && bit && (
        <p className="aar-utdrag">
          <Uthevet biter={bit} />
        </p>
      )}

      <div id={panelId} role="region" aria-labelledby={knappId} hidden={!apen} className="aar-panel">
        {rad.sammendrag && <p className="aar-sammendrag">{rad.sammendrag}</p>}
        {/* Årsdokumentet hentes først når raden faktisk åpnes. */}
        {apen && <Aarsinnhold aar={rad.aar} />}
      </div>
    </div>
  );
}
