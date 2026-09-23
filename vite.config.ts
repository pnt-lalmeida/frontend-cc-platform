/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    globals: true,
    // No hereda .env.local (22/09/2026): un dev apuntando VITE_API_BASE_URL
    // a un backend local para probar a mano no deberia poder romper los
    // tests de otro - mismo principio que tests/conftest.py en el backend.
    env: {
      VITE_API_BASE_URL: "https://cc-platform-api.azurewebsites.net",
    },
  },
});
