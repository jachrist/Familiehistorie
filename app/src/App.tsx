import { Navigate, Route, Routes } from "react-router-dom";
import { Forside } from "./sider/Forside.js";

/**
 * Både «/» og «/aar/:aar» viser forsiden. Utfoldingen skjer på stedet, og
 * permalenken er den samme siden med ett år åpent – da virker deling,
 * tilbakeknappen og dyplenker uten at det finnes to visninger å holde like.
 */
export function App() {
  return (
    <Routes>
      <Route path="/" element={<Forside />} />
      <Route path="/aar/:aar" element={<Forside />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
