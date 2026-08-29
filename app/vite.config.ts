import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  server: {
    // Bevisst 127.0.0.1 og ikke localhost. På Windows feiler Static Web Apps
    // CLI med «"localhost" can not be resolved to either IPv4 or IPv6» når
    // navneoppslaget svarer med ::1 og ingenting lytter der.
    host: "127.0.0.1",
    port: 5173,
    // Brukes bare når vite kjøres alene. Til vanlig går utviklingen gjennom
    // SWA CLI (`npm run dev` i rotmappa), som selv ruter /api til Functions.
    proxy: {
      "/api": { target: "http://127.0.0.1:7071", changeOrigin: true },
    },
  },
});
