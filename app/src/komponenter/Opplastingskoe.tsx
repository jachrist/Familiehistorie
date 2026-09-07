import { useCallback, useRef, useState } from "react";
import type { Medieobjekt } from "../../../delt/typer.js";
import { api } from "../api/klient.js";
import { behandleBilde } from "../media/bilde.js";
import { lesExif, vanligsteAar } from "../media/exif.js";
import { iParallell, lastOpp } from "../media/opplasting.js";
import { lesVideometa, plakatFraVideo, vurderTranskoding, type Videovurdering } from "../media/video.js";

/** MIME-typene API-et utsteder skrive-SAS for. */
const GODTATT = [
  "image/jpeg", "image/png", "image/webp", "image/avif",
  "video/mp4", "video/quicktime", "video/webm",
];

const MAKS_VIDEO = 2 * 1024 * 1024 * 1024;

interface Post {
  nokkel: string;
  fil: File;
  /** «bekreft» = holdt tilbake til noen tar stilling til bitraten. */
  status: "venter" | "behandler" | "bekreft" | "laster" | "ferdig" | "feil";
  andel: number;
  feil?: string;
  aar?: number;
  vurdering?: Videovurdering;
}

interface Props {
  aar: number;
  /** Kalles med de nye objektene når en bunke er ferdig lastet opp. */
  onFerdig: (nye: Medieobjekt[]) => void;
  /** Foreslår årstall fra EXIF når brukeren oppretter et nytt år. */
  onAarsforslag?: (aar: number) => void;
  nesteRekkefolge: number;
}

