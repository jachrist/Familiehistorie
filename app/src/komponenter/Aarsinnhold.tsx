import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { Feltskjema } from "../../../delt/typer.js";
import { api, noekler } from "../api/klient.js";
import { Mediegalleri } from "./Mediegalleri.js";

/**
 * Hele innholdet for ett år: tekstfeltene i skjemaets rekkefølge, og
 * mediegalleriet.
 *
 * Feltene kommer fra felter.json, ikke fra kode. Legges et felt til der, dukker
 * det opp her uten at noe må endres.
 */
export function Aarsinnhold({ aar }: { aar: number }) {
  const skjema = useQuery({ queryKey: noekler.felter, queryFn: api.felter, staleTime: 5 * 60_000 });
  const dok = useQuery({ queryKey: noekler.aar(aar), queryFn: () => api.aar(aar) });

  if (dok.isPending || skjema.isPending) {
    return (
      <p className="beskjed-liten" role="status">
        Henter {aar} …
      </p>
    );
  }

  if (dok.isError || skjema.isError) {
    const feil = dok.error ?? skjema.error;
    return (
      <p className="beskjed-liten beskjed-feil" role="alert">
        {feil instanceof Error ? feil.message : "Klarte ikke hente året."}
      </p>
    );
  }

  const felter = synligeFelter(skjema.data, dok.data.felter);

  return (
    <div className="innhold">
      {felter.length === 0 && dok.data.media.length === 0 ? (
        <p className="innhold-tomt">
          Dette året er opprettet, men ikke fylt ut ennå.{" "}
          <Link to={`/rediger/${aar}`}>Skriv noe om {aar}</Link>.
        </p>
      ) : (
        felter.map(({ def, verdi }) =>
          def.type === "rik_tekst" ? (
            <section key={def.id} className="felt">
              <h3>{def.etikett}</h3>
              {/* Trygt: API-et saniterer all rik tekst før lagring (api/src/skjema.ts). */}
              <div className="felt-tekst" dangerouslySetInnerHTML={{ __html: verdi }} />
            </section>
          ) : (
            <p key={def.id} className="felt-kort">
              <span className="felt-etikett">{def.etikett}</span>
              {verdi}
            </p>
          )
        )
      )}

      <Mediegalleri media={dok.data.media} />

      <p className="innhold-bunn">
        <Link to={`/rediger/${aar}`} className="knapp-lenke">
          Rediger {aar}
        </Link>
        <span className="innhold-endret">
          Sist endret {new Date(dok.data.endret).toLocaleDateString("nb-NO")}
        </span>
      </p>
    </div>
  );
}

/**
 * Feltene i skjemaets rekkefølge, uten tomme, og uten tittel og sammendrag —
 * de vises allerede i radoverskriften på forsiden.
 */
function synligeFelter(skjema: Feltskjema, verdier: Record<string, string>) {
  const skjult = new Set(["tittel", "sammendrag"]);
  return skjema.felter
    .filter((def) => !skjult.has(def.id))
    .map((def) => ({ def, verdi: verdier[def.id] ?? "" }))
    .filter((f) => f.verdi.trim() !== "");
}
