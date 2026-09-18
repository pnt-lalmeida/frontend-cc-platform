# Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared foundation of `frontend-cc-platform` (Vite + React + TypeScript): auth (MSAL, no proxy), the API client, the design system from the approved mockup, a shared Table component, and the routing shell — everything the Cliente 360 and Bandeja screens will build on.

**Architecture:** A thin `src/api/client.ts` attaches the Bearer token and never retries; `src/auth/` wraps `@azure/msal-react` directly (no proxy — direct SPA→Function calls, confirmed working by the 18/09/2026 auth spike); `src/design/tokens.css` carries the approved visual direction as CSS variables; `src/components/AppShell.tsx` is a light topbar shell (no dark sidebar); route pages are placeholders, filled in by the next two plans.

**Tech Stack:** React 18, TypeScript, Vite, react-router-dom, `@azure/msal-browser` + `@azure/msal-react`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-18-frontend-foundation-design.md`

## Global Constraints

- No proxy — the SPA calls the Function App directly with `Authorization: Bearer <token>` (confirmed working, Architecture.md §2.1/§9.5).
- `VITE_API_BASE_URL` defaults to `https://cc-platform-api.azurewebsites.net` (the already-deployed, already-validated backend).
- MSAL config: `clientId=2095b6bc-db66-4b95-97ad-7c569800a4c9`, `tenant=17af3ac8-4b4c-4703-b52f-2f902d63af82`, `scope=api://2095b6bc-db66-4b95-97ad-7c569800a4c9/access_as_user`, `redirectUri: window.location.origin` (never hardcoded to one host).
- `src/api/client.ts` never retries automatically, on any method.
- Currency formatting: Uruguayan convention (decimal comma, thousands point), default UYU. Dates: `DD/MM/AAAA`, always computed in UTC (backend sends UTC-midnight ISO timestamps — formatting in local time would shift the displayed day for anyone west of UTC, which is everyone in Uruguay).
- Design tokens are fixed values from the approved mockup (`https://claude.ai/artifact/4HeQs6UxmNw1qomd7iCoiA`) — do not improvise new colors.
- TDD for all pure logic (`format.ts`, `client.ts`, `Table.tsx`'s sort behavior). Thin wrapper components around MSAL (`AuthProvider`, `RequireAuth`, `useAccessToken`) are not unit-tested in this plan — documented scope decision, not an oversight.
- Never commit `.env` (only `.env.example`, and `.env.test` for the two public, non-secret IDs tests need).

## File Structure

```
frontend-cc-platform/
  package.json
  vite.config.ts
  tsconfig.json
  tsconfig.node.json
  index.html
  .env.example
  .env.test
  .gitignore
  src/
    vite-env.d.ts
    main.tsx
    App.tsx
    App.test.tsx
    auth/
      msalConfig.ts
      msalConfig.test.ts
      AuthProvider.tsx
      RequireAuth.tsx
      useAccessToken.ts
    api/
      client.ts
      client.test.ts
      types.ts
    design/
      tokens.css
      format.ts
      format.test.ts
    components/
      AppShell.tsx
      Table.tsx
      Table.test.tsx
      StatusTag.tsx
    routes/
      Cliente360Page.tsx
      BandejaPage.tsx
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `.env.example`, `.gitignore`, `src/vite-env.d.ts`, `src/App.tsx`, `src/App.test.tsx`, `src/main.tsx`

**Interfaces:**
- Produces the base Vite/React/TS project — every later task adds files under `src/` that this scaffold already knows how to build and test.

- [ ] **Step 1: Write the files**

`package.json`:
```json
{
  "name": "frontend-cc-platform",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@azure/msal-browser": "^3.27.0",
    "@azure/msal-react": "^2.1.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@testing-library/dom": "^10.4.1",
    "@testing-library/react": "^16.3.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.9"
  }
}
```

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
    <title>Cuentas Corrientes — Pontyn</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.env.example`:
```
VITE_API_BASE_URL=https://cc-platform-api.azurewebsites.net
VITE_ENTRA_TENANT_ID=17af3ac8-4b4c-4703-b52f-2f902d63af82
VITE_ENTRA_CLIENT_ID=2095b6bc-db66-4b95-97ad-7c569800a4c9
VITE_API_SCOPE=api://2095b6bc-db66-4b95-97ad-7c569800a4c9/access_as_user
```

