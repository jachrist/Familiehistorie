import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Apifeil, api } from "../api/klient.js";
import { settInnlogget } from "../auth/okt.js";

/**
 * Innlogging i to steg: adresse, så kode.
 *
 * URL-en røres ikke. Kommer man hit fra en dyplenke til /aar/1972, står den
 * fortsatt i adressefeltet, og siden vises av seg selv når koden er godtatt –
 * uten at ruten må lagres og gjenopprettes noe sted.
 */
export function Innlogging() {
  const koe = useQueryClient();
  const [epost, settEpost] = useState("");
  const [kode, settKode] = useState("");
  const [steg, settSteg] = useState<"epost" | "kode">("epost");

  const bestill = useMutation({
    // Se main.tsx: 401 herfra er et feil kodeforsøk, ikke en utløpt sesjon.
    meta: { innloggingsforsok: true },
    mutationFn: () => api.bestillKode(epost),
    onSuccess: () => {
      settKode("");
      settSteg("kode");
    },
  });

  const verifiser = useMutation({
    meta: { innloggingsforsok: true },
    mutationFn: () => api.verifiserKode(epost, kode),
    onSuccess: (meg) => settInnlogget(koe, meg),
  });

  const feilmelding = (bestill.error ?? verifiser.error) as Error | null;

  return (
    <main className="side side-smal">
      <header className="topp">
        <p className="stempel">Familien Christiansen</p>
        <h1>Familiehistorie</h1>
      </header>

      <div className="kort">
        {steg === "epost" ? (
          <form
            className="skjema"
            onSubmit={(e) => {
              e.preventDefault();
              bestill.mutate();
            }}
          >
            <p className="ingress">
              Skriv e-postadressen din, så sender vi en engangskode.
            </p>

            <label className="felt-etikett" htmlFor="epost">
              E-postadresse
            </label>
            <input
              id="epost"
              className="inndata"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              value={epost}
              onChange={(e) => settEpost(e.target.value)}
            />

            <button className="knapp" type="submit" disabled={bestill.isPending}>
              {bestill.isPending ? "Sender …" : "Send kode"}
            </button>
          </form>
        ) : (
          <form
            className="skjema"
            onSubmit={(e) => {
              e.preventDefault();
              verifiser.mutate();
            }}
          >
            <p className="ingress">
              {bestill.data?.beskjed ??
                "Får vi treff på adressen, kommer det en kode på e-post."}
            </p>

            <label className="felt-etikett" htmlFor="kode">
              Engangskode
            </label>
            <input
              id="kode"
              className="inndata inndata-kode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={7}
              value={kode}
              onChange={(e) => settKode(e.target.value)}
            />

            <button
              className="knapp"
              type="submit"
              disabled={verifiser.isPending || kode.replace(/\s+/g, "").length < 6}
            >
              {verifiser.isPending ? "Sjekker …" : "Logg inn"}
            </button>

            <p className="skjema-under">
              <button
                type="button"
                className="lenkeknapp"
                onClick={() => bestill.mutate()}
                disabled={bestill.isPending}
              >
                Send koden på nytt
              </button>
              {" · "}
              <button
                type="button"
                className="lenkeknapp"
                onClick={() => {
                  verifiser.reset();
                  bestill.reset();
                  settSteg("epost");
                }}
              >
                Bytt adresse
              </button>
            </p>
          </form>
        )}

        {feilmelding && (
          <div className="beskjed beskjed-feil" role="alert">
            <p>{feilmelding.message}</p>
            {feilmelding instanceof Apifeil && feilmelding.status === 429 && (
              <p className="beskjed-hjelp">
                Be om en ny kode og prøv igjen. Kommer det ingen e-post, kan adressen
                være ukjent for oss.
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="bunn">
        <p>
          Sidene er private. Får du ikke kode, står ikke adressen på tilgangslisten –
          spør den som administrerer nettstedet.
        </p>
      </footer>
    </main>
  );
}
