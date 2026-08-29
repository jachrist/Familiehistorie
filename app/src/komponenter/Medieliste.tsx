import type { Medieobjekt } from "../../../delt/typer.js";

/**
 * Bildetekstlisten.
 *
 * Kompakt med vilje: med 2 250 bilder som skal få tekst, skal man kunne skrive
 * seg nedover uten å åpne hvert bilde for seg. Rekkefølgen endres med knapper
 * i stedet for dra-og-slipp — det virker med tastatur, på berøringsskjerm, og
 * for den som har mange rader å flytte.
 */
interface Props {
  media: Medieobjekt[];
  /** Kortlevde lese-URL-er, oppslag på medie-id. Nyopplastede har ingen ennå. */
  forhaandsvisning: Record<string, string | undefined>;
  onEndret: (media: Medieobjekt[]) => void;
}

export function Medieliste({ media, forhaandsvisning, onEndret }: Props) {
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