`.gitignore`:
```
node_modules/
dist/
.env
.env.local
*.local
.DS_Store
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/App.tsx` (placeholder — Task 6 replaces this with real routing):
```tsx
export default function App() {
  return <div>Cuentas Corrientes</div>;
}
```

`src/App.test.tsx` (placeholder — Task 6 replaces this test too):
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByText("Cuentas Corrientes")).toBeTruthy();
  });
});
```

`src/main.tsx` (placeholder — Task 6 replaces this with the real provider tree):
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Install and verify**

Run: `npm install`
Run: `npm test`
Expected: 1 test passing (`App > renders without crashing`).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json tsconfig.node.json index.html .env.example .gitignore src/vite-env.d.ts src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "chore: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Design tokens + formatters

**Files:**
- Create: `src/design/tokens.css`, `src/design/format.ts`, `src/design/format.test.ts`

**Interfaces:**
- Produces: `formatMoney(value: number | null | undefined, moneda?: string | null): string`, `formatDate(isoDate: string | null | undefined): string` — consumed by every later screen.
- Produces the CSS custom properties (`--color-*`, `--font-*`) every component uses.

- [ ] **Step 1: Write the failing tests**

`src/design/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("formatMoney", () => {
  it("formatea UYU con coma decimal y punto de miles", () => {
    expect(formatMoney(1250.5, "UYU")).toBe("$ 1.250,50");
  });

  it("usa el simbolo de USD", () => {
    expect(formatMoney(732413.83, "USD")).toBe("US$ 732.413,83");
  });

  it("usa el simbolo de EUR", () => {
    expect(formatMoney(100, "EUR")).toBe("€ 100,00");
  });

  it("default a UYU cuando no se pasa moneda", () => {
    expect(formatMoney(10)).toBe("$ 10,00");
  });

  it("devuelve un guion largo para null/undefined", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });
});

describe("formatDate", () => {
  it("formatea a DD/MM/AAAA en UTC, sin corrimiento de dia", () => {
    // Uruguay es UTC-3: sin forzar UTC este caso se mostraria como 26/07/2026.
    expect(formatDate("2026-07-27T00:00:00Z")).toBe("27/07/2026");
  });

  it("devuelve un guion largo para null/undefined/invalido", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("no-es-una-fecha")).toBe("—");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- format`
Expected: FAIL — `Cannot find module './format'`

- [ ] **Step 3: Write minimal implementation**

`src/design/tokens.css`:
```css
:root {
  --color-ink: #1B1F1D;
  --color-paper: #EAEDE9;
  --color-surface: #FFFFFF;
  --color-line: #D7DCD6;
  --color-line-strong: #B9C1B7;
  --color-muted: #5B6660;
  --color-accent: #0F5C52;
  --color-accent-ink: #0A3F38;
  --color-accent-soft: #DCEAE6;
  --color-risk: #8C3B2E;
  --color-risk-soft: #F6E7E6;
  --color-caution: #97690F;
  --color-caution-soft: #F1E7D2;
  --color-ok: #3D6B4A;
  --color-ok-soft: #E4EDE3;

  --font-display: "Fraunces", serif;
  --font-ui: "IBM Plex Sans", sans-serif;
  --font-mono: "IBM Plex Mono", monospace;
}

body {
  margin: 0;
  background: var(--color-paper);
  color: var(--color-ink);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}
```

`src/design/format.ts`:
```ts
const MONEDA_SIMBOLO: Record<string, string> = {
  UYU: "$",
  USD: "US$",
  EUR: "€",
};

export function formatMoney(
  value: number | null | undefined,
  moneda: string | null = "UYU"
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const numero = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const simbolo = (moneda && MONEDA_SIMBOLO[moneda]) || "$";
  return `${simbolo} ${numero}`;
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "—";
  }
  const fecha = new Date(isoDate);
  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- format`
Expected: PASS (9 tests). If `formatMoney`'s exact separator characters don't match (locale data can vary slightly by Node version), adjust the expected strings to whatever `es-UY` actually produces on this machine — the important properties are: period for thousands, comma for decimals, two decimal places always shown.

- [ ] **Step 5: Commit**

```bash
git add src/design/tokens.css src/design/format.ts src/design/format.test.ts
git commit -m "feat: add design tokens and UYU/date formatters"
```

---

### Task 3: API client + types

**Files:**
- Create: `src/api/types.ts`, `src/api/client.ts`, `src/api/client.test.ts`

**Interfaces:**
- Produces: `ApiError` (class, has `.status: number` and `.body: unknown`), `apiFetch<T>(path: string, options: { token: string; method?: string; body?: unknown }): Promise<T>` — consumed by every screen that talks to the backend.
- Produces TS types mirroring the backend's normalized JSON: `ClienteBusqueda`, `FichaCliente`, `Factura`, `Pedido`, `CandidatoBandeja`, `DecisionResponse`.

- [ ] **Step 1: Write the failing tests**

`src/api/client.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./client";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("agrega el header Authorization con el bearer token", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await apiFetch("/api/health", { token: "abc123" });

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer abc123");
  });

  it("arma la URL uniendo VITE_API_BASE_URL con el path", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch("/api/health", { token: "x" });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/api/health");
  });

  it("lanza ApiError con status y body cuando la respuesta no es 2xx", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Falta el header Authorization Bearer" }),
    });

    await expect(apiFetch("/api/clientes", { token: "x" })).rejects.toMatchObject({
      status: 401,
      body: { error: "Falta el header Authorization Bearer" },
    });
    await expect(apiFetch("/api/clientes", { token: "x" })).rejects.toBeInstanceOf(ApiError);
  });

  it("manda Content-Type y el body en JSON solo cuando se pasa un body", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch("/api/bandeja/pedidos/900011/decision", {
      token: "x",
      method: "POST",
      body: { decision: "approved" },
    });

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ decision: "approved" }));
  });

  it("un GET sin body no manda Content-Type ni body", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch("/api/health", { token: "x" });

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("nunca reintenta automaticamente ante un error", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "Error de SAP" }),
    });

    await expect(apiFetch("/api/health", { token: "x" })).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- client`
Expected: FAIL — `Cannot find module './client'`

- [ ] **Step 3: Write minimal implementation**

`src/api/types.ts`:
```ts
export interface ClienteBusqueda {
  card_code: string;
  card_name: string | null;
  numero_sn: string | null;
  moneda: string | null;
}

