import { useCallback, useRef, useState } from "react";
import type { Medieobjekt } from "../../../delt/typer.js";
import { api } from "../api/klient.js";
import { behandleBilde, plakatFraVideo } from "../media/bilde.js";
import { lesExif, vanligsteAar } from "../media/exif.js";
import { iParallell, lastOpp } from "../media/opplasting.js";

/** MIME-typene API-et utsteder skrive-SAS for. */
const GODTATT = [
  "image/jpeg", "image/png", "image/webp", "image/avif",
  "video/mp4", "video/quicktime", "video/webm",
];

const MAKS_VIDEO = 2 * 1024 * 1024 * 1024;

interface Post {
  nokkel: string;
  fil: File;
  status: "venter" | "behandler" | "laster" | "ferdig" | "feil";
  andel: number;
  feil?: string;
  aar?: number;
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

  const haandter = useCallback(
    async (filer: File[]) => {
      const godkjent: Post[] = [];
      const avvist: Post[] = [];

      for (const fil of filer) {
        const nokkel = `${Date.now()}-${teller.current++}`;
        if (!GODTATT.includes(fil.type)) {
          avvist.push({ nokkel, fil, status: "feil", andel: 0, feil: `Filtypen ${fil.type || "ukjent"} støttes ikke.` });
        } else if (fil.type.startsWith("video/") && fil.size > MAKS_VIDEO) {
          avvist.push({ nokkel, fil, status: "feil", andel: 0, feil: "Større enn 2 GB. Transkode klippet først — se KOM-I-GANG.md." });
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
            const plakat = await plakatFraVideo(post.fil);
            return { post, exif, video: true as const, plakat };
          }
          return { post, exif, video: false as const, bilde: await behandleBilde(post.fil) };
        }),
        2
      );

      const klare = behandlet.flatMap((r, i) => {
        if (r.status === "fulfilled") return [r.value];
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
      const oenskede = klare.flatMap((k) => {
        const type = k.video ? k.post.fil.type : k.bilde.type;
        const deler = [{ filnavn: k.post.fil.name, type }];
        if (k.video) {
          if (k.plakat) deler.push({ filnavn: `${k.post.fil.name}.poster.jpg`, type: "image/jpeg" });
        } else {
          deler.push({ filnavn: `${k.post.fil.name}.thumb`, type: k.bilde.type });
        }
        return deler;
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
      let m = 0;
      const jobber = klare.map((k) => {
        const hoved = maal[m++]!;
        const avledet = maal[m++];
        return async (): Promise<Medieobjekt | undefined> => {
          oppdater(k.post.nokkel, { status: "laster", andel: 0 });
          try {
            const kropp = k.video ? k.post.fil : k.bilde.web;
            await lastOpp(hoved.opplastingsUrl, kropp, (a) => oppdater(k.post.nokkel, { andel: a }), signal);

            if (avledet) {
              const bit = k.video ? k.plakat?.blob : k.bilde.miniatyr;
              if (bit) await lastOpp(avledet.opplastingsUrl, bit, undefined, signal);
            }

            oppdater(k.post.nokkel, { status: "ferdig", andel: 1 });
            return {
              id: hoved.fil.split("/").pop()?.replace(/\.[^.]+$/, "") ?? hoved.fil,
              type: k.video ? "video" : "bilde",
              fil: hoved.fil,
              miniatyr: k.video ? null : (avledet?.fil ?? null),
              plakat: k.video ? (k.plakat ? (avledet?.fil ?? null) : null) : null,
              bildetekst: "",
              tatt: k.exif.tatt ?? null,
              bredde: k.video ? null : k.bilde.bredde,
              hoyde: k.video ? null : k.bilde.hoyde,
              varighet: k.video ? (k.plakat?.varighet ?? null) : null,
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
                {p.status === "laster" && `${Math.round(p.andel * 100)} %`}
                {p.status === "ferdig" && "ferdig"}
                {p.status === "feil" && (p.feil ?? "feilet")}
              </span>
              {p.status === "laster" && (
                <span className="koe-stolpe">
                  <span style={{ width: `${p.andel * 100}%` }} />
                </span>
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
