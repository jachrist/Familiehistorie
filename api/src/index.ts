/**
 * Inngangspunkt for Azure Functions (Node v4).
 *
 * Endepunktene registrerer seg selv ved import, så denne filen skal bare
 * importere dem. Nye funksjonsfiler må legges til her for å bli synlige.
 */
import "./funksjoner/auth.js";
import "./funksjoner/felter.js";
import "./funksjoner/helse.js";
import "./funksjoner/indeks.js";
import "./funksjoner/aar.js";
import "./funksjoner/media.js";
import "./funksjoner/ping.js";
import "./funksjoner/tilgangsliste.js";
