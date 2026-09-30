/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: {
    environment: "jsdom",
    globals: true,
    // Los worktrees de agentes viven en .claude/worktrees/ y son una copia
    // completa del repo: sin esto Vitest levanta CADA test dos veces (paso el
    // 30/09/2026: 890 tests en vez de 445, el doble exacto). Estan en
    // .gitignore, asi que git no los ve, pero el glob de Vitest si.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
    // No hereda .env.local (22/09/2026): un dev apuntando VITE_API_BASE_URL
    // a un backend local para probar a mano no deberia poder romper los
    // tests de otro - mismo principio que tests/conftest.py en el backend.
    env: {
      VITE_API_BASE_URL: "https://cc-platform-api.azurewebsites.net",
    },
  },
});
