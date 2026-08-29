import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.js";
import "./stil.css";

const rot = document.getElementById("rot");
if (!rot) throw new Error("Fant ikke #rot i index.html.");

createRoot(rot).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
