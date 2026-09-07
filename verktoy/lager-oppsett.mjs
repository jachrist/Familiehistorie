/**
 * CORS-regler på lagringskontoen.
 *
 * Nettleseren laster opp media direkte til Blob Storage, utenom API-et. Det er
 * et kryssopphav-kall, og uten CORS-regler blokkerer nettleseren det før
 * forespørselen i det hele tatt sendes — SAS-en er da irrelevant.
 *
 * Kjøres mot Azurite lokalt. I Azure settes de samme reglene av infra/main.bicep.
 */
import { BlobServiceClient } from "@azure/storage-blob";

/**
 * Hodene opplastingen faktisk sender (se app/src/media/opplasting.ts), pluss
 * `Range`.
 *
 * `Range` er der for videoen. Et <video>-element som lastes med `crossOrigin`
 * – nødvendig for at plakatvelgeren skal få hente et bilde ut av lerretet –
 * gjør spolingen til et kryssopphav-kall med preflight, og uten `Range` i
 * listen avvises den. Da kan man verken spole eller velge plakatbilde.
 */
export const CORS_REGLER = [
  {
    allowedOrigins: "http://localhost:4280,http://127.0.0.1:4280,http://localhost:5173,http://127.0.0.1:5173",
    allowedMethods: "GET,HEAD,PUT,OPTIONS",
    allowedHeaders: "x-ms-blob-type,x-ms-blob-content-type,x-ms-version,content-type,range",
    exposedHeaders: "ETag,x-ms-request-id,Content-Range,Accept-Ranges,Content-Length,Content-Type",
    maxAgeInSeconds: 3600,
  },
];

export async function settCors(tilkobling = "UseDevelopmentStorage=true") {
  const tjeneste = BlobServiceClient.fromConnectionString(tilkobling);
  const naavaerende = await tjeneste.getProperties();
  await tjeneste.setProperties({ ...naavaerende, cors: CORS_REGLER });
}

// Kan kjøres direkte: node verktoy/lager-oppsett.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  await settCors(process.env.LAGER_TILKOBLING);
  console.log("✓ CORS-regler satt");
}
