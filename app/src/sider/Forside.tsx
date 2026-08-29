import { useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Indeks, Indeksrad } from "../../../delt/typer.js";
import { api } from "../api/klient.js";
import { useHent } from "../api/bruk.js";
import { AarRad } from "../komponenter/AarRad.js";
import { TiaarsGruppe } from "../komponenter/TiaarsGruppe.js";

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
  const tilstand = useHent<Indeks>(() => api.indeks());
  const { aar: aarParam } = useParams();
  const naviger = useNavigate();

  // Året som lå i URL-en ved første rendering skal rulles til syne. Åpner man
  // et år etterpå, skal siden stå i ro.
  const forsteAapne = useRef(aarParam ? Number(aarParam) : undefined);

  const apentAar = aarParam ? Number(aarParam) : undefined;

  const grupper = useMemo(
    () => (tilstand.status === "klar" ? grupperPaaTiaar(tilstand.data.aar) : []),
    [tilstand]
  );

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
        <p className="ingress">
          Ett år, én side. Velg et årstall for å folde det ut.
        </p>
      </header>

      {tilstand.status === "laster" && (
        <p className="beskjed" role="status">
          Henter årene …
        </p>
      )}

      {tilstand.status === "feil" && (
        <div className="beskjed beskjed-feil" role="alert">
          <p>{tilstand.feil.message}</p>
          {tilstand.feil.status === 503 && (
            <p className="beskjed-hjelp">
              Kjør <code>npm run seed</code> for å legge inn feltdefinisjonene.
            </p>
          )}
        </div>
      )}

      {tilstand.status === "klar" && grupper.length === 0 && (
        <div className="beskjed">
          <p>Ingen år er lagt inn ennå.</p>
          <p className="beskjed-hjelp">
            Kjør <code>npm run seed</code> for å få inn noen eksempelår, eller opprett det
            første året når redigeringen kommer i trinn 6.
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
              onVeksle={() => veksle(rad.aar)}
            />
          ))}
        </TiaarsGruppe>
      ))}

      <footer className="bunn">
        <p>
          Trinn 1–4 av fase 1. Søk kommer i trinn 8, innlogging i trinn 9.
        </p>
      </footer>
    </main>
  );
}
