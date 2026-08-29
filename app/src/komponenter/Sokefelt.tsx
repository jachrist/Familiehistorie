import { useEffect, useRef } from "react";

interface Props {
  verdi: string;
  onEndret: (v: string) => void;
  /** «5 av 36 år» — vises i et aria-live-område så det leses opp. */
  status: string;
}

export function Sokefelt({ verdi, onEndret, status }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  // «/» setter markøren i søkefeltet, som på de fleste nettsteder med søk.
  useEffect(() => {
    function paa(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const mål = e.target as HTMLElement | null;
      if (mål && /^(INPUT|TEXTAREA)$/.test(mål.tagName)) return;
      if (mål?.isContentEditable) return;
      e.preventDefault();
      ref.current?.focus();
    }
    window.addEventListener("keydown", paa);
    return () => window.removeEventListener("keydown", paa);
  }, []);

  return (
    <div className="sok">
      <label className="skjult" htmlFor="sokefelt">
        Søk i alle år
      </label>
      <div className="sok-boks">
        <svg className="sok-ikon" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
          <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <line x1="12.7" y1="12.7" x2="17" y2="17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          id="sokefelt"
          ref={ref}
          type="search"
          value={verdi}
          placeholder="Søk i alle år — sted, navn, hendelse"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => onEndret(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && verdi !== "") {
              e.preventDefault();
              onEndret("");
            }
          }}
        />
        {verdi !== "" && (
          <button type="button" className="sok-tom" onClick={() => onEndret("")} title="Tøm søket (Esc)">
            ×
          </button>
        )}
      </div>
      <p className="sok-status" role="status" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

/** Rendrer biter fra søkemodulen, med treffene uthevet. */
export function Uthevet({ biter }: { biter: { tekst: string; traff: boolean }[] }) {
  return (
    <>
      {biter.map((b, i) => (b.traff ? <mark key={i}>{b.tekst}</mark> : <span key={i}>{b.tekst}</span>))}
    </>
  );
}