export interface FichaCliente {
  card_code: string;
  card_name: string | null;
  moneda: string | null;
  credit_limit: number | null;
  sin_limite: boolean;
  current_account_balance: number | null;
  open_orders_balance: number | null;
  valid: boolean | null;
  frozen: boolean | null;
  block_dunning: boolean | null;
  payment_block: boolean | null;
  numero_sn: string | null;
  email_cc: string | null;
  whatsapp_cc: string | null;
  clasificacion_cc: string | null;
  dias_tolerancia_cc: string | null;
  cuentas_relacionadas: FichaCliente[];
}

export interface Factura {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_due_date: string;
  doc_total: number;
}

export interface Pedido {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_total: number;
  confirmed: boolean | null;
  document_status: string | null;
}

export interface CandidatoBandeja {
  doc_entry: number | null;
  doc_num: number | null;
  doc_date: string | null;
  hora_pedido: string | null;
  card_code: string | null;
  card_name: string | null;
  nro_referencia_externa: string | null;
  moneda: string | null;
  importe: number | null;
  vendedor: string | null;
  cliente_suspendido: boolean | null;
  status_aprobacion: string | null;
  condicion_pago: string | null;
  comentarios: string | null;
}

export interface DecisionResponse {
  doc_entry: number;
  decision: "approved" | "rejected";
  sap_status: "no_ejecutado" | "ejecutado";
  activity_code: number | null;
  timestamp: string;
}
```

`src/api/client.ts`:
```ts
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Error de la API (status ${status})`);
    this.status = status;
    this.body = body;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ApiFetchOptions {
  token: string;
  method?: string;
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseBody = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(response.status, responseBody);
  }

  return responseBody as T;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- client`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/api/types.ts src/api/client.ts src/api/client.test.ts
