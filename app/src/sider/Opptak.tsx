import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Opptak as Opptaksrad, Scene } from "../../../delt/typer.js";
import { Apifeil, api, noekler } from "../api/klient.js";
import { formatterVarighet, lesTid } from "../format.js";
import { tolkSceneliste } from "../scener.js";

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

                <Scenefelt
                  rad={rad}
                  onScener={(scener, tittel) =>
                    endre(i, rad.tittel.trim() ? { scener } : { scener, tittel, id: tilId(tittel) })
                  }
                />

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

/**
 * Scenelisten limes inn slik den ble skrevet.
 *
 * Listene blir til mens man spoler gjennom filmen og noterer for hånd, så
 * tidspunktene er rotete – `0 0 1 45` og `0.0.8.45` betyr 1:45 og 8:45. Det er
 * tolkerens jobb å forstå dem, ikke brukerens jobb å rette dem opp.
 *
 * Derfor vises resultatet før noe lagres: tolkningen er kvalifisert gjetning,
 * og den som skrev listen er den eneste som kan se om den traff.
 */
function Scenefelt({
  rad,
  onScener,
}: {
  rad: Opptaksrad;
  onScener: (scener: Scene[], tittel: string) => void;
}) {
  const [apen, settApen] = useState(false);
  const [raa, settRaa] = useState("");

  const tolkning = useMemo(() => (raa.trim() ? tolkSceneliste(raa) : undefined), [raa]);
  const antall = rad.scener?.length ?? 0;

  return (
    <div className="scenefelt">
      <div className="scenefelt-topp">
        {antall > 0 ? (
          <span>
            {antall} {antall === 1 ? "scene" : "scener"}
            {aarsspenn(rad.scener)}
          </span>
        ) : (
          <span className="opptak-mangler">ingen sceneliste</span>
        )}
        <button type="button" className="lenkeknapp" onClick={() => settApen((a) => !a)}>
          {apen ? "Lukk" : antall > 0 ? "Lim inn på nytt" : "Lim inn sceneliste"}
        </button>
      </div>

      {apen && (
        <div className="scenefelt-panel">
          <p className="plakatvelger-hjelp">
            Lim inn listen slik du skrev den. Tid først på linja, så beskrivelsen.
            En linje med bare et årstall skiller årene, og «Video: …» blir tittel.
          </p>
          <label className="skjult" htmlFor={`scener-${rad.id || "ny"}`}>
            Sceneliste
          </label>
          <textarea
            id={`scener-${rad.id || "ny"}`}
            className="inndata scenefelt-tekst"
            rows={8}
            placeholder={"Video: 1987 Jul, Nyttår, Bad\n1987\n0.00.00 Med jentene i badekaret\n0.12.44 Julemiddag hos mormor og beste"}
            value={raa}
            onChange={(e) => settRaa(e.target.value)}
          />

          {tolkning && (
            <>
              <p className="beskjed-liten">
                {tolkning.scener.length} scener tolket
                {tolkning.avviste.length > 0 && `, ${tolkning.avviste.length} linjer forstod jeg ikke`}
                {tolkning.tittel && ` · tittel: «${tolkning.tittel}»`}
              </p>

              {tolkning.uordnede.length > 0 && (
                <p className="beskjed-liten beskjed-merk">
                  {tolkning.uordnede.length} scener kommer før den forrige i tid. Som
                  regel er det en feillesing — se gjennom listen under.
                </p>
              )}

              {tolkning.avviste.length > 0 && (
                <ul className="beskjed-liten beskjed-feil scenefelt-avviste">
                  {tolkning.avviste.map((a) => (
                    <li key={a.linje}>
                      Linje {a.linje}: {a.grunn} <code>{a.tekst.slice(0, 60)}</code>
                    </li>
                  ))}
                </ul>
              )}

              {tolkning.scener.length > 0 && (
                <>
                  <ul className="sceneforhaand">
                    {tolkning.scener.map((s, j) => (
                      <li key={j}>
                        {s.aar && <span className="sceneforhaand-aar">{s.aar}</span>}
                        <span className="sceneforhaand-tid">{formatterVarighet(s.start)}</span>
                        <span>{s.tittel}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="admin-handlinger">
                    <button
                      type="button"
                      className="knapp"
                      onClick={() => {
                        onScener(tolkning.scener, tolkning.tittel ?? rad.tittel);
                        settRaa("");
                        settApen(false);
                      }}
                    >
                      Bruk disse {tolkning.scener.length} scenene
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** ` · 1987–1988` når listen dekker flere år. Tom når den ikke gjør det. */
function aarsspenn(scener: Scene[] | undefined): string {
  const aar = [...new Set((scener ?? []).flatMap((s) => (s.aar ? [s.aar] : [])))].sort();
  if (aar.length === 0) return "";
  return aar.length === 1 ? ` · ${aar[0]}` : ` · ${aar[0]}–${aar.at(-1)}`;
}
