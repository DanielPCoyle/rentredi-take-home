import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite serves the UI on :5173 and proxies API calls to the Express backend
// on :8080, so the browser talks to one origin. Prod: `vite build` -> dist/,
// which Express serves directly (same origin, no proxy needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/health": "http://localhost:8080",
    },
  },
  build: { outDir: "dist" },
});
