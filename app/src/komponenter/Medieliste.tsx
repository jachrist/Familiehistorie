import { useState } from "react";
import type { Medieobjekt } from "../../../delt/typer.js";
import { formatterVarighet } from "../format.js";
import { Plakatvelger } from "./Plakatvelger.js";

/**
 * Bildetekstlisten.
 *
 * Kompakt med vilje: med 2 250 bilder som skal få tekst, skal man kunne skrive
 * seg nedover uten å åpne hvert bilde for seg. Rekkefølgen endres med knapper
 * i stedet for dra-og-slipp — det virker med tastatur, på berøringsskjerm, og
 * for den som har mange rader å flytte.
 */
interface Props {
  aar: number;
  media: Medieobjekt[];
  /** Kortlevde lese-URL-er, oppslag på medie-id. Nyopplastede har ingen ennå. */
  forhaandsvisning: Record<string, string | undefined>;
  /** Lese-URL til selve videofilen. Bare for lagrede videoer. */
  videourler: Record<string, string | undefined>;
  onEndret: (media: Medieobjekt[]) => void;
}

export function Medieliste({ aar, media, forhaandsvisning, videourler, onEndret }: Props) {
  const [velger, settVelger] = useState<string | null>(null);

  if (media.length === 0) return null;

  const sortert = [...media].sort((a, b) => a.rekkefolge - b.rekkefolge);

  function endre(id: string, endring: Partial<Medieobjekt>) {
    onEndret(media.map((m) => (m.id === id ? { ...m, ...endring } : m)));
  }

  function flytt(fra: number, til: number) {
    if (til < 0 || til >= sortert.length) return;
    const ny = [...sortert];
    const [post] = ny.splice(fra, 1);
    ny.splice(til, 0, post!);
    onEndret(ny.map((m, i) => ({ ...m, rekkefolge: i * 10 })));
  }

  return (
    <div className="medieliste">
      <h3>
        Media <span className="antall">{media.length}</span>
      </h3>
      <ul>
        {sortert.map((m, i) => (
          <li key={m.id} className="medie">
            <div className="medie-bilde">
              {forhaandsvisning[m.id] ? (
                <img src={forhaandsvisning[m.id]} alt="" loading="lazy" />
              ) : (
                <span className="medie-merke">{m.type === "video" ? "film" : "nytt"}</span>
              )}
              {m.type === "video" && m.varighet ? (
                <span className="medie-varighet">{formatterVarighet(m.varighet)}</span>
              ) : null}
            </div>

            <div className="medie-felter">
              <label className="skjult" htmlFor={`tekst-${m.id}`}>
                Bildetekst
              </label>
              <input
                id={`tekst-${m.id}`}
                type="text"
                placeholder="Bildetekst — hvem, hvor, hva"
                value={m.bildetekst ?? ""}
                onChange={(e) => endre(m.id, { bildetekst: e.target.value })}
              />
              <div className="medie-rad">
                <label htmlFor={`tatt-${m.id}`}>Tatt</label>
                <input
                  id={`tatt-${m.id}`}
                  type="date"
                  value={m.tatt ?? ""}
                  onChange={(e) => endre(m.id, { tatt: e.target.value || null })}
                />
                <span className="medie-sti" title={m.fil}>
                  {m.fil.split("/").pop()}
                </span>
              </div>

              {m.type === "video" && (
                <div className="medie-rad medie-plakat">
                  {!m.plakat && <span className="medie-mangler">mangler plakatbilde</span>}
                  {videourler[m.id] ? (
                    <button
                      type="button"
                      className="lenkeknapp"
                      onClick={() => settVelger(velger === m.id ? null : m.id)}
                    >
                      {velger === m.id ? "Lukk" : m.plakat ? "Bytt plakatbilde" : "Velg plakatbilde"}
                    </button>
                  ) : (
                    // URL-en kommer fra årsdokumentet, som ikke er skrevet ennå.
                    <span className="medie-mangler">lagre året for å velge plakatbilde</span>
                  )}
                </div>
              )}

              {velger === m.id && videourler[m.id] && (
                <Plakatvelger
                  aar={aar}
                  videoUrl={videourler[m.id]!}
                  onValgt={(plakat, varighet) => {
                    endre(m.id, varighet ? { plakat, varighet } : { plakat });
                    settVelger(null);
                  }}
                  onLukk={() => settVelger(null)}
                />
              )}
            </div>

            <div className="medie-knapper">
              <button type="button" onClick={() => flytt(i, i - 1)} disabled={i === 0} title="Flytt opp">
                ↑
              </button>
              <button
                type="button"
                onClick={() => flytt(i, i + 1)}
                disabled={i === sortert.length - 1}
                title="Flytt ned"
              >
                ↓
              </button>
              <button
                type="button"
                className="medie-fjern"
                onClick={() => onEndret(media.filter((x) => x.id !== m.id))}
                title="Fjern fra året"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="medieliste-hjelp">
        «Fjern» tar bildet ut av året, men sletter ikke filen. Den blir liggende til noen
        rydder, så et uhell er angrbart.
      </p>
    </div>
  );
}
