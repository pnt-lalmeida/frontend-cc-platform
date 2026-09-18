# Cliente 360 (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real Cliente 360 screen — search-as-you-type, ficha with a risk summary, related-account tabs, and stacked facturas/pedidos tables — replacing the foundation's placeholder page, on top of the already-deployed and already-validated backend.

**Architecture:** Small, independently-testable pure-logic modules (`facturas.ts`, `riesgo.ts`, `useClienteSearch.ts`) feed a single orchestration hook (`useFichaCliente.ts`) that `Cliente360Page.tsx` wires into the shared `Table`/`StatusTag` components from the foundation.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library (already set up by the foundation plan).

**Spec:** `docs/superpowers/specs/2026-09-18-cliente-360-frontend-design.md`

## Global Constraints

- The four backend endpoints are exact and already validated — do not invent alternate paths or shapes: `GET /api/clientes?q=<texto>` → `{ clientes: ClienteBusqueda[] }`; `GET /api/clientes/{card_code}` → `FichaCliente` (raw object, not wrapped); `GET /api/clientes/{card_code}/facturas` → `{ facturas: Factura[] }`; `GET /api/clientes/{card_code}/pedidos` → `{ pedidos: Pedido[] }`.
- Every fetch goes through `apiFetch` (`src/api/client.ts`) with a token from `useAccessToken()` (`src/auth/useAccessToken.ts`) — never a bare `fetch`.
- Related accounts (`ficha.cuentas_relacionadas`) are **separate SAP accounts, never summed** — the UI must say so explicitly when more than one account exists (Architecture.md §5).
- `clasificacion_cc` (A/B/C) is always rendered with `StatusTag` variant `"neutral"` — never `"ok"`/`"risk"`/`"caution"` — its real meaning is unconfirmed (Architecture.md §6, a documented case where `"A"` did not mean "best client").
- A due date equal to today is never "vencida" — only a due date strictly before today's calendar day counts. Compare calendar days via UTC getters (matches `formatDate`'s existing UTC convention), not exact timestamps.
- Money/dates always render through the foundation's `formatMoney`/`formatDate` (`src/design/format.ts`) — never a raw number or a hand-rolled date string.
- Empty `facturas`/`pedidos` render an explicit message, never a bare table with a header and no rows.
- No new dependencies — debounce is a plain `setTimeout`/`clearTimeout`, no library.
- Cheques data is explicitly out of scope — do not add any UI or type for it.

## File Structure

```
frontend-cc-platform/
  src/
    api/
      types.ts                      (modified — 3 response-envelope types added)
    routes/
      Cliente360Page.tsx             (rewritten — replaces the foundation's placeholder)
      cliente360/
        facturas.ts
        facturas.test.ts
        riesgo.ts
        riesgo.test.ts
        useClienteSearch.ts
        useClienteSearch.test.ts
        useFichaCliente.ts
```

---

### Task 1: Response-envelope types

**Files:**
- Modify: `src/api/types.ts`

**Interfaces:**
- Produces: `ClientesResponse { clientes: ClienteBusqueda[] }`, `FacturasResponse { facturas: Factura[] }`, `PedidosResponse { pedidos: Pedido[] }` — consumed by Tasks 5 and 6.

- [ ] **Step 1: Add the three types**

Append to the end of `src/api/types.ts` (all four existing interfaces — `ClienteBusqueda`, `FichaCliente`, `Factura`, `Pedido`, `CandidatoBandeja`, `DecisionResponse` — stay exactly as they are):

```ts
export interface ClientesResponse {
  clientes: ClienteBusqueda[];
}

export interface FacturasResponse {
  facturas: Factura[];
}

export interface PedidosResponse {
  pedidos: Pedido[];
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors (pure type additions, nothing consumes them yet).

- [ ] **Step 3: Commit**

```bash
git add src/api/types.ts
git commit -m "feat: add response-envelope types for Cliente 360 endpoints"
```

---

### Task 2: `facturaVencida` helper

**Files:**
- Create: `src/routes/cliente360/facturas.ts`, `src/routes/cliente360/facturas.test.ts`

**Interfaces:**
- Produces: `facturaVencida(docDueDate: string, hoy?: Date): boolean` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

`src/routes/cliente360/facturas.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { facturaVencida } from "./facturas";