export function Opplastingskoe({ aar, onFerdig, onAarsforslag, nesteRekkefolge }: Props) {
  const [koe, settKoe] = useState<Post[]>([]);
  const [over, settOver] = useState(false);
  const avbryt = useRef<AbortController>(null);
  const teller = useRef(0);

  const oppdater = useCallback((nokkel: string, endring: Partial<Post>) => {
    settKoe((f) => f.map((p) => (p.nokkel === nokkel ? { ...p, ...endring } : p)));
  }, []);

  /**
   * `tvunget` settes når noen har sett advarselen om bitrate og vil laste opp
   * likevel. Det er den eneste veien forbi kontrollen – og den er bevisst en
   * knapp per fil, ikke en innstilling: valget skal tas om denne filen.
   */
  const haandter = useCallback(
    async (filer: File[], tvunget = false) => {
      const godkjent: Post[] = [];
      const avvist: Post[] = [];

      for (const fil of filer) {
        const nokkel = `${Date.now()}-${teller.current++}`;
        if (!GODTATT.includes(fil.type)) {
          avvist.push({ nokkel, fil, status: "feil", andel: 0, feil: `Filtypen ${fil.type || "ukjent"} støttes ikke.` });
        } else if (fil.type.startsWith("video/") && fil.size > MAKS_VIDEO) {
          avvist.push({ nokkel, fil, status: "feil", andel: 0, feil: "Større enn 2 GB. Transkode klippet først — se avsnittet «Video» i KOM-I-GANG.md." });
        } else {
          godkjent.push({ nokkel, fil, status: "venter", andel: 0 });
        }
      }

      settKoe((f) => [...f, ...godkjent, ...avvist]);
      if (godkjent.length === 0) return;

      avbryt.current = new AbortController();
      const signal = avbryt.current.signal;

      // 1. Behandle lokalt: nedskalering, miniatyr, plakatbilde, EXIF.
      const behandlet = await iParallell(
        godkjent.map((post) => async () => {
          oppdater(post.nokkel, { status: "behandler" });
          const exif = await lesExif(post.fil);
          oppdater(post.nokkel, { aar: exif.aar });

          if (post.fil.type.startsWith("video/")) {
            const meta = await lesVideometa(post.fil);
            const vurdering = vurderTranskoding(post.fil.size, meta);
            if (vurdering.mistenkelig && !tvunget) {
              oppdater(post.nokkel, { status: "bekreft", vurdering });
              return undefined;
            }
            const plakat = await plakatFraVideo(post.fil, meta);
            return { post, exif, video: true as const, plakat, meta };
          }
          return { post, exif, video: false as const, bilde: await behandleBilde(post.fil) };
        }),
        2
      );

      const klare = behandlet.flatMap((r, i) => {
        // `undefined` er en fil som venter på svar, ikke en som feilet.
        if (r.status === "fulfilled") return r.value ? [r.value] : [];
        oppdater(godkjent[i]!.nokkel, {
          status: "feil",
          feil: r.reason instanceof Error ? r.reason.message : "Klarte ikke behandle filen.",
        });
        return [];
      });
      if (klare.length === 0) return;

      const forslag = vanligsteAar(klare.map((k) => k.exif.aar));
      if (forslag !== undefined) onAarsforslag?.(forslag);

      // 2. Hent skrive-SAS for alle filene i ett kall.
      //
      // Hver fil kan bidra med én eller to adresser: hovedfilen, og en avledet
      // (miniatyr eller plakatbilde) hvis den finnes. En video uten plakatbilde
      // bidrar bare med én. Derfor noteres posisjonene mens listen bygges, i
      // stedet for å regnes ut etterpå – å anta to per fil forskjøv hele listen
      // så snart én manglet, og da havnet en opplasting på en annen fils adresse.
      const oenskede: { filnavn: string; type: string }[] = [];
      const plassering = klare.map((k) => {
        const hoved = oenskede.length;
        oenskede.push({
          filnavn: k.post.fil.name,
          type: k.video ? k.post.fil.type : k.bilde.type,
        });

        const avledetBit = k.video ? k.plakat?.blob : k.bilde.miniatyr;
        if (!avledetBit) return { hoved, avledet: undefined, avledetBit: undefined };

        const avledet = oenskede.length;
        oenskede.push(
          k.video
            ? { filnavn: `${k.post.fil.name}.poster.jpg`, type: "image/jpeg" }
            : { filnavn: `${k.post.fil.name}.thumb`, type: k.bilde.type }
        );
        return { hoved, avledet, avledetBit };
      });

      let maal;
      try {
        maal = (await api.opplastingsmaal({ aar, filer: oenskede })).maal;
      } catch (e) {
        for (const k of klare) {
          oppdater(k.post.nokkel, {
            status: "feil",
            feil: e instanceof Error ? e.message : "Fikk ikke opplastingsadresse.",
          });
        }
        return;
      }

      // 3. Last opp. Hver fil har hovedfil + eventuell avledet fil.
      const jobber = klare.map((k, i) => {
        const plass = plassering[i]!;
        const hoved = maal[plass.hoved];
        const avledet = plass.avledet === undefined ? undefined : maal[plass.avledet];
        return async (): Promise<Medieobjekt | undefined> => {
          if (!hoved) {
            oppdater(k.post.nokkel, { status: "feil", feil: "Fikk ingen opplastingsadresse." });
            return undefined;
          }
          oppdater(k.post.nokkel, { status: "laster", andel: 0 });
          try {
            const kropp = k.video ? k.post.fil : k.bilde.web;
            await lastOpp(hoved.opplastingsUrl, kropp, (a) => oppdater(k.post.nokkel, { andel: a }), signal);

            if (avledet && plass.avledetBit) {
              await lastOpp(avledet.opplastingsUrl, plass.avledetBit, undefined, signal);
            }

            oppdater(k.post.nokkel, { status: "ferdig", andel: 1 });
            return {
              id: hoved.fil.split("/").pop()?.replace(/\.[^.]+$/, "") ?? hoved.fil,
              type: k.video ? "video" : "bilde",
              fil: hoved.fil,
              miniatyr: k.video ? null : (avledet?.fil ?? null),
              plakat: k.video ? (avledet?.fil ?? null) : null,
              bildetekst: "",
              tatt: k.exif.tatt ?? null,
              // Målene lagres også for video, så galleriet kan sette av riktig
              // plass før filen er lastet og siden ikke hopper.
              bredde: k.video ? (k.meta?.bredde ?? null) : k.bilde.bredde,
              hoyde: k.video ? (k.meta?.hoyde ?? null) : k.bilde.hoyde,
              varighet: k.video ? (k.meta?.varighet ?? k.plakat?.varighet ?? null) : null,
              rekkefolge: 0,
            };
          } catch (e) {
            if (e instanceof DOMException && e.name === "AbortError") {
              oppdater(k.post.nokkel, { status: "feil", feil: "Avbrutt." });
            } else {
              oppdater(k.post.nokkel, {
                status: "feil",
                feil: e instanceof Error ? e.message : "Opplastingen feilet.",
              });
            }
            return undefined;
          }
        };
      });

      const resultat = await iParallell(jobber, 3);
      const nye = resultat
        .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
        .map((m2, i) => ({ ...m2, rekkefolge: nesteRekkefolge + i * 10 }));

      if (nye.length > 0) onFerdig(nye);
    },
    [aar, onFerdig, onAarsforslag, nesteRekkefolge, oppdater]
  );

  const fjern = useCallback((nokkel: string) => {
    settKoe((f) => f.filter((p) => p.nokkel !== nokkel));
  }, []);

  const lastOppLikevel = useCallback(
    (post: Post) => {
      fjern(post.nokkel);
      void haandter([post.fil], true);
    },
    [fjern, haandter]
  );

  const aktive = koe.filter((p) => p.status === "behandler" || p.status === "laster").length;
  const feilede = koe.filter((p) => p.status === "feil");

  return (
    <div
      className={`slipp${over ? " slipp-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        settOver(true);
      }}
      onDragLeave={() => settOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        settOver(false);
        void haandter([...e.dataTransfer.files]);
      }}
    >
      <p className="slipp-tekst">
        Slipp bilder og videoer her, eller{" "}
        <label className="slipp-velg">
          velg filer
          <input
            type="file"
            multiple
            accept={GODTATT.join(",")}
            onChange={(e) => {
              void haandter([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
        </label>
        .
      </p>
      <p className="slipp-hjelp">
        Bilder skaleres ned og får miniatyr i nettleseren. Opptaksdato leses fra EXIF.
        Video lastes opp som den er — transkode klippene først.
      </p>

      {koe.length > 0 && (
        <ul className="koe">
          {koe.map((p) => (
            <li key={p.nokkel} className={`koe-post koe-${p.status}`}>
              <span className="koe-navn">{p.fil.name}</span>
              <span className="koe-status">
                {p.status === "venter" && "venter"}
                {p.status === "behandler" && "behandler …"}
                {p.status === "bekreft" && "ikke transkodet?"}
                {p.status === "laster" && `${Math.round(p.andel * 100)} %`}
                {p.status === "ferdig" && "ferdig"}
                {p.status === "feil" && (p.feil ?? "feilet")}
              </span>
              {p.status === "laster" && (
                <span className="koe-stolpe">
                  <span style={{ width: `${p.andel * 100}%` }} />
                </span>
              )}

              {p.status === "bekreft" && p.vurdering && (
                <div className="koe-advarsel">
                  <p>{p.vurdering.begrunnelse}</p>
                  <p className="koe-advarsel-hjelp">
                    Transkoding er en engangsjobb per klipp, og forskjellen er stor:
                    hele videokatalogen blir ~30 GB transkodet mot ~2,5 TB som råfiler.
                    Oppskriften med <code>ffmpeg</code> står under «Video» i KOM-I-GANG.md.
                  </p>
                  <div className="koe-advarsel-knapper">
                    <button type="button" className="knapp-sekundaer" onClick={() => fjern(p.nokkel)}>
                      Ta den ut
                    </button>
                    <button type="button" className="knapp-sekundaer" onClick={() => lastOppLikevel(p)}>
                      Last opp likevel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {aktive > 0 && (
        <button type="button" className="knapp-sekundaer" onClick={() => avbryt.current?.abort()}>
          Avbryt {aktive} pågående
        </button>
      )}
      {koe.length > 0 && aktive === 0 && (
        <button type="button" className="knapp-sekundaer" onClick={() => settKoe(feilede)}>
          Tøm listen
        </button>
      )}
    </div>
  );
}
