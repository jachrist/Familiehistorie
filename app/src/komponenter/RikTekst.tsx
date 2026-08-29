import { useEffect, useRef } from "react";

/**
 * Rik tekst med en bevisst liten verktøylinje: fet, kursiv, lenke, punktliste.
 * Ikke mer.
 *
 * Ukontrollert med vilje. Et kontrollert contentEditable må sette innhold på
 * nytt ved hver tastetrykk, og da hopper markøren. Her settes innholdet én gang,
 * og leses av når det endrer seg.
 *
 * All HTML herfra saniteres på serveren før lagring (api/src/skjema.ts). Det er
 * den bærende kontrollen — ikke denne verktøylinja.
 */
interface Props {
  id: string;
  verdi: string;
  onEndret: (html: string) => void;
}

const KNAPPER = [
  { kommando: "bold", merke: "F", tittel: "Fet (Ctrl+B)", klasse: "fet" },
  { kommando: "italic", merke: "K", tittel: "Kursiv (Ctrl+I)", klasse: "kursiv" },
  { kommando: "insertUnorderedList", merke: "•", tittel: "Punktliste", klasse: "" },
] as const;

export function RikTekst({ id, verdi, onEndret }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const satt = useRef(false);

  useEffect(() => {
    if (satt.current || !ref.current) return;
    ref.current.innerHTML = verdi;
    satt.current = true;
  }, [verdi]);

  function kjor(kommando: string, argument?: string) {
    ref.current?.focus();
    // execCommand er avviklet, men er fortsatt det eneste som virker likt i
    // alle nettlesere uten å dra inn et helt redigeringsbibliotek.
    document.execCommand(kommando, false, argument);
    onEndret(ref.current?.innerHTML ?? "");
  }

  function settLenke() {
    const url = window.prompt("Adresse:", "https://");
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      window.alert("Lenken må begynne med http:// eller https://");
      return;
    }
    kjor("createLink", url);
  }

  return (
    <div className="rik">
      <div className="rik-verktoy" role="toolbar" aria-label="Formatering">
        {KNAPPER.map((k) => (
          <button
            key={k.kommando}
            type="button"
            title={k.tittel}
            className={k.klasse}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => kjor(k.kommando)}
          >
            {k.merke}
          </button>
        ))}
        <button
          type="button"
          title="Lenke"
          onMouseDown={(e) => e.preventDefault()}
          onClick={settLenke}
        >
          🔗
        </button>
      </div>
      <div
        id={id}
        ref={ref}
        className="rik-felt"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        onInput={(e) => onEndret(e.currentTarget.innerHTML)}
        onBlur={(e) => onEndret(e.currentTarget.innerHTML)}
        // Lim inn som ren tekst. Ellers følger det med markup fra Word og
        // nettsider som saniteringen uansett kaster.
        onPaste={(e) => {
          e.preventDefault();
          const tekst = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, tekst);
        }}
      />
    </div>
  );
}
