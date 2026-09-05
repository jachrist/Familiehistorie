import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Person, Rolle } from "../../../delt/typer.js";
import { Apifeil, api, noekler } from "../api/klient.js";
import { useOkt } from "../auth/okt.js";

/**
 * Tilgangslisten redigeres her, ikke i Azure-portalen. Å legge til et
 * familiemedlem skal være en oppgave i appen, og listen sikkerhetskopieres
 * sammen med resten av innholdet.
 */
export function Tilgang() {
  const koe = useQueryClient();
  const { innlogget } = useOkt();
  const tilstand = useQuery({ queryKey: noekler.tilgang, queryFn: api.tilgang });

  const [personer, settPersoner] = useState<Person[]>([]);
  const [etag, settEtag] = useState("");
  const [endret, settEndret] = useState(false);

  // Serverens versjon er fasit helt til noe er endret her. Uten `endret`-vakten
  // ville en refetch midt i redigeringen kastet det man holdt på med.
  useEffect(() => {
    if (!tilstand.data || endret) return;
    settPersoner(tilstand.data.personer);
    settEtag(tilstand.data.etag);
  }, [tilstand.data, endret]);

  const lagre = useMutation({
    mutationFn: () => api.lagreTilgang({ personer }, etag),
    onSuccess: (svar) => {
      settPersoner(svar.personer);
      settEtag(svar.etag);
      settEndret(false);
      koe.setQueryData(noekler.tilgang, svar);
    },
  });

  function endre(i: number, del: Partial<Person>) {
    settEndret(true);
    settPersoner((forrige) => forrige.map((p, j) => (i === j ? { ...p, ...del } : p)));
  }

  function vekslRolle(i: number, rolle: Rolle) {
    const person = personer[i];
    if (!person) return;
    const har = person.roller.includes(rolle);
    const roller = har
      ? person.roller.filter((r) => r !== rolle)
      : [...person.roller, rolle];
    // «familie» er gulvet: fjernes alt, står man igjen med en oppføring uten
    // mening. Serveren ville avvist den uansett.
    endre(i, { roller: roller.length === 0 ? ["familie"] : roller });
  }

  const antallRedaktoerer = personer.filter((p) => p.roller.includes("redaktoer")).length;

  return (
    <main className="side">
      <header className="topp">
        <p className="stempel">
          <Link to="/" className="knapp-lenke">
            ← Til årene
          </Link>
        </p>
        <h1>Tilgang</h1>
        <p className="ingress">
          Den som står her, kan logge inn med engangskode på e-post. Fjernes noen,
          slutter tilgangen med en gang – ikke når sesjonen utløper.
        </p>
      </header>

      {tilstand.isPending && (
        <p className="beskjed" role="status">
          Henter listen …
        </p>
      )}

      {tilstand.isError && (
        <div className="beskjed beskjed-feil" role="alert">
          <p>{tilstand.error.message}</p>
        </div>
      )}

      {tilstand.isSuccess && (
        <>
          <ul className="tilgangsliste">
            {personer.map((person, i) => (
              <li key={i} className="tilgangsrad">
                <div className="tilgangsrad-felt">
                  <label className="felt-etikett" htmlFor={`navn-${i}`}>
                    Navn
                  </label>
                  <input
                    id={`navn-${i}`}
                    className="inndata"
                    value={person.navn}
                    onChange={(e) => endre(i, { navn: e.target.value })}
                  />
                </div>

                <div className="tilgangsrad-felt">
                  <label className="felt-etikett" htmlFor={`epost-${i}`}>
                    E-postadresse
                  </label>
                  <input
                    id={`epost-${i}`}
                    className="inndata"
                    type="email"
                    inputMode="email"
                    value={person.epost}
                    onChange={(e) => endre(i, { epost: e.target.value })}
                  />
                </div>

                <div className="tilgangsrad-roller">
                  <label>
                    <input
                      type="checkbox"
                      checked={person.roller.includes("redaktoer")}
                      onChange={() => vekslRolle(i, "redaktoer")}
                    />{" "}
                    Redaktør
                  </label>
                  {person.epost.toLowerCase() === innlogget?.epost.toLowerCase() && (
                    <span className="tilgangsrad-deg">det er deg</span>
                  )}
                </div>

                <button
                  type="button"
                  className="knapp-sekundaer"
                  onClick={() => {
                    settEndret(true);
                    settPersoner((forrige) => forrige.filter((_, j) => j !== i));
                  }}
                >
                  Fjern
                </button>
              </li>
            ))}
          </ul>

          <div className="tilgang-handlinger">
            <button
              type="button"
              className="knapp-sekundaer"
              onClick={() => {
                settEndret(true);
                settPersoner((forrige) => [
                  ...forrige,
                  { epost: "", navn: "", roller: ["familie"] },
                ]);
              }}
            >
              Legg til person
            </button>

            <button
              type="button"
              className="knapp"
              disabled={!endret || lagre.isPending}
              onClick={() => lagre.mutate()}
            >
              {lagre.isPending ? "Lagrer …" : "Lagre listen"}
            </button>
          </div>

          {antallRedaktoerer === 0 && (
            <div className="beskjed beskjed-feil" role="alert">
              <p>Minst én person må være redaktør, ellers kan ingen redigere.</p>
            </div>
          )}

          {lagre.isError && (
            <div className="beskjed beskjed-feil" role="alert">
              <p>{(lagre.error as Error).message}</p>
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
              Listen er lagret.
            </p>
          )}
        </>
      )}
    </main>
  );
}