git commit -m "feat: add API client and types matching the backend's normalized shapes"
```

---

### Task 4: Auth (MSAL wiring)

**Files:**
- Create: `src/auth/msalConfig.ts`, `src/auth/msalConfig.test.ts`, `src/auth/AuthProvider.tsx`, `src/auth/RequireAuth.tsx`, `src/auth/useAccessToken.ts`, `.env.test`

**Interfaces:**
- Produces: `msalConfig: Configuration`, `apiScope: string`, `AuthProvider` (component, wraps children in `MsalProvider`), `RequireAuth` (component, shows a login prompt when unauthenticated, renders children when authenticated), `useAccessToken()` (hook, returns an async `getAccessToken(): Promise<string>` using `acquireTokenSilent`) — consumed by `main.tsx`/`App.tsx` (Task 6) and by the Cliente 360/Bandeja screens (next plans) to get a token before calling `apiFetch`.

- [ ] **Step 1: Add the test-only env file**

`.env.test` (not secret — these are public tenant/client IDs, needed so `msalConfig.test.ts` is deterministic regardless of the developer's local `.env`):
```
VITE_ENTRA_TENANT_ID=17af3ac8-4b4c-4703-b52f-2f902d63af82
VITE_ENTRA_CLIENT_ID=2095b6bc-db66-4b95-97ad-7c569800a4c9
VITE_API_SCOPE=api://2095b6bc-db66-4b95-97ad-7c569800a4c9/access_as_user
```

- [ ] **Step 2: Write the failing test**

`src/auth/msalConfig.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { apiScope, msalConfig } from "./msalConfig";

