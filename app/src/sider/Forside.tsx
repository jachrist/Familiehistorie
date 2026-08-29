import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Indeksrad } from "../../../delt/typer.js";
import { Apifeil, api, noekler } from "../api/klient.js";
import { AarRad } from "../komponenter/AarRad.js";
import { Sokefelt } from "../komponenter/Sokefelt.js";
import { TiaarsGruppe } from "../komponenter/TiaarsGruppe.js";
import { byggSokeindeks, sok } from "../sok/soek.js";

interface Gruppe {
  tiaar: number;
  rader: Indeksrad[];
}

function grupperPaaTiaar(rader: Indeksrad[]): Gruppe[] {
  const grupper = new Map<number, Indeksrad[]>();
  for (const rad of [...rader].sort((a, b) => b.aar - a.aar)) {
    const tiaar = Math.floor(rad.aar / 10) * 10;
    const liste = grupper.get(tiaar);
    if (liste) liste.push(rad);
    else grupper.set(tiaar, [rad]);
  }
  return [...grupper.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([tiaar, rader]) => ({ tiaar, rader }));
}

export function Forside() {
  const tilstand = useQuery({ queryKey: noekler.indeks, queryFn: api.indeks });
  const [spoersmaal, settSpoersmaal] = useState("");
  // Feltet skal svare umiddelbart selv om filtreringen ligger et hakk bak.
  const utsatt = useDeferredValue(spoersmaal);
  const { aar: aarParam } = useParams();
  const naviger = useNavigate();

  // Året som lå i URL-en ved første rendering skal rulles til syne. Åpner man
  // et år etterpå, skal siden stå i ro.
  const forsteAapne = useRef(aarParam ? Number(aarParam) : undefined);

  const apentAar = aarParam ? Number(aarParam) : undefined;

  const alle = tilstand.data?.aar;

  // Søkeindeksen bygges én gang per indeksdokument, ikke per tastetrykk.
  const sokeindeks = useMemo(() => (alle ? byggSokeindeks(alle) : undefined), [alle]);

  const treff = useMemo(
    () => (sokeindeks && utsatt.trim() !== "" ? sok(sokeindeks, utsatt) : undefined),
    [sokeindeks, utsatt]
  );

  /** Årstall til ordene som traff. `undefined` når det ikke søkes. */
  const treffkart = useMemo(() => {
    if (!treff) return undefined;
    return new Map(treff.map((t) => [t.aar, t.ord]));
  }, [treff]);

  const grupper = useMemo(() => {
    if (!alle) return [];
    const synlige = treffkart ? alle.filter((r) => treffkart.has(r.aar)) : alle;
    return grupperPaaTiaar(synlige);
  }, [alle, treffkart]);

  const sokestatus = !alle
    ? ""
    : treffkart
      ? `${treffkart.size} av ${alle.length} år`
      : `${alle.length} år`;

  function veksle(aar: number) {
    // Utfoldingen bytter ikke side, men oppdaterer URL-en, slik at
    // tilbakeknappen og deling virker som forventet.
    naviger(apentAar === aar ? "/" : `/aar/${aar}`);
  }

  return (
    <main className="side">
      <header className="topp">
        <p className="stempel">Familien Christiansen</p>
        <h1>Familiehistorie</h1>
        <div className="topp-rad">
          <p className="ingress">Ett år, én side. Velg et årstall for å folde det ut.</p>
          <Link to="/rediger/nytt" className="knapp">
            Nytt år
          </Link>
        </div>
      </header>

      {tilstand.isSuccess && (alle?.length ?? 0) > 0 && (
        <Sokefelt verdi={spoersmaal} onEndret={settSpoersmaal} status={sokestatus} />
      )}

      {tilstand.isPending && (
        <p className="beskjed" role="status">
          Henter årene …
        </p>
      )}

      {tilstand.isError && (
        <div className="beskjed beskjed-feil" role="alert">
          <p>{tilstand.error.message}</p>
          {tilstand.error instanceof Apifeil && tilstand.error.status === 503 && (
            <p className="beskjed-hjelp">
              Kjør <code>npm run seed</code> for å legge inn feltdefinisjonene.
            </p>
          )}
        </div>
      )}

      {tilstand.isSuccess && grupper.length === 0 && treffkart && (
        <div className="beskjed">
          <p>Ingen år nevner «{spoersmaal.trim()}».</p>
          <p className="beskjed-hjelp">
            Søket dekker alle tekstfelter og bildetekster. Prøv færre eller kortere ord.
          </p>
        </div>
      )}

      {tilstand.isSuccess && grupper.length === 0 && !treffkart && (
        <div className="beskjed">
          <p>Ingen år er lagt inn ennå.</p>
          <p className="beskjed-hjelp">
            Kjør <code>npm run seed</code> for eksempelår, eller{" "}
            <Link to="/rediger/nytt">opprett det første året</Link>.
          </p>
        </div>
      )}

      {grupper.map((gruppe) => (
        <TiaarsGruppe key={gruppe.tiaar} tiaar={gruppe.tiaar} antall={gruppe.rader.length}>
          {gruppe.rader.map((rad) => (
            <AarRad
              key={rad.aar}
              rad={rad}
              apen={apentAar === rad.aar}
              rullTil={forsteAapne.current === rad.aar}
              trefford={treffkart?.get(rad.aar) ?? []}
              onVeksle={() => veksle(rad.aar)}
            />
          ))}
        </TiaarsGruppe>
      ))}

      <footer className="bunn">
        <p>Trinn 1–8 av fase 1. Innlogging kommer i trinn 9.</p>
      </footer>
    </main>
  );
}
