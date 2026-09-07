import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Sikkerhetskopi } from "../../../delt/typer.js";
import { api, noekler } from "../api/klient.js";
import { formatterBytes } from "../format.js";

/**
 * Admin-siden.
 *
 * De samme operasjonene som skriptene i `verktoy/`, men uten skall, uten
 * `npm install` og uten en tilkoblingsstreng i miljøet. Nettstedet drives fra en
 * iPad, og da er et skript på en annen maskin i praksis en operasjon som ikke
 * finnes.
 *
 * Rekkefølgen på siden er valgt: det hverdagslige øverst, det som ikke kan
 * angres nederst og bak en luke man må åpne selv.
 */
export function Admin() {
  const koe = useQueryClient();

  const tilgang = useQuery({ queryKey: noekler.tilgang, queryFn: api.tilgang });
  const kopier = useQuery({ queryKey: noekler.sikkerhetskopier, queryFn: api.sikkerhetskopier });

  const taKopi = useMutation({
    mutationFn: api.taSikkerhetskopi,
    onSuccess: () => koe.invalidateQueries({ queryKey: noekler.sikkerhetskopier }),
  });

  const [velgGjenoppretting, settVelgGjenoppretting] = useState<string | null>(null);
  const gjenopprett = useMutation({
    mutationFn: ({ id, aar }: { id: string; aar: number }) => api.gjenopprett(id, aar),
    onSuccess: () => {
      settVelgGjenoppretting(null);
      koe.invalidateQueries({ queryKey: noekler.indeks });
      koe.invalidateQueries({ queryKey: noekler.felter });
      koe.invalidateQueries({ queryKey: noekler.sikkerhetskopier });
      koe.removeQueries({ queryKey: ["aar"] });
    },
  });

  const rydd = useMutation({ mutationFn: (slett: boolean) => api.ryddMedia(slett) });

  const [taMedMedia, settTaMedMedia] = useState(false);
  const [bekreftelse, settBekreftelse] = useState("");

  const tell = useMutation({ mutationFn: () => api.tom(taMedMedia) });
  const tom = useMutation({
    mutationFn: (sum: number) => api.tom(taMedMedia, sum),
    onSuccess: () => {
      settBekreftelse("");
      tell.reset();
      koe.invalidateQueries({ queryKey: noekler.indeks });
      koe.invalidateQueries({ queryKey: noekler.sikkerhetskopier });
      // Årene ligger som egne spørringer. Etter en tømming er alle sammen feil.
      koe.removeQueries({ queryKey: ["aar"] });
    },
  });

  const antallPersoner = tilgang.data?.personer.length ?? 0;
  const antallRedaktoerer =
    tilgang.data?.personer.filter((p) => p.roller.includes("redaktoer")).length ?? 0;

  const telling = tell.data?.telling;
  const kanSlette = telling !== undefined && bekreftelse.trim() === String(telling.sum);

  return (
    <main className="side">
      <header className="topp">
        <p className="stempel">
          <Link to="/" className="knapp-lenke">
            ← Til årene
          </Link>
        </p>
        <h1>Admin</h1>
        <p className="ingress">
          Familiemedlemmer, sikkerhetskopier og opprydding. Alt her krever
          redaktørrolle, og alt kan gjøres herfra – ingen skript nødvendig.
        </p>
      </header>

      <section className="kort admin-kort">
        <h2>Familiemedlemmer</h2>
        <p className="admin-hjelp">
          Den som står på tilgangslisten, kan logge inn med engangskode på e-post.
        </p>

        {tilgang.isPending && <p className="beskjed-liten">Henter listen …</p>}
        {tilgang.isError && (
          <p className="beskjed-liten beskjed-feil" role="alert">
            {tilgang.error.message}
          </p>
        )}
        {tilgang.isSuccess && (
          <p className="admin-tall">
            {antallPersoner} {antallPersoner === 1 ? "person" : "personer"},{" "}
            {antallRedaktoerer} {antallRedaktoerer === 1 ? "redaktør" : "redaktører"}
          </p>
        )}

        <div className="admin-handlinger">
          <Link to="/tilgang" className="knapp">
            Legg til eller endre
          </Link>
        </div>
      </section>

      <section className="kort admin-kort">
        <h2>Sikkerhetskopi</h2>
        <p className="admin-hjelp">
          Kopien inneholder alle årene, feltskjemaet og tilgangslisten. Bildene og
          videoene kopieres ikke – de er beskyttet av versjonering og 30 dagers
          angrefrist på lagringskontoen – men hver fil listes med navn og
          størrelse, så en gjenoppretting kan si hva som eventuelt mangler.
        </p>
        <p className="admin-hjelp">
          Last ned filen hvis du vil ha kopien utenfor Azure. På iPad havner den i
          Filer, og er da uavhengig av kontoen den kom fra.
        </p>

        <div className="admin-handlinger">
          <button
            type="button"
            className="knapp"
            disabled={taKopi.isPending}
            onClick={() => taKopi.mutate()}
          >
            {taKopi.isPending ? "Tar kopi …" : "Ta sikkerhetskopi nå"}
          </button>
        </div>

        {taKopi.isError && (
          <p className="beskjed-liten beskjed-feil" role="alert">
            {taKopi.error.message}
          </p>
        )}

        {kopier.isError && (
          <p className="beskjed-liten beskjed-feil" role="alert">
            {kopier.error.message}
          </p>
        )}

        {gjenopprett.isError && (
          <p className="beskjed-liten beskjed-feil" role="alert">
            {gjenopprett.error.message}
          </p>
        )}

        {gjenopprett.isSuccess && (
          <p className="beskjed-liten" role="status">
            Skrev tilbake {gjenopprett.data.aar} år fra {gjenopprett.data.fra}. Innholdet
            slik det var rett før, ligger som {gjenopprett.data.sikkerhetskopi.id}.
          </p>
        )}

        {kopier.isSuccess &&
          (kopier.data.kopier.length === 0 ? (
            <p className="beskjed-liten">Ingen sikkerhetskopier ennå.</p>
          ) : (
            <ul className="kopiliste">
              {kopier.data.kopier.map((kopi) => (
                <Kopirad
                  key={kopi.id}
                  kopi={kopi}
                  apen={velgGjenoppretting === kopi.id}
                  venter={gjenopprett.isPending}
                  paaVelg={() => {
                    gjenopprett.reset();
                    settVelgGjenoppretting(kopi.id);
                  }}
                  paaAvbryt={() => settVelgGjenoppretting(null)}
                  paaGjenopprett={() =>
                    gjenopprett.mutate({ id: kopi.id, aar: kopi.antallAar })
                  }
                />
              ))}
            </ul>
          ))}
      </section>

      <section className="kort admin-kort">
        <h2>Ubrukte mediefiler</h2>
        <p className="admin-hjelp">
          Fjerner du et bilde i redigeringen, forsvinner det fra året, men filen
          blir liggende til den ryddes. Det er med vilje: da er «fjern» angrbart
          fram til du rydder.
        </p>

        <div className="admin-handlinger">
          <button
            type="button"
            className="knapp-sekundaer"
            disabled={rydd.isPending}
            onClick={() => rydd.mutate(false)}
          >
            {rydd.isPending ? "Ser etter …" : "Se hva som er ubrukt"}
          </button>

          {rydd.data?.torrkjoring && rydd.data.ubrukte.length > 0 && (
            <button
              type="button"
              className="knapp"
              disabled={rydd.isPending}
              onClick={() => rydd.mutate(true)}
            >
              Slett {rydd.data.ubrukte.length}{" "}
              {rydd.data.ubrukte.length === 1 ? "fil" : "filer"}
            </button>
          )}
        </div>

        {rydd.isError && (
          <p className="beskjed-liten beskjed-feil" role="alert">
            {rydd.error.message}
          </p>
        )}

        {rydd.data?.torrkjoring === true && (
          <p className="beskjed-liten" role="status">
            {rydd.data.ubrukte.length === 0
              ? "Ingen ubrukte filer. Alt som ligger der, vises et sted."
              : `${rydd.data.ubrukte.length} filer er ikke i bruk.`}
          </p>
        )}
        {rydd.data?.torrkjoring === false && (
          <p className="beskjed-liten" role="status">
            Slettet {rydd.data.slettet} {rydd.data.slettet === 1 ? "fil" : "filer"}.
          </p>
        )}
      </section>

      <details className="kort admin-kort admin-farlig">
        <summary>Tøm innholdet</summary>

        <p className="admin-hjelp">
          Sletter alle årene og indeksen, slik at ekte materiale kan legges inn i
          et rent arkiv. Feltskjemaet og tilgangslisten røres aldri – uten dem
          ville nettstedet vært både tomt og låst. Det tas alltid en
          sikkerhetskopi først.
        </p>

        <label className="admin-valg">
          <input
            type="checkbox"
            checked={taMedMedia}
            onChange={(e) => {
              settTaMedMedia(e.target.checked);
              // Opptellingen gjaldt det andre valget.
              tell.reset();
              tom.reset();
              settBekreftelse("");
            }}
          />{" "}
          Ta med bilder og video
        </label>
        {taMedMedia && (
          <p className="beskjed-liten beskjed-merk">
            Mediefilene er ikke med i sikkerhetskopien. De kan hentes tilbake fra
            angrefristen på lagringskontoen i 30 dager, men ikke fra denne siden.
          </p>
        )}

        <div className="admin-handlinger">
          <button
            type="button"
            className="knapp-sekundaer"
            disabled={tell.isPending}
            onClick={() => {
              settBekreftelse("");
              tom.reset();
              tell.mutate();
            }}
          >
            {tell.isPending ? "Teller opp …" : "Tell opp"}
          </button>
        </div>

        {tell.isError && (
          <p className="beskjed-liten beskjed-feil" role="alert">
            {tell.error.message}
          </p>
        )}

        {telling && !tom.isSuccess && (
          <>
            <ul className="admin-telling">
              <li>
                {telling.aar} {telling.aar === 1 ? "årsdokument" : "årsdokumenter"}
              </li>
              {telling.indeks > 0 && <li>indeksen, som bygges på nytt av seg selv</li>}
              {taMedMedia && (
                <>
                  <li>{telling.media} mediefiler</li>
                  <li>{telling.originaler} originaler</li>
                </>
              )}
            </ul>

            {telling.sum === 0 ? (
              <p className="beskjed-liten" role="status">
                Ingenting å slette.
              </p>
            ) : (
              <>
                <label className="felt-etikett" htmlFor="bekreft">
                  Skriv antallet ({telling.sum}) for å bekrefte
                </label>
                <input
                  id="bekreft"
                  className="inndata inndata-antall"
                  inputMode="numeric"
                  autoComplete="off"
                  value={bekreftelse}
                  onChange={(e) => settBekreftelse(e.target.value)}
                />
                <div className="admin-handlinger">
                  <button
                    type="button"
                    className="knapp knapp-farlig"
                    disabled={!kanSlette || tom.isPending}
                    onClick={() => tom.mutate(telling.sum)}
                  >
                    {tom.isPending ? "Sletter …" : `Slett ${telling.sum} filer`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {tom.isError && (
          <p className="beskjed-liten beskjed-feil" role="alert">
            {tom.error.message}
          </p>
        )}

        {tom.isSuccess && (
          <div className="beskjed" role="status">
            <p>
              Slettet {tom.data.slettet} filer. Sikkerhetskopien ligger under{" "}
              {tom.data.sikkerhetskopi?.id}.
            </p>
            {tom.data.gjenstaar > 0 && (
              <p>
                {tom.data.gjenstaar} filer gjenstår – det er flere enn ett kall
                rekker. Tell opp og slett en gang til.
              </p>
            )}
          </div>
        )}
      </details>
    </main>
  );
}

const tidspunkt = new Intl.DateTimeFormat("nb-NO", {
  dateStyle: "long",
  timeStyle: "short",
});

interface Kopiradsprops {
  kopi: Sikkerhetskopi;
  apen: boolean;
  venter: boolean;
  paaVelg: () => void;
  paaAvbryt: () => void;
  paaGjenopprett: () => void;
}

function Kopirad({ kopi, apen, venter, paaVelg, paaAvbryt, paaGjenopprett }: Kopiradsprops) {
  return (
    <li className="kopirad">
      <div className="kopirad-topp">
        <div>
          <p className="kopirad-tid">{tidspunkt.format(new Date(kopi.tidspunkt))}</p>
          <p className="kopirad-detalj">
            {kopi.grunn.toLowerCase()} · {kopi.antallAar} år · {formatterBytes(kopi.bytes)}
            {kopi.antallMediefiler > 0 &&
              ` · ${kopi.antallMediefiler} mediefiler (${formatterBytes(kopi.mediebytes)}) er ikke med`}
          </p>
        </div>

        <div className="kopirad-knapper">
          {/* Vanlig lenke, ikke fetch: da tilbyr Safari «Lagre i Filer». */}
          <a className="knapp-sekundaer" href={api.sikkerhetskopiUrl(kopi.id)} download>
            Last ned
          </a>
          {!apen && (
            <button type="button" className="knapp-sekundaer" onClick={paaVelg}>
              Gjenopprett
            </button>
          )}
        </div>
      </div>

      {apen && (
        <div className="kopirad-bekreft">
          <p>
            Skriver tilbake {kopi.antallAar} år og feltskjemaet. Tilgangslisten røres
            ikke, og år som er kommet til etter denne kopien, blir stående. Det tas en
            kopi av det som ligger der nå først.
          </p>
          <div className="admin-handlinger">
            <button
              type="button"
              className="knapp knapp-farlig"
              disabled={venter}
              onClick={paaGjenopprett}
            >
              {venter ? "Gjenoppretter …" : `Ja, skriv tilbake ${kopi.antallAar} år`}
            </button>
            <button
              type="button"
              className="knapp-sekundaer"
              disabled={venter}
              onClick={paaAvbryt}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