describe("msalConfig", () => {
  it("arma la authority con el tenant id", () => {
    expect(msalConfig.auth.authority).toBe(
      "https://login.microsoftonline.com/17af3ac8-4b4c-4703-b52f-2f902d63af82"
    );
  });

  it("usa el clientId del App Registration", () => {
    expect(msalConfig.auth.clientId).toBe("2095b6bc-db66-4b95-97ad-7c569800a4c9");
  });

  it("expone el scope de la API", () => {
    expect(apiScope).toBe("api://2095b6bc-db66-4b95-97ad-7c569800a4c9/access_as_user");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- msalConfig`
Expected: FAIL — `Cannot find module './msalConfig'`

- [ ] **Step 4: Write the implementation**

`src/auth/msalConfig.ts`:
```ts
import type { Configuration } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_ENTRA_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : undefined,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const apiScope = import.meta.env.VITE_API_SCOPE as string;
```

`src/auth/AuthProvider.tsx`:
```tsx
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { useEffect, useState, type ReactNode } from "react";
import { msalConfig } from "./msalConfig";

const msalInstance = new PublicClientApplication(msalConfig);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
```

`src/auth/RequireAuth.tsx`:
```tsx
import { AuthenticatedTemplate, UnauthenticatedTemplate, useMsal } from "@azure/msal-react";
import type { ReactNode } from "react";
import { apiScope } from "./msalConfig";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { instance } = useMsal();

  function login() {
    instance.loginPopup({ scopes: [apiScope] });
  }

  return (
    <>
      <AuthenticatedTemplate>{children}</AuthenticatedTemplate>
      <UnauthenticatedTemplate>
        <div style={{ padding: 40 }}>
          <p>Necesitás iniciar sesión con tu cuenta de Pontyn.</p>
          <button onClick={login}>Iniciar sesión</button>
        </div>
      </UnauthenticatedTemplate>
    </>
  );
}
```

`src/auth/useAccessToken.ts`:
```ts
import { useMsal } from "@azure/msal-react";
import { apiScope } from "./msalConfig";

export function useAccessToken() {
  const { instance, accounts } = useMsal();

  return async function getAccessToken(): Promise<string> {
    const account = accounts[0];
    if (!account) {
      throw new Error("No hay una cuenta autenticada");
    }
    const result = await instance.acquireTokenSilent({ scopes: [apiScope], account });
    return result.accessToken;
  };
}
```

**Note for the implementer:** `AuthProvider`, `RequireAuth`, and `useAccessToken` are thin wrappers around `@azure/msal-react`/`@azure/msal-browser` — per this plan's Global Constraints, they are not unit-tested here (only `msalConfig`'s pure value construction is). Task 6 exercises `RequireAuth` indirectly through `App.test.tsx`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- msalConfig`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add .env.test src/auth/msalConfig.ts src/auth/msalConfig.test.ts src/auth/AuthProvider.tsx src/auth/RequireAuth.tsx src/auth/useAccessToken.ts
git commit -m "feat: add MSAL auth wiring (no proxy, direct SPA to Function calls)"
```

---

### Task 5: Shared components (AppShell, Table, StatusTag)

**Files:**
- Create: `src/components/AppShell.tsx`, `src/components/Table.tsx`, `src/components/Table.test.tsx`, `src/components/StatusTag.tsx`

**Interfaces:**
- Produces: `AppShell` (component, renders a light topbar with nav links to `/cliente-360` and `/bandeja`, plus `<Outlet/>` for the routed page — used by `App.tsx` in Task 6).
- Produces: `Table<T>` (generic component, props `columns: TableColumn<T>[]`, `rows: T[]`, `rowKey: (row: T) => string | number`; clicking a sortable column header toggles ascending/descending) — the shared ledger-row list used by the Cliente 360 and Bandeja plans.
- Produces: `StatusTag` (component, props `variant: "ok" | "caution" | "risk" | "neutral"`, renders a colored pill using the design tokens).

- [ ] **Step 1: Write the failing test**

`src/components/Table.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, type TableColumn } from "./Table";

interface Row {
  id: number;
  nombre: string;
  monto: number;
}

const rows: Row[] = [
  { id: 1, nombre: "Beta", monto: 100 },
  { id: 2, nombre: "Alfa", monto: 50 },
];

const columns: TableColumn<Row>[] = [
  { key: "nombre", header: "Nombre", render: (r) => r.nombre, sortValue: (r) => r.nombre },
  { key: "monto", header: "Monto", render: (r) => String(r.monto), sortValue: (r) => r.monto },
];

describe("Table", () => {
  it("ordena ascendente al hacer click en un header, y descendente en el segundo click", () => {
    render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} />);

    fireEvent.click(screen.getByText("Nombre"));
    let dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows[0].textContent).toContain("Alfa");

    fireEvent.click(screen.getByText("Nombre"));
    dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows[0].textContent).toContain("Beta");
  });

  it("una columna sin sortValue no reordena al hacer click", () => {
    const columnsSinOrden: TableColumn<Row>[] = [
      { key: "nombre", header: "Nombre", render: (r) => r.nombre },
    ];
    render(<Table columns={columnsSinOrden} rows={rows} rowKey={(r) => r.id} />);

    fireEvent.click(screen.getByText("Nombre"));
    const dataRows = screen.getAllByRole("row").slice(1);
    expect(dataRows[0].textContent).toContain("Beta");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Table`
Expected: FAIL — `Cannot find module './Table'`

- [ ] **Step 3: Write the implementation**

`src/components/Table.tsx`:
```tsx
import { useMemo, useState, type ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: "left" | "right";
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
}

export function Table<T>({ columns, rows, rowKey }: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (av < bv) return -1 * sortDir;
      if (av > bv) return 1 * sortDir;
      return 0;
    });
  }, [rows, sortKey, sortDir, columns]);

  function onHeaderClick(column: TableColumn<T>) {
    if (!column.sortValue) return;
    if (sortKey === column.key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(column.key);
      setSortDir(1);
    }
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              onClick={() => onHeaderClick(column)}
              style={{
                cursor: column.sortValue ? "pointer" : "default",
                textAlign: column.align ?? "left",
                borderBottom: "1px solid var(--color-line-strong)",
                padding: "8px 10px",
                fontSize: 11.5,
                color: "var(--color-muted)",
              }}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td
                key={column.key}
                style={{
                  textAlign: column.align ?? "left",
                  borderBottom: "1px solid var(--color-line)",
                  padding: "9px 10px",
                }}
              >
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

`src/components/StatusTag.tsx`:
```tsx
import type { ReactNode } from "react";

export type StatusTagVariant = "ok" | "caution" | "risk" | "neutral";

const VARIANT_STYLES: Record<StatusTagVariant, { background: string; color: string }> = {
  ok: { background: "var(--color-ok-soft)", color: "var(--color-ok)" },
  caution: { background: "var(--color-caution-soft)", color: "var(--color-caution)" },
  risk: { background: "var(--color-risk-soft)", color: "var(--color-risk)" },
  neutral: { background: "var(--color-paper)", color: "var(--color-muted)" },
};

export function StatusTag({
  variant,
  children,
}: {
  variant: StatusTagVariant;
  children: ReactNode;
}) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 20,
        ...VARIANT_STYLES[variant],
      }}
    >
      {children}
    </span>
  );
}
```

`src/components/AppShell.tsx`:
```tsx
import { useMsal } from "@azure/msal-react";
import { NavLink, Outlet } from "react-router-dom";

export function AppShell() {
  const { accounts } = useMsal();
  const nombre = accounts[0]?.name ?? accounts[0]?.username ?? "";

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          padding: "0 40px",
          height: 64,
          background: "var(--color-surface)",
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 19 }}>
          Pontyn
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          <NavLink to="/cliente-360" style={navLinkStyle}>
            Cliente 360
          </NavLink>
          <NavLink to="/bandeja" style={navLinkStyle}>
            Bandeja de autorización
          </NavLink>
        </nav>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>{nombre}</div>
      </header>
      <main style={{ padding: 28 }}>
        <Outlet />
      </main>
    </div>
  );
}

function navLinkStyle({ isActive }: { isActive: boolean }) {
  return {
    padding: "8px 14px",
    borderRadius: 6,
    textDecoration: "none",
    fontWeight: 500,
    fontSize: 13.5,
    color: isActive ? "var(--color-ink)" : "var(--color-muted)",
    background: isActive ? "var(--color-paper)" : "transparent",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- Table`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx src/components/Table.tsx src/components/Table.test.tsx src/components/StatusTag.tsx
git commit -m "feat: add shared AppShell, Table and StatusTag components"
```

---

### Task 6: Routes + final wiring

**Files:**
- Create: `src/routes/Cliente360Page.tsx`, `src/routes/BandejaPage.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/main.tsx`

**Interfaces:**
- Wires together every prior task's exports (`AuthProvider`, `RequireAuth`, `AppShell`, the two placeholder route pages) into the real app tree. This is the last task of this plan — the Cliente 360 and Bandeja plans replace the two placeholder page components with real content, without touching this wiring.

- [ ] **Step 1: Write the placeholder route pages**

`src/routes/Cliente360Page.tsx`:
```tsx
export function Cliente360Page() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Cliente 360</h1>
      <p style={{ color: "var(--color-muted)" }}>Próximamente.</p>
    </div>
  );
}
```

`src/routes/BandejaPage.tsx`:
```tsx
export function BandejaPage() {
  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Bandeja de autorización</h1>
      <p style={{ color: "var(--color-muted)" }}>Próximamente.</p>
    </div>
  );
}
```

- [ ] **Step 2: Update the failing test first**

Replace the whole content of `src/App.test.tsx` (this REPLACES Task 1's placeholder test — `App.tsx` now requires an MSAL context, so the old test would fail with a context error, not just a changed assertion):
```tsx
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import App from "./App";
import { msalConfig } from "./auth/msalConfig";