describe("facturaVencida", () => {
  it("una fecha de vencimiento anterior a hoy esta vencida", () => {
    const hoy = new Date("2026-09-18T12:00:00Z");
    expect(facturaVencida("2026-09-17T00:00:00Z", hoy)).toBe(true);
  });

  it("una fecha de vencimiento de hoy no esta vencida", () => {
    const hoy = new Date("2026-09-18T12:00:00Z");
    expect(facturaVencida("2026-09-18T00:00:00Z", hoy)).toBe(false);
  });

  it("una fecha de vencimiento futura no esta vencida", () => {
    const hoy = new Date("2026-09-18T12:00:00Z");
    expect(facturaVencida("2026-09-20T00:00:00Z", hoy)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- facturas`
Expected: FAIL — `Cannot find module './facturas'`

- [ ] **Step 3: Write minimal implementation**

`src/routes/cliente360/facturas.ts`:
```ts
export function facturaVencida(docDueDate: string, hoy: Date = new Date()): boolean {
  const vencimiento = new Date(docDueDate);
  const vencimientoUTC = Date.UTC(
    vencimiento.getUTCFullYear(),
    vencimiento.getUTCMonth(),
    vencimiento.getUTCDate()
  );
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return vencimientoUTC < hoyUTC;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- facturas`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/cliente360/facturas.ts src/routes/cliente360/facturas.test.ts
git commit -m "feat: add facturaVencida helper for Cliente 360"
```

---

### Task 3: Risk summary builder

**Files:**
- Create: `src/routes/cliente360/riesgo.ts`, `src/routes/cliente360/riesgo.test.ts`

**Interfaces:**
- Produces: `RiesgoTag { key: string; label: string; variant: StatusTagVariant }`, `construirResumenRiesgo(ficha: FichaCliente): RiesgoTag[]` — consumed by Task 6.
- Consumes: `FichaCliente` (`src/api/types.ts`, already exists), `StatusTagVariant` (`src/components/StatusTag.tsx`, already exists).

- [ ] **Step 1: Write the failing tests**

`src/routes/cliente360/riesgo.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import type { FichaCliente } from "../../api/types";
import { construirResumenRiesgo } from "./riesgo";

function fichaBase(overrides: Partial<FichaCliente> = {}): FichaCliente {
  return {
    card_code: "C1-11391",
    card_name: "Cliente de prueba",
    moneda: "UYU",
    credit_limit: 100000,
    sin_limite: false,
    current_account_balance: 0,
    open_orders_balance: 0,
    valid: true,
    frozen: false,
    block_dunning: false,
    payment_block: false,
    numero_sn: "11391",
    email_cc: null,
    whatsapp_cc: null,
    clasificacion_cc: null,
    dias_tolerancia_cc: null,
    cuentas_relacionadas: [],
    ...overrides,
  };
}

describe("construirResumenRiesgo", () => {
  it("marca bloqueado cuando payment_block es true", () => {
    const tags = construirResumenRiesgo(fichaBase({ payment_block: true }));
    expect(tags).toContainEqual({ key: "payment_block", label: "Bloqueado", variant: "risk" });
  });

  it("marca congelado cuando frozen es true", () => {
    const tags = construirResumenRiesgo(fichaBase({ frozen: true }));
    expect(tags).toContainEqual({ key: "frozen", label: "Congelado", variant: "risk" });
  });

  it("marca sobre limite cuando el saldo total supera el credit_limit", () => {
    const tags = construirResumenRiesgo(
      fichaBase({ credit_limit: 1000, current_account_balance: 800, open_orders_balance: 500 })
    );
    expect(tags).toContainEqual({ key: "sobre_limite", label: "Sobre límite de crédito", variant: "risk" });
  });

  it("no marca sobre limite cuando el saldo total esta dentro del limite", () => {
    const tags = construirResumenRiesgo(
      fichaBase({ credit_limit: 1000, current_account_balance: 200, open_orders_balance: 100 })
    );
    expect(tags.find((t) => t.key === "sobre_limite")).toBeUndefined();
  });

  it("marca sin limite cuando sin_limite es true, sin evaluar el saldo", () => {
    const tags = construirResumenRiesgo(fichaBase({ sin_limite: true, credit_limit: null }));
    expect(tags).toContainEqual({ key: "sin_limite", label: "Sin límite", variant: "ok" });
    expect(tags.find((t) => t.key === "sobre_limite")).toBeUndefined();
  });

  it("la clasificacion siempre es variante neutral, nunca ok o risk", () => {
    const tags = construirResumenRiesgo(fichaBase({ clasificacion_cc: "A" }));
    expect(tags).toContainEqual({ key: "clasificacion", label: "Clasificación A", variant: "neutral" });
  });

  it("no agrega tag de clasificacion cuando no hay clasificacion_cc", () => {
    const tags = construirResumenRiesgo(fichaBase({ clasificacion_cc: null }));
    expect(tags.find((t) => t.key === "clasificacion")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- riesgo`
Expected: FAIL — `Cannot find module './riesgo'`

- [ ] **Step 3: Write minimal implementation**

`src/routes/cliente360/riesgo.ts`:
```ts
import type { FichaCliente } from "../../api/types";
import type { StatusTagVariant } from "../../components/StatusTag";

export interface RiesgoTag {
  key: string;
  label: string;
  variant: StatusTagVariant;
}

export function construirResumenRiesgo(ficha: FichaCliente): RiesgoTag[] {
  const tags: RiesgoTag[] = [];

  if (ficha.payment_block) {
    tags.push({ key: "payment_block", label: "Bloqueado", variant: "risk" });
  }
  if (ficha.frozen) {
    tags.push({ key: "frozen", label: "Congelado", variant: "risk" });
  }

  if (ficha.sin_limite) {
    tags.push({ key: "sin_limite", label: "Sin límite", variant: "ok" });
  } else if (ficha.credit_limit !== null) {
    const saldoTotal = (ficha.current_account_balance ?? 0) + (ficha.open_orders_balance ?? 0);
    if (saldoTotal > ficha.credit_limit) {
      tags.push({ key: "sobre_limite", label: "Sobre límite de crédito", variant: "risk" });
    }
  }

  if (ficha.clasificacion_cc) {
    tags.push({
      key: "clasificacion",
      label: `Clasificación ${ficha.clasificacion_cc}`,
      variant: "neutral",
    });
  }

  return tags;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- riesgo`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/cliente360/riesgo.ts src/routes/cliente360/riesgo.test.ts
git commit -m "feat: add risk summary builder for Cliente 360 (neutral classification tag)"
```

---

### Task 4: `useClienteSearch` hook

**Files:**
- Create: `src/routes/cliente360/useClienteSearch.ts`, `src/routes/cliente360/useClienteSearch.test.ts`

**Interfaces:**
- Produces: `useClienteSearch(buscar: (query: string) => Promise<ClienteBusqueda[]>, delayMs?: number): { query: string; setQuery: (q: string) => void; resultados: ClienteBusqueda[]; loading: boolean }` — consumed by Task 6, which supplies the real `buscar` function (wired to `apiFetch`/`useAccessToken`).
- Consumes: `ClienteBusqueda` (`src/api/types.ts`, already exists).

- [ ] **Step 1: Write the failing tests**

`src/routes/cliente360/useClienteSearch.test.ts`:
```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useClienteSearch } from "./useClienteSearch";

describe("useClienteSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no dispara la busqueda antes de que pase el debounce", () => {
    const buscar = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useClienteSearch(buscar));

    act(() => {
      result.current.setQuery("mer");
    });
    expect(buscar).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("dispara la busqueda una sola vez tras varios cambios rapidos de texto", async () => {
    const buscar = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useClienteSearch(buscar));

    act(() => {
      result.current.setQuery("m");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setQuery("me");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setQuery("mer");
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith("mer");
  });

  it("vacia los resultados y no busca cuando el texto queda vacio", () => {
    const buscar = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useClienteSearch(buscar));

    act(() => {
      result.current.setQuery("");
    });

    expect(buscar).not.toHaveBeenCalled();
    expect(result.current.resultados).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useClienteSearch`
Expected: FAIL — `Cannot find module './useClienteSearch'`

- [ ] **Step 3: Write minimal implementation**

`src/routes/cliente360/useClienteSearch.ts`:
```ts
import { useEffect, useState } from "react";
import type { ClienteBusqueda } from "../../api/types";

export function useClienteSearch(
  buscar: (query: string) => Promise<ClienteBusqueda[]>,
  delayMs = 300
) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ClienteBusqueda[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResultados([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(() => {
      buscar(query)
        .then(setResultados)
        .finally(() => setLoading(false));
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [query, buscar, delayMs]);

  return { query, setQuery, resultados, loading };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useClienteSearch`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/cliente360/useClienteSearch.ts src/routes/cliente360/useClienteSearch.test.ts
git commit -m "feat: add debounced useClienteSearch hook for Cliente 360"
```

---

### Task 5: `useFichaCliente` orchestration hook

**Files:**
- Create: `src/routes/cliente360/useFichaCliente.ts`

**Interfaces:**
- Produces: `useFichaCliente(cardCode: string | null): { ficha: FichaCliente | null; facturas: Factura[]; pedidos: Pedido[]; loading: boolean; error: string | null }` — consumed by Task 6.
- Consumes: `apiFetch` (`src/api/client.ts`), `useAccessToken` (`src/auth/useAccessToken.ts`), `FichaCliente`/`Factura`/`Pedido`/`FacturasResponse`/`PedidosResponse` (`src/api/types.ts`).

**Note for the implementer:** per this plan's spec, this hook is NOT unit-tested — it is pure orchestration of three network calls with no branching logic of its own (the branching logic already has its own tests in Tasks 2-4). It is verified manually via `npm run dev` in Task 6, the same scope decision the foundation plan made for its own thin wrapper hooks/components (`AuthProvider`, `RequireAuth`).

- [ ] **Step 1: Write the implementation directly (no test for this file)**

`src/routes/cliente360/useFichaCliente.ts`:
```ts
import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { FacturasResponse, Factura, FichaCliente, Pedido, PedidosResponse } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";

interface EstadoFicha {
  ficha: FichaCliente | null;
  facturas: Factura[];
  pedidos: Pedido[];
  loading: boolean;
  error: string | null;
}

const ESTADO_VACIO: EstadoFicha = {
  ficha: null,
  facturas: [],
  pedidos: [],
  loading: false,
  error: null,
};

export function useFichaCliente(cardCode: string | null): EstadoFicha {
  const getAccessToken = useAccessToken();
  const [estado, setEstado] = useState<EstadoFicha>(ESTADO_VACIO);

  useEffect(() => {
    if (!cardCode) {
      setEstado(ESTADO_VACIO);
      return;
    }

    let cancelado = false;
    setEstado((previo) => ({ ...previo, loading: true, error: null }));

    async function cargar() {
      try {
        const token = await getAccessToken();
        const [ficha, facturasResponse, pedidosResponse] = await Promise.all([
          apiFetch<FichaCliente>(`/api/clientes/${cardCode}`, { token }),
          apiFetch<FacturasResponse>(`/api/clientes/${cardCode}/facturas`, { token }),
          apiFetch<PedidosResponse>(`/api/clientes/${cardCode}/pedidos`, { token }),
        ]);
        if (cancelado) return;
        setEstado({
          ficha,
          facturas: facturasResponse.facturas,
          pedidos: pedidosResponse.pedidos,
          loading: false,
          error: null,
        });
      } catch {
        if (cancelado) return;
        setEstado({
          ficha: null,
          facturas: [],
          pedidos: [],
          loading: false,
          error: "No se pudo cargar la información del cliente.",
        });
      }
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [cardCode, getAccessToken]);

  return estado;
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/cliente360/useFichaCliente.ts
git commit -m "feat: add useFichaCliente orchestration hook (ficha+facturas+pedidos in parallel)"
```

---

### Task 6: `Cliente360Page.tsx` — wire everything together

**Files:**
- Modify: `src/routes/Cliente360Page.tsx` (replaces the foundation's placeholder content entirely)

**Interfaces:**
- Consumes everything from Tasks 1-5, plus `Table`/`TableColumn` (`src/components/Table.tsx`), `StatusTag` (`src/components/StatusTag.tsx`), `formatMoney`/`formatDate` (`src/design/format.ts`), `apiFetch` (`src/api/client.ts`), `useAccessToken` (`src/auth/useAccessToken.ts`) — all already exist from the foundation.
- This task produces no new interface — it is the final integration point.

- [ ] **Step 1: Write the page**

Replace the entire content of `src/routes/Cliente360Page.tsx`:
```tsx
import { useCallback, useState } from "react";
import { apiFetch } from "../api/client";
import type { ClienteBusqueda, ClientesResponse, Factura, Pedido } from "../api/types";
import { useAccessToken } from "../auth/useAccessToken";
import { StatusTag } from "../components/StatusTag";
import { Table, type TableColumn } from "../components/Table";
import { formatDate, formatMoney } from "../design/format";
import { facturaVencida } from "./cliente360/facturas";
import { construirResumenRiesgo } from "./cliente360/riesgo";
import { useClienteSearch } from "./cliente360/useClienteSearch";
import { useFichaCliente } from "./cliente360/useFichaCliente";

const FACTURA_COLUMNAS: TableColumn<Factura>[] = [
  { key: "doc_num", header: "N° factura", render: (f) => String(f.doc_num), sortValue: (f) => f.doc_num },
  { key: "doc_date", header: "Fecha", render: (f) => formatDate(f.doc_date), sortValue: (f) => f.doc_date },
  {
    key: "doc_due_date",
    header: "Vencimiento",
    render: (f) => formatDate(f.doc_due_date),
    sortValue: (f) => f.doc_due_date,
  },
  {
    key: "doc_total",
    header: "Importe",
    align: "right",
    render: (f) => formatMoney(f.doc_total),
    sortValue: (f) => f.doc_total,
  },
  {
    key: "estado",
    header: "Estado",
    render: (f) =>
      facturaVencida(f.doc_due_date) ? (
        <StatusTag variant="risk">Vencida</StatusTag>
      ) : (
        <StatusTag variant="ok">Al día</StatusTag>
      ),
  },
];

const PEDIDO_COLUMNAS: TableColumn<Pedido>[] = [
  { key: "doc_num", header: "N° pedido", render: (p) => String(p.doc_num), sortValue: (p) => p.doc_num },
  { key: "doc_date", header: "Fecha", render: (p) => formatDate(p.doc_date), sortValue: (p) => p.doc_date },
  {
    key: "doc_total",
    header: "Importe",
    align: "right",
    render: (p) => formatMoney(p.doc_total),
    sortValue: (p) => p.doc_total,
  },
  {
    key: "document_status",
    header: "Estado",
    render: (p) => <StatusTag variant="neutral">{p.document_status ?? "—"}</StatusTag>,
  },
];

export function Cliente360Page() {
  const getAccessToken = useAccessToken();
  const [cardCodeSeleccionado, setCardCodeSeleccionado] = useState<string | null>(null);

  const buscar = useCallback(
    async (query: string): Promise<ClienteBusqueda[]> => {
      const token = await getAccessToken();
      const respuesta = await apiFetch<ClientesResponse>(
        `/api/clientes?q=${encodeURIComponent(query)}`,
        { token }
      );
      return respuesta.clientes;
    },
    [getAccessToken]
  );

  const { query, setQuery, resultados, loading: buscando } = useClienteSearch(buscar);
  const { ficha, facturas, pedidos, loading: cargandoFicha, error } = useFichaCliente(cardCodeSeleccionado);

  const cuentas = ficha ? [ficha, ...ficha.cuentas_relacionadas] : [];

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Cliente 360</h1>

      <div style={{ position: "relative", maxWidth: 420 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o código..."
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--color-line-strong)",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        {resultados.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 6,
              zIndex: 1,
            }}
          >
            {resultados.map((cliente) => (
              <li key={cliente.card_code}>
                <button
                  onClick={() => {
                    setCardCodeSeleccionado(cliente.card_code);
                    setQuery("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {cliente.card_name} — {cliente.card_code} ({cliente.moneda ?? "—"})
                </button>
              </li>
            ))}
          </ul>
        )}
        {buscando && <p style={{ fontSize: 12.5, color: "var(--color-muted)" }}>Buscando...</p>}
      </div>

      {error && <p style={{ color: "var(--color-risk)" }}>{error}</p>}
      {cargandoFicha && <p style={{ color: "var(--color-muted)" }}>Cargando cliente...</p>}

      {ficha && (
        <div style={{ marginTop: 24 }}>
          {cuentas.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              {cuentas.map((cuenta) => (
                <button
                  key={cuenta.card_code}
                  onClick={() => setCardCodeSeleccionado(cuenta.card_code)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--color-line-strong)",
                    background:
                      cuenta.card_code === ficha.card_code ? "var(--color-paper)" : "var(--color-surface)",
                    cursor: "pointer",
                  }}
                >
                  {cuenta.moneda ?? cuenta.card_code}
                </button>
              ))}
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                cuenta separada, sin sumar con las otras
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {construirResumenRiesgo(ficha).map((tag) => (
              <StatusTag key={tag.key} variant={tag.variant}>
                {tag.label}
              </StatusTag>
            ))}
          </div>

          <p>
            <strong>{ficha.card_name}</strong> ({ficha.card_code})
          </p>
          <p>Saldo cta. cte.: {formatMoney(ficha.current_account_balance, ficha.moneda)}</p>
          <p>Saldo pedidos abiertos: {formatMoney(ficha.open_orders_balance, ficha.moneda)}</p>
          {ficha.dias_tolerancia_cc && <p>Días de tolerancia: {ficha.dias_tolerancia_cc}</p>}

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 24 }}>Facturas</h2>
          {facturas.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>Sin facturas pendientes.</p>
          ) : (
            <Table columns={FACTURA_COLUMNAS} rows={facturas} rowKey={(f) => f.doc_entry} />
          )}

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 24 }}>Pedidos</h2>
          {pedidos.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>Sin pedidos registrados.</p>
          ) : (
            <Table columns={PEDIDO_COLUMNAS} rows={pedidos} rowKey={(p) => p.doc_entry} />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the full suite and typecheck**

Run: `npm test`
Expected: every test across all 6 tasks passes (the foundation's own tests plus this plan's).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open `http://localhost:5173`.

Without logging in, expect the foundation's existing login prompt (Cliente 360 is behind `RequireAuth` — this page is never reached unauthenticated, so this step only confirms nothing crashes at build/import time).

**Real end-to-end verification (search returning real results, a real ficha loading with real facturas/pedidos) requires a human login** — same as the foundation's auth spike. Note this in your report rather than attempting to fake it; schedule that manual check with Líber after this task lands.

- [ ] **Step 4: Commit**

```bash
git add src/routes/Cliente360Page.tsx
git commit -m "feat: build the real Cliente 360 screen (search, ficha, risk summary, facturas/pedidos)"
```

---

## Explicitly out of scope for this plan

- Cheques data — pending Karen's own discovery of the real source/definition.
- The Bandeja de Autorización screen — separate plan.
- Deploying to Azure Static Web Apps — separate step, after this plan lands.
