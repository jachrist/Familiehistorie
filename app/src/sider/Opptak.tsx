import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Opptak as Opptaksrad } from "../../../delt/typer.js";
import { Apifeil, api, noekler } from "../api/klient.js";
import { formatterVarighet, lesTid } from "../format.js";

/**
 * Registeret over opptak som ligger i SharePoint.
 *
 * Poenget er at delingslenken ikke skal stå i årsteksten. Der står
 * `/api/opptak/<id>`, og den korte lenken er det eneste et familiemedlem ser.
 * Byttes delingslenken, endres den her – ikke i hver årsside som nevner
 * opptaket.
 */
export function Opptak() {
  const koe = useQueryClient();
  const tilstand = useQuery({ queryKey: noekler.opptak, queryFn: api.opptak });

  const [rader, settRader] = useState<Opptaksrad[]>([]);
  const [etag, settEtag] = useState("");
  const [endret, settEndret] = useState(false);
  const [kopiert, settKopiert] = useState<string>();

  // Samme vakt som på tilgangslisten: serveren er fasit til noe er endret her.
  useEffect(() => {
    if (!tilstand.data || endret) return;
    settRader(tilstand.data.opptak);
    settEtag(tilstand.data.etag);
  }, [tilstand.data, endret]);

  const lagre = useMutation({
    mutationFn: () => api.lagreOpptak(rader, etag),
    onSuccess: (svar) => {
      settRader(svar.opptak);
      settEtag(svar.etag);
      settEndret(false);
      koe.invalidateQueries({ queryKey: noekler.opptak });
    },
  });

  function endre(i: number, del: Partial<Opptaksrad>) {
    settEndret(true);
    settRader((f) => f.map((o, j) => (i === j ? { ...o, ...del } : o)));
  }

  /** «Bryllupet i Vang kirke» → `bryllupet-i-vang-kirke`. */
  function tilId(tittel: string): string {
    return tittel
      .toLowerCase()
      .replace(/æ/g, "ae")
      .replace(/ø/g, "oe")
      .replace(/å/g, "aa")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
  }

  function endreTittel(i: number, tittel: string) {
    const rad = rader[i];
    if (!rad) return;
    // Id-en følger tittelen så lenge ingen har skrevet noe eget i den. Er den
    // først endret for hånd, står den – den kan alt være limt inn i en årstekst.
    const folger = !rad.id || rad.id === tilId(rad.tittel);
    endre(i, folger ? { tittel, id: tilId(tittel) } : { tittel });
  }

  async function kopier(id: string) {
    const lenke = `/api/opptak/${id}`;
    try {
      await navigator.clipboard.writeText(lenke);
      settKopiert(id);
      setTimeout(() => settKopiert(undefined), 2000);
    } catch {
      settKopiert(undefined);
    }
  }

  return (
    <main className="side">
      <header className="topp">
        <p className="stempel">
          <Link to="/admin" className="knapp-lenke">
            ← Til admin
          </Link>
        </p>
        <h1>Opptak</h1>
        <p className="ingress">
          Fulle opptak som ligger i SharePoint. Lim <code>/api/opptak/&lt;id&gt;</code>{" "}
          inn som lenke i årsteksten – ikke selve delingslenken. Da ser bare
          innloggede den, og den kan byttes ett sted.
        </p>
      </header>

      {tilstand.isPending && (
        <p className="beskjed" role="status">
          Henter registeret …
        </p>
      )}

      {tilstand.isError && (
        <div className="beskjed beskjed-feil" role="alert">
          <p>{tilstand.error.message}</p>
        </div>
      )}

      {tilstand.isSuccess && (
        <>
          {rader.length === 0 && (
            <p className="beskjed">
              Ingen opptak ennå. Legg til det første, så får du en lenke å lime inn.
            </p>
          )}

          <ul className="opptaksliste">
            {rader.map((rad, i) => (
              <li key={i} className="opptaksrad kort">
                <div className="opptaksfelt">
                  <label className="felt-etikett" htmlFor={`tittel-${i}`}>
                    Tittel
                  </label>
                  <input
                    id={`tittel-${i}`}
                    className="inndata"
                    value={rad.tittel}
                    onChange={(e) => endreTittel(i, e.target.value)}
                  />
                </div>

                <div className="opptaksfelt">
                  <label className="felt-etikett" htmlFor={`url-${i}`}>
                    Delingslenke fra SharePoint
                  </label>
                  <input
                    id={`url-${i}`}
                    className="inndata"
                    inputMode="url"
                    placeholder="https://…sharepoint.com/…"
                    value={rad.url}
                    onChange={(e) => endre(i, { url: e.target.value })}
                  />
                </div>

                <div className="opptaksrad-to">
                  <div className="opptaksfelt">
                    <label className="felt-etikett" htmlFor={`id-${i}`}>
                      Id
                    </label>
                    <input
                      id={`id-${i}`}
                      className="inndata"
                      value={rad.id}
                      onChange={(e) => endre(i, { id: e.target.value })}
                    />
                  </div>

                  <div className="opptaksfelt">
                    <label className="felt-etikett" htmlFor={`start-${i}`}>
                      Start ved (valgfritt)
                    </label>
                    <input
                      id={`start-${i}`}
                      className="inndata"
                      inputMode="numeric"
                      placeholder="1:23"
                      defaultValue={rad.start ? formatterVarighet(rad.start) : ""}
                      onBlur={(e) => endre(i, { start: lesTid(e.target.value) ?? null })}
                    />
                  </div>
                </div>

                <div className="opptaksfelt">
                  <label className="felt-etikett" htmlFor={`notat-${i}`}>
                    Notat (vises ingen andre steder)
                  </label>
                  <input
                    id={`notat-${i}`}
                    className="inndata"
                    value={rad.notat ?? ""}
                    onChange={(e) => endre(i, { notat: e.target.value })}
                  />
                </div>

                <div className="opptaksrad-bunn">
                  {rad.id ? (
                    <button type="button" className="lenkeknapp" onClick={() => void kopier(rad.id)}>
                      <code>/api/opptak/{rad.id}</code>
                      {kopiert === rad.id ? " — kopiert" : " — kopier"}
                    </button>
                  ) : (
                    <span className="opptak-mangler">gi opptaket en tittel, så lages id-en</span>
                  )}

                  <button
                    type="button"
                    className="knapp-sekundaer"
                    onClick={() => {
                      settEndret(true);
                      settRader((f) => f.filter((_, j) => j !== i));
                    }}
                  >
                    Fjern
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="tilgang-handlinger">
            <button
              type="button"
              className="knapp-sekundaer"
              onClick={() => {
                settEndret(true);
                settRader((f) => [...f, { id: "", tittel: "", url: "", start: null, notat: "" }]);
              }}
            >
              Legg til opptak
            </button>

            <button
              type="button"
              className="knapp"
              disabled={!endret || lagre.isPending}
              onClick={() => lagre.mutate()}
            >
              {lagre.isPending ? "Lagrer …" : "Lagre registeret"}
            </button>
          </div>

          <p className="beskjed-liten">
            Lenken må peke på {tilstand.data.verter.join(" eller ")}. Skal den peke et
            annet sted, må <code>OPPTAK_VERTER</code> utvides — endepunktet
            omdirigerer fra vårt eget domene, og skal ikke kunne sende folk hvor
            som helst.
          </p>

          {lagre.isError && (
            <div className="beskjed beskjed-feil" role="alert">
              <p>{lagre.error.message}</p>
              {lagre.error instanceof Apifeil && Array.isArray(lagre.error.detaljer) && (
                <ul className="beskjed-hjelp">
                  {(lagre.error.detaljer as string[]).map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {lagre.isSuccess && !endret && (
            <p className="beskjed" role="status">
              Registeret er lagret.
            </p>
          )}
        </>
      )}
    </main>
  );
}
