import { Navigate, Route, Routes } from "react-router-dom";
import { useOkt } from "./auth/okt.js";
import { Forside } from "./sider/Forside.js";
import { Innlogging } from "./sider/Innlogging.js";
import { RedigerAar } from "./sider/RedigerAar.js";
import { Tilgang } from "./sider/Tilgang.js";

/**
 * Både «/» og «/aar/:aar» viser forsiden. Utfoldingen skjer på stedet, og
 * permalenken er den samme siden med ett år åpent – da virker deling,
 * tilbakeknappen og dyplenker uten at det finnes to visninger å holde like.
 *
 * Innloggingen legger seg foran rutene i stedet for å være en egen rute. URL-en
 * blir dermed stående, og en dyplenke fra e-post havner på riktig år straks
 * koden er godtatt.
 */
export function App() {
  const { innlogget, uinnlogget, isPending, feilet, erRedaktoer } = useOkt();

  if (isPending) {
    return (
      <main className="side side-smal">
        <p className="beskjed" role="status">
          Ett øyeblikk …
        </p>
      </main>
    );
  }

  if (feilet) {
    return (
      <main className="side side-smal">
        <div className="beskjed beskjed-feil" role="alert">
          <p>{feilet.message}</p>
          <p className="beskjed-hjelp">
            Klarer ikke serveren å lese tilgangslisten, kan ingen logge inn. Kjør{" "}
            <code>npm run seed</code> lokalt, eller <code>npm run seed:sky</code> mot
            lagringskontoen.
          </p>
        </div>
      </main>
    );
  }

  if (uinnlogget || !innlogget) return <Innlogging />;

  return (
    <Routes>
      <Route path="/" element={<Forside />} />
      <Route path="/aar/:aar" element={<Forside />} />
      <Route path="/rediger/nytt" element={<RedigerAar />} />
      <Route path="/rediger/:aar" element={<RedigerAar />} />
      {/* Serveren avviser uansett, men en rute som ikke finnes for lesere er
          en tydeligere beskjed enn en 403 etterpå. */}
      {erRedaktoer && <Route path="/tilgang" element={<Tilgang />} />}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
