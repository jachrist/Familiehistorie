import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Medieobjekt } from "../../../delt/typer.js";
import { Apifeil, api, noekler } from "../api/klient.js";
import { Medieliste } from "../komponenter/Medieliste.js";
import { Opplastingskoe } from "../komponenter/Opplastingskoe.js";
import { RikTekst } from "../komponenter/RikTekst.js";
import { glemUtkast, lagreUtkast, lesUtkast } from "../utkast.js";

const AAR_MIN = 1500;
const AAR_MAKS = 2200;

export function RedigerAar() {
  const { aar: param } = useParams();
  const nytt = param === undefined;
  const naviger = useNavigate();
  const koe = useQueryClient();

  const [aar, settAar] = useState(() => (nytt ? new Date().getFullYear() : Number(param)));
  const [felter, settFelter] = useState<Record<string, string>>({});
  const [media, settMedia] = useState<Medieobjekt[]>([]);
  const [etag, settEtag] = useState<string>();
  const [urort, settUrort] = useState(true);
  const [gjenopprettet, settGjenopprettet] = useState(false);
  // RikTekst setter innholdet sitt én gang ved montering. Skjemaet må derfor
  // ikke rendres før feltene er fylt, ellers monteres redigeringsfeltene tomme
  // og et gjenopprettet utkast blir usynlig.
  const [klar, settKlar] = useState(false);
  const lastet = useRef(false);

  const skjema = useQuery({ queryKey: noekler.felter, queryFn: api.felter, staleTime: 5 * 60_000 });
  const dok = useQuery({
    queryKey: noekler.aar(aar),
    queryFn: () => api.aar(aar),
    enabled: !nytt,
    retry: false,
  });

  // Kortlevde lese-URL-er for media som allerede er lagret.
  const forhaandsvisning = useMemo(() => {
    const kart: Record<string, string | undefined> = {};
    for (const m of dok.data?.media ?? []) kart[m.id] = m.miniatyrUrl ?? m.plakatUrl ?? m.url;
    return kart;
  }, [dok.data]);

  // Fyll skjemaet fra serveren, eller fra et lagret utkast hvis det er nyere.
  useEffect(() => {
    if (lastet.current) return;
    if (!nytt && !dok.data) return;

    const utkast = lesUtkast(aar);
    if (dok.data) {
      const serverErNyere = utkast && utkast.etag && utkast.etag !== dok.data.etag;
      if (utkast && !serverErNyere) {
        settFelter(utkast.felter);
        settMedia(utkast.media);
        settGjenopprettet(true);
      } else {
        settFelter(dok.data.felter);
        settMedia(dok.data.media);
      }
      settEtag(dok.data.etag);
    } else if (utkast) {
      settFelter(utkast.felter);
      settMedia(utkast.media);
      settGjenopprettet(true);
    }
    lastet.current = true;
    settKlar(true);
  }, [nytt, dok.data, aar]);

  // Nye år har ingenting å hente fra serveren.
  useEffect(() => {
    if (nytt && !lastet.current) {
      const utkast = lesUtkast(aar);
      if (utkast) {
        settFelter(utkast.felter);
        settMedia(utkast.media);
        settGjenopprettet(true);
      }
      lastet.current = true;
      settKlar(true);
    }
  }, [nytt, aar]);

  // Autolagring. Hopper over første renderingen, så et tomt skjema ikke
  // overskriver et utkast før det er lest.
  useEffect(() => {
    if (urort || !lastet.current) return;
    const t = setTimeout(() => lagreUtkast(aar, { felter, media, etag }), 1500);
    return () => clearTimeout(t);
  }, [aar, felter, media, etag, urort]);

  // Advarer ved lukking av fanen med ulagrede endringer.
  useEffect(() => {
    if (urort) return;
    const paa = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", paa);
    return () => window.removeEventListener("beforeunload", paa);
  }, [urort]);

  const lagring = useMutation({
    mutationFn: () => api.lagreAar(aar, { felter, media, status: "publisert" }, etag),
    onSuccess: (svar) => {
      settEtag(svar.etag);
      settUrort(true);
      glemUtkast(aar);
      koe.setQueryData(noekler.aar(aar), svar);
      void koe.invalidateQueries({ queryKey: noekler.indeks });
      naviger(`/aar/${aar}`);
    },
  });

  const endreFelt = useCallback((id: string, verdi: string) => {
    settUrort(false);
    settFelter((f) => ({ ...f, [id]: verdi }));
  }, []);

  const endreMedia = useCallback((ny: Medieobjekt[]) => {
    settUrort(false);
    settMedia(ny);
  }, []);

  const nyeMedier = useCallback((nye: Medieobjekt[]) => {
    settUrort(false);
    settMedia((f) => [...f, ...nye]);
  }, []);

  const nesteRekkefolge = media.reduce((m, x) => Math.max(m, x.rekkefolge), 0) + 10;
  const finnes = !nytt && dok.isSuccess;
  const laster = skjema.isPending || (!nytt && dok.isPending) || !klar;

  if (laster) {
    return (
      <main className="side">
        <p className="beskjed" role="status">
          Henter …
        </p>
      </main>
    );
  }

  if (skjema.isError) {
    return (
      <main className="side">
        <div className="beskjed beskjed-feil" role="alert">
          <p>{skjema.error.message}</p>
        </div>
      </main>
    );
  }

  const ugyldigAar = !Number.isInteger(aar) || aar < AAR_MIN || aar > AAR_MAKS;

  return (
    <main className="side">
      <header className="topp topp-smal">
        <p className="stempel">
          <Link to="/">Familiehistorie</Link> · {nytt ? "Nytt år" : `Redigerer ${aar}`}
        </p>
        <h1>{nytt ? "Nytt år" : aar}</h1>
      </header>

      {gjenopprettet && (
        <div className="beskjed beskjed-merk" role="status">
          <p>
            Et lagret utkast ble hentet fram. Lagre for å beholde det, eller{" "}
            <button
              type="button"
              className="lenkeknapp"
              onClick={() => {
                glemUtkast(aar);
                settFelter(dok.data?.felter ?? {});
                settMedia(dok.data?.media ?? []);
                settGjenopprettet(false);
                settUrort(true);
                // Tvinger RikTekst til å montere på nytt med serverens innhold.
                settKlar(false);
                setTimeout(() => settKlar(true), 0);
              }}
            >
              forkast det
            </button>
            .
          </p>
        </div>
      )}

      {lagring.isError && (
        <div className="beskjed beskjed-feil" role="alert">
          <p>{lagring.error.message}</p>
          {lagring.error instanceof Apifeil && lagring.error.erKonflikt && (
            <p className="beskjed-hjelp">
              Året er endret et annet sted. Åpne det på nytt i en annen fane, se hva som
              står der, og flett inn endringene dine.
            </p>
          )}
          {lagring.error instanceof Apifeil && Array.isArray(lagring.error.detaljer) && (
            <ul className="beskjed-liste">
              {(lagring.error.detaljer as string[]).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        className="skjema"
        onSubmit={(e) => {
          e.preventDefault();
          lagring.mutate();
        }}
      >
        {nytt && (
          <div className="felt-rad">
            <label htmlFor="aarstall">Årstall</label>
            <input
              id="aarstall"
              type="number"
              min={AAR_MIN}
              max={AAR_MAKS}
              value={Number.isNaN(aar) ? "" : aar}
              onChange={(e) => {
                settAar(Number(e.target.value));
                settUrort(false);
              }}
              className="aarstall-felt"
            />
            {ugyldigAar && <span className="felt-feil">Må være mellom {AAR_MIN} og {AAR_MAKS}.</span>}
          </div>
        )}

        {skjema.data.felter.map((def) => (
          <div key={def.id} className="felt-rad">
            <label htmlFor={`felt-${def.id}`}>
              {def.etikett}
              {def.paakrevd && <span className="paakrevd" title="Må fylles ut"> *</span>}
            </label>
            {def.hjelp && <p className="felt-hjelp">{def.hjelp}</p>}
            {def.type === "rik_tekst" ? (
              <RikTekst
                id={`felt-${def.id}`}
                verdi={felter[def.id] ?? ""}
                onEndret={(html) => endreFelt(def.id, html)}
              />
            ) : (
              <input
                id={`felt-${def.id}`}
                type="text"
                maxLength={300}
                value={felter[def.id] ?? ""}
                onChange={(e) => endreFelt(def.id, e.target.value)}
              />
            )}
          </div>
        ))}

        <Opplastingskoe
          aar={aar}
          nesteRekkefolge={nesteRekkefolge}
          onFerdig={nyeMedier}
          onAarsforslag={(forslag) => {
            if (nytt && urort) settAar(forslag);
          }}
        />

        <Medieliste media={media} forhaandsvisning={forhaandsvisning} onEndret={endreMedia} />

        <div className="skjema-bunn">
          <button type="submit" className="knapp" disabled={lagring.isPending || ugyldigAar}>
            {lagring.isPending ? "Lagrer …" : finnes ? "Lagre endringer" : `Opprett ${aar}`}
          </button>
          <Link to={nytt ? "/" : `/aar/${aar}`} className="knapp-sekundaer">
            Avbryt
          </Link>
          <span className="skjema-status">
            {urort ? "Ingen ulagrede endringer" : "Ulagrede endringer — lagres lokalt underveis"}
          </span>
        </div>
      </form>
    </main>
  );
}
