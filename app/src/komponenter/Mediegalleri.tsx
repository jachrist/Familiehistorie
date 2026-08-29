import { useState } from "react";
import type { MedieobjektMedUrl } from "../../../delt/typer.js";

/**
 * Bilder og video for ett år.
 *
 * URL-ene er kortlevde SAS-lenker som API-et utstedte da årsdokumentet ble
 * hentet. De skal derfor ikke lagres eller deles videre.
 */
export function Mediegalleri({ media }: { media: MedieobjektMedUrl[] }) {
  if (media.length === 0) return null;

  const sortert = [...media].sort((a, b) => a.rekkefolge - b.rekkefolge);

  return (
    <div className="galleri">
      {sortert.map((m) => (m.type === "video" ? <Video key={m.id} m={m} /> : <Bilde key={m.id} m={m} />))}
    </div>
  );
}

function Bilde({ m }: { m: MedieobjektMedUrl }) {
  const [feilet, settFeilet] = useState(false);

  return (
    <figure className="galleri-post">
      {feilet ? (
        <div className="galleri-feil">Bildet kunne ikke lastes</div>
      ) : (
        <img
          src={m.miniatyrUrl ?? m.url}
          alt={m.bildetekst ?? `Bilde fra ${m.tatt ?? "ukjent tid"}`}
          loading="lazy"
          width={m.bredde ?? undefined}
          height={m.hoyde ?? undefined}
          onError={() => settFeilet(true)}
        />
      )}
      {(m.bildetekst || m.tatt) && (
        <figcaption>
          {m.bildetekst}
          {m.tatt && <span className="galleri-dato">{formatterDato(m.tatt)}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function Video({ m }: { m: MedieobjektMedUrl }) {
  return (
    <figure className="galleri-post galleri-video">
      <video controls preload="metadata" poster={m.plakatUrl ?? undefined}>
        <source src={m.url} />
        Nettleseren din kan ikke spille av denne videoen.
      </video>
      {(m.bildetekst || m.varighet) && (
        <figcaption>
          {m.bildetekst}
          {m.varighet ? <span className="galleri-dato">{formatterVarighet(m.varighet)}</span> : null}
        </figcaption>
      )}
    </figure>
  );
}

export function formatterDato(iso: string): string {
  // Godtar både «1972» og «1972-08-14». Tåler at eldre år bare har årstall.
  const treff = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(iso);
  if (!treff) return iso;
  const [, aar, maaned, dag] = treff;
  if (!maaned) return aar!;
  const maaneder = ["januar","februar","mars","april","mai","juni","juli","august","september","oktober","november","desember"];
  const navn = maaneder[Number(maaned) - 1] ?? maaned;
  return dag ? `${Number(dag)}. ${navn} ${aar}` : `${navn} ${aar}`;
}

function formatterVarighet(sekunder: number): string {
  const m = Math.floor(sekunder / 60);
  const s = Math.round(sekunder % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
