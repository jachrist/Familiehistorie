import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Opptaksfil, Opptak as Opptaksrad, Scene } from "../../../delt/typer.js";
import { Apifeil, api, noekler } from "../api/klient.js";
import { formatterBytes, formatterVarighet, lesTid } from "../format.js";
import { tolkSceneliste } from "../scener.js";

/**
 * Registeret over de fulle opptakene.
 *
 * Poenget er at adressen til filmen ikke skal stå i årsteksten. Der står
 * `/api/opptak/<id>`, og den korte lenken er det eneste et familiemedlem ser.
 * Flyttes filmen, endres det her – ikke i hver årsside som nevner opptaket.
 */
export function Opptak() {
  const koe = useQueryClient();
  const tilstand = useQuery({ queryKey: noekler.opptak, queryFn: api.opptak });
  const filer = useQuery({ queryKey: noekler.opptaksfiler, queryFn: api.opptaksfiler });

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
          De fulle opptakene. Lim <code>/api/opptak/&lt;id&gt;</code> inn som lenke i
          årsteksten – ikke adressen til selve filmen. Da ser bare innloggede
          den, og den kan byttes ett sted.
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

                <Kildevelger
                  rad={rad}
                  indeks={i}
                  filer={filer.data?.filer}
                  henter={filer.isPending}
                  onEndre={(del) => endre(i, del)}
                />

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
                settRader((f) => [...f, { id: "", tittel: "", start: null, notat: "" }]);
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
            En delingslenke må peke på {tilstand.data.verter.join(" eller ")}. Skal
            den peke et annet sted, må <code>OPPTAK_VERTER</code> utvides —
            endepunktet omdirigerer fra vårt eget domene, og skal ikke kunne sende
            folk hvor som helst. Filer i lageret er ikke berørt av dette.
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
 * Hvor filmen ligger.
 *
 * To valg, ikke to felter man kan fylle begge: et opptak med både fil og
 * delingslenke lar det stå uavgjort hvilken av dem en scenelenke skal åpne, og
 * serveren avviser det. Da er det bedre at skjemaet ikke lar det oppstå.
 *
 * Fil i lageret står først fordi den er den raske: filmen kommer fra samme
 * sted som resten av nettstedet, og en scenelenke lander på tidspunktet med én
 * gang. Delingslenken går innom OneDrive, og på iPad er det noen trykk ekstra.
 */
function Kildevelger({
  rad,
  indeks,
  filer,
  henter,
  onEndre,
}: {
  rad: Opptaksrad;
  indeks: number;
  filer: Opptaksfil[] | undefined;
  henter: boolean;
  onEndre: (del: Partial<Opptaksrad>) => void;
}) {
  // En rad uten noe av delene er ny, og da er lageret riktig forslag.
  const lenke = Boolean(rad.url);

  // Fila kan ha blitt flyttet eller omdøpt i lageret etter at den ble valgt.
  // Da skal den fortsatt stå i nedtrekket – ellers ville det å åpne siden sett
  // ut som om opptaket aldri hadde en fil.
  const borte = Boolean(rad.fil) && filer !== undefined && !filer.some((f) => f.sti === rad.fil);

  return (
    <div className="opptaksfelt">
      <span className="felt-etikett">Hvor ligger opptaket</span>

      <div className="kildevalg">
        <label className="admin-valg">
          <input
            type="radio"
            name={`kilde-${indeks}`}
            checked={!lenke}
            onChange={() => onEndre({ url: undefined })}
          />{" "}
          Fil i lageret
        </label>
        <label className="admin-valg">
          <input
            type="radio"
            name={`kilde-${indeks}`}
            checked={lenke}
            onChange={() => onEndre({ fil: undefined, url: rad.url ?? "" })}
          />{" "}
          Delingslenke fra SharePoint
        </label>
      </div>

      {lenke ? (
        <>
          <label className="skjult" htmlFor={`url-${indeks}`}>
            Delingslenke
          </label>
          <input
            id={`url-${indeks}`}
            className="inndata"
            inputMode="url"
            placeholder="https://…sharepoint.com/…"
            value={rad.url ?? ""}
            onChange={(e) => onEndre({ url: e.target.value })}
          />

          <label className="admin-valg">
            <input
              type="checkbox"
              checked={rad.avspilling === "viewer"}
              onChange={(e) => onEndre({ avspilling: e.target.checked ? "viewer" : "direkte" })}
            />{" "}
            Åpne i OneDrive-spilleren
          </label>
          <p className="felt-hjelp opptak-hjelp">
            Normalt spilles fila rett i nettleseren, som starter på ett trykk.
            Kryss av her hvis formatet ikke lar seg spille av — OneDrive
            transkoder underveis, men bruker lengre tid på å komme i gang.
          </p>
        </>
      ) : (
        <>
          <label className="skjult" htmlFor={`fil-${indeks}`}>
            Fil i lageret
          </label>
          <select
            id={`fil-${indeks}`}
            className="inndata"
            value={rad.fil ?? ""}
            onChange={(e) => onEndre({ fil: e.target.value || undefined })}
          >
            <option value="">{henter ? "Henter filer …" : "— velg fil —"}</option>
            {borte && <option value={rad.fil}>{rad.fil} (ligger ikke i lageret)</option>}
            {(filer ?? []).map((f) => (
              <option key={f.sti} value={f.sti}>
                {f.sti} · {formatterBytes(f.bytes)}
              </option>
            ))}
          </select>

          {borte && (
            <p className="felt-hjelp beskjed-merk">
              Fila står i registeret, men ligger ikke i lageret lenger. Scenelenkene
              til dette opptaket virker ikke før den er lastet opp igjen – eller en
              annen fil er valgt.
            </p>
          )}

          {!henter && (filer ?? []).length === 0 && (
            <p className="felt-hjelp opptak-hjelp">
              Ingen filer i lageret ennå. De lastes opp med <code>azcopy</code> – se
              Opptak i KOM-I-GANG. Filene er for store til å gå gjennom
              nettleseren.
            </p>
          )}
        </>
      )}
    </div>
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