describe("App", () => {
  let pca: PublicClientApplication;

  beforeAll(async () => {
    pca = new PublicClientApplication(msalConfig);
    await pca.initialize();
  });

  it("muestra el prompt de login cuando no hay sesion iniciada", () => {
    render(
      <MsalProvider instance={pca}>
        <App />
      </MsalProvider>
    );
    expect(screen.getByText(/Iniciar sesión/i)).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- App`
Expected: FAIL — the current placeholder `App.tsx` renders `<div>Cuentas Corrientes</div>` with no MSAL context at all, so `screen.getByText(/Iniciar sesión/i)` throws "Unable to find an element".

- [ ] **Step 4: Write the real `App.tsx` and `main.tsx`**

`src/App.tsx` (replaces the Task 1 placeholder):
```tsx
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth } from "./auth/RequireAuth";
import { Cliente360Page } from "./routes/Cliente360Page";
import { BandejaPage } from "./routes/BandejaPage";

export default function App() {
  return (
    <BrowserRouter>
      <RequireAuth>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/cliente-360" replace />} />
            <Route path="cliente-360" element={<Cliente360Page />} />
            <Route path="bandeja" element={<BandejaPage />} />
          </Route>
        </Routes>
      </RequireAuth>
    </BrowserRouter>
  );
}
```

`src/main.tsx` (replaces the Task 1 placeholder):
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import "./design/tokens.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- App`
Expected: PASS (1 test)

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test`
Expected: every test across all 6 tasks passes.
Run: `npm run typecheck`
Expected: no errors.
Run: `npm run dev`, open `http://localhost:5173` — expect the "Iniciar sesión con tu cuenta de Pontyn" prompt (no crash). Manually verify the login button actually opens a Microsoft login popup (clicking it is enough — do not need to complete a real login for this task; that was already validated in the backend's spike).

- [ ] **Step 7: Commit**

```bash
git add src/routes/Cliente360Page.tsx src/routes/BandejaPage.tsx src/App.tsx src/App.test.tsx src/main.tsx
git commit -m "feat: wire routing, auth gate, and shell into the real app tree"
```

---

## Explicitly out of scope for this plan

- Real content for Cliente 360 and Bandeja — separate plans, independent of each other, both depending on this one.
- Deploying to Azure Static Web Apps.
- Adding the real SWA domain as a redirect URI on the App Registration (only `http://localhost:5173`-independent `window.location.origin` code is in place; the App Registration itself still only has `http://localhost:5173` registered).
