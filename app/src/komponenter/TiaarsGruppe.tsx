import type { ReactNode } from "react";

interface Props {
  tiaar: number;
  antall: number;
  children: ReactNode;
}

/**
 * Rundt 90 årssider er for mange for en flat liste. Tiårsgrupperingen gjør
 * listen skannbar, og lar de tynne årene før 1950 lese som en bevisst glissen
 * periode i stedet for som hull.
 */
export function TiaarsGruppe({ tiaar, antall, children }: Props) {
  return (
    <section className="tiaar" aria-labelledby={`tiaar-${tiaar}`}>
      <h2 className="tiaar-hode" id={`tiaar-${tiaar}`}>
        <span>{tiaar}-årene</span>
        <span className="tiaar-strek" aria-hidden="true" />
        <span className="tiaar-antall">{antall === 1 ? "1 år" : `${antall} år`}</span>
      </h2>
      <div className="tiaar-liste">{children}</div>
    </section>
  );
}
