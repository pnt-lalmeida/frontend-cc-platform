# Bandeja de Autorización (Frontend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real Bandeja de Autorización screen — a candidate queue, a detail panel, and an approve/reject form with no optimistic UI and a closed set of approval comments — replacing the placeholder page, on top of the already-complete and already-tested backend.

**Architecture:** A small extension to the shared `Table` component (optional row-click) enables the master/detail pattern already used in Cliente 360. Two small hooks — one for the candidate list, one for submitting a decision — feed `BandejaPage.tsx`. The decision hook takes its network call as an injected parameter (same pattern as the foundation's `useClienteSearch`), so its no-optimistic-UI and closed-set-comment behavior is fully unit-testable without mocking MSAL/fetch.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library (already set up).

**Spec:** `docs/superpowers/specs/2026-09-18-bandeja-frontend-design.md`

## Global Constraints

- The two backend endpoints are exact and already validated — do not invent alternate paths or shapes: `GET /api/bandeja/candidatos` → `{ candidatos: CandidatoBandeja[] }`; `POST /api/bandeja/pedidos/{doc_entry}/decision` — body `{ cardCode: string, docNum: number, decision: "approved" | "rejected", motivo?: string }`, response is `DecisionResponse` (all four types already exist in `src/api/types.ts` except the two added in Task 1).
- **No optimistic UI, ever.** A candidate is never removed or marked decided until the backend's response actually arrives and succeeds. The list is only ever updated by refetching it (`recargar()`), never by locally guessing the new state.
- **The approve comment is never free text.** It must be exactly one of `"Emitir estado de cuenta"`, `"Estado de cuenta"`, `"Carta"` — offered as radio buttons, never a textarea. Approving without picking one of the three must not send the request at all.
- **Reject never sends `motivo`.** The backend fixes the comment (`"No autorizar"`) on its own — the request body for a rejection must not include a `motivo` key at all.
- **Status colors reflect urgency, never resolution.** `"Pendiente"` → `StatusTag` variant `"caution"`. `"Rechazado"` → variant `"risk"` (more urgent than Pendiente, not less — it was already reviewed once and came back). Neither is ever `"ok"`. Any other/unknown value → `"neutral"`, never a guessed color.
- Every fetch goes through `apiFetch` with a token from `useAccessToken()` — never a bare `fetch`.
- Money/dates always render through `formatMoney`/`formatDate`.
- No new dependencies.

## File Structure

```
frontend-cc-platform/
  src/
    api/
      types.ts                      (modified — 2 types added)
    components/
      Table.tsx                     (modified — optional onRowClick prop)
      Table.test.tsx                (modified — regression test for onRowClick)
    routes/
      BandejaPage.tsx                (rewritten — replaces the placeholder)
      bandeja/
        estado.ts
        estado.test.ts
        useCandidatos.ts
        useDecision.ts
        useDecision.test.ts
```

---

### Task 1: Response/request types

**Files:**
- Modify: `src/api/types.ts`

**Interfaces:**
- Produces: `CandidatosResponse { candidatos: CandidatoBandeja[] }`, `DecisionRequest { cardCode: string; docNum: number; decision: "approved" | "rejected"; motivo?: string }` — consumed by Tasks 4, 5, 6. `CandidatoBandeja`/`DecisionResponse` already exist in this file and are not modified.

- [ ] **Step 1: Add the two types**

Append to the end of `src/api/types.ts`:

```ts
export interface CandidatosResponse {
  candidatos: CandidatoBandeja[];
}

export interface DecisionRequest {
  cardCode: string;
  docNum: number;
  decision: "approved" | "rejected";
  motivo?: string;
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/api/types.ts
git commit -m "feat: add response/request types for the Bandeja endpoints"
```

---

### Task 2: `variantParaEstadoBandeja` — status color mapper

**Files:**
- Create: `src/routes/bandeja/estado.ts`, `src/routes/bandeja/estado.test.ts`

**Interfaces:**
- Produces: `variantParaEstadoBandeja(statusAprobacion: string | null): StatusTagVariant` — consumed by Task 6.
- Consumes: `StatusTagVariant` (`src/components/StatusTag.tsx`, already exists).

- [ ] **Step 1: Write the failing tests**

`src/routes/bandeja/estado.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { variantParaEstadoBandeja } from "./estado";

describe("variantParaEstadoBandeja", () => {
  it("Pendiente es caution", () => {
    expect(variantParaEstadoBandeja("Pendiente")).toBe("caution");
  });

  it("Rechazado es risk (nunca resuelto, mas urgente que Pendiente)", () => {
    expect(variantParaEstadoBandeja("Rechazado")).toBe("risk");
  });

  it("nunca devuelve ok - un valor desconocido es neutral, no se inventa un color", () => {
    expect(variantParaEstadoBandeja("OK")).toBe("neutral");
    expect(variantParaEstadoBandeja("Zoho")).toBe("neutral");
  });

  it("null es neutral", () => {
    expect(variantParaEstadoBandeja(null)).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- estado`
Expected: FAIL — `Cannot find module './estado'`

- [ ] **Step 3: Write minimal implementation**

`src/routes/bandeja/estado.ts`:
```ts
import type { StatusTagVariant } from "../../components/StatusTag";

const ESTADOS_BANDEJA: Record<string, StatusTagVariant> = {
  Pendiente: "caution",
  Rechazado: "risk",
};

export function variantParaEstadoBandeja(statusAprobacion: string | null): StatusTagVariant {
  if (!statusAprobacion) {
    return "neutral";
  }
  return ESTADOS_BANDEJA[statusAprobacion] ?? "neutral";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- estado`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/bandeja/estado.ts src/routes/bandeja/estado.test.ts
git commit -m "feat: add Bandeja status-to-variant mapper (never ok, never guessed)"
```

---

### Task 3: `Table` — optional row click

**Files:**
- Modify: `src/components/Table.tsx`, `src/components/Table.test.tsx`

**Interfaces:**
- Produces: `Table`'s props gain an optional `onRowClick?: (row: T) => void`. When provided, each row becomes clickable (pointer cursor) and calls `onRowClick(row)` on click. When omitted, behavior is unchanged — existing callers (Cliente 360's Facturas/Pedidos/Estado de cuenta tables) are unaffected.

**Note for the implementer:** this is a small, backward-compatible addition to a shared foundation component. Do not change anything else about `Table.tsx` — no restructuring, no unrelated cleanup.

- [ ] **Step 1: Write the failing test**

Add to `src/components/Table.test.tsx` (keep the existing two tests exactly as they are; add this as a new test in the same `describe` block):

```tsx
it("llama a onRowClick con la fila correcta al hacer click, y no rompe nada si se omite", () => {
  const onRowClick = vi.fn();
  render(<Table columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />);

  fireEvent.click(screen.getAllByRole("row")[1]); // primera fila de datos (fila 0 es el header)

  expect(onRowClick).toHaveBeenCalledTimes(1);
  expect(onRowClick).toHaveBeenCalledWith(rows[0]);
});
```

(This requires `vi` to be imported in the test file — check the existing import line at the top of `Table.test.tsx` and add `vi` to it if it's not already there, e.g. `import { describe, expect, it, vi } from "vitest";`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- Table`
Expected: FAIL — `onRowClick` is not a valid prop / `onRowClick` was never called (depending on how TypeScript/the test runner reports it).

- [ ] **Step 3: Write minimal implementation**

In `src/components/Table.tsx`, add the optional prop to `TableProps<T>`:

```ts
interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
}
```

Update the function signature to destructure it:

```ts
export function Table<T>({ columns, rows, rowKey, onRowClick }: TableProps<T>) {
```

Update the row rendering (inside the `<tbody>` map) to apply it:

```tsx
{sortedRows.map((row) => (
  <tr
    key={rowKey(row)}
    onClick={onRowClick ? () => onRowClick(row) : undefined}
    style={{ cursor: onRowClick ? "pointer" : undefined }}
  >
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
```

(Everything else in the file — the header row, the sort logic, the column typing — stays exactly as it is.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- Table`
Expected: PASS (3 tests — the 2 existing sort tests plus the new one).

- [ ] **Step 5: Commit**

```bash
git add src/components/Table.tsx src/components/Table.test.tsx
git commit -m "feat: add optional onRowClick to the shared Table component"
```

---

### Task 4: `useCandidatos` — candidate list hook

**Files:**
- Create: `src/routes/bandeja/useCandidatos.ts`

**Interfaces:**
- Produces: `useCandidatos(): { candidatos: CandidatoBandeja[]; loading: boolean; error: string | null; recargar: () => void }` — consumed by Task 6. Calling `recargar()` triggers a fresh fetch (used after a decision succeeds — the list is always refetched, never edited locally, per the no-optimistic-UI constraint).
- Consumes: `apiFetch` (`src/api/client.ts`), `useAccessToken` (`src/auth/useAccessToken.ts`), `CandidatoBandeja`/`CandidatosResponse` (`src/api/types.ts`).

**Note for the implementer:** per this plan's spec, this hook is NOT unit-tested — it is pure orchestration of one network call with no branching logic of its own, same scope decision already made for the foundation's `useFichaCliente` and Cliente 360's `useEstadoCuenta`. It is verified manually in Task 6 via `npm run dev`.

- [ ] **Step 1: Write the implementation directly (no test for this file)**

`src/routes/bandeja/useCandidatos.ts`:
```ts
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { CandidatoBandeja, CandidatosResponse } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";

interface EstadoCandidatos {
  candidatos: CandidatoBandeja[];
  loading: boolean;
  error: string | null;
  recargar: () => void;
}

export function useCandidatos(): EstadoCandidatos {
  const getAccessToken = useAccessToken();
  const [candidatos, setCandidatos] = useState<CandidatoBandeja[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const respuesta = await apiFetch<CandidatosResponse>("/api/bandeja/candidatos", { token });
        if (cancelado) return;
        setCandidatos(respuesta.candidatos);
        setLoading(false);
      } catch {
        if (cancelado) return;
        setCandidatos([]);
        setError("No se pudo cargar la lista de pedidos.");
        setLoading(false);
      }
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [getAccessToken, version]);

  return { candidatos, loading, error, recargar };
}
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/bandeja/useCandidatos.ts
git commit -m "feat: add useCandidatos hook for the Bandeja candidate list"
```

---

### Task 5: `useDecision` — submit a decision, no optimistic UI

**Files:**
- Create: `src/routes/bandeja/useDecision.ts`, `src/routes/bandeja/useDecision.test.ts`

**Interfaces:**
- Produces: `OPCIONES_APROBAR: readonly ["Emitir estado de cuenta", "Estado de cuenta", "Carta"]`, `useDecision(postDecision): { enviando: boolean; error: string | null; decidir: (params) => Promise<DecisionResponse | null> }` — consumed by Task 6, which supplies the real `postDecision` function (wired to `apiFetch`/`useAccessToken`), mirroring the foundation's `useClienteSearch(buscar)` dependency-injection pattern so this hook is testable without mocking MSAL or `fetch`.
- `decidir`'s `params`: `{ docEntry: number; cardCode: string; docNum: number; decision: "approved" | "rejected"; motivo?: string }`. Returns the `DecisionResponse` on success, or `null` if the request was never sent (missing `motivo` on an approval) or if it failed.

- [ ] **Step 1: Write the failing tests**

`src/routes/bandeja/useDecision.test.ts`:
```ts
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDecision } from "./useDecision";

describe("useDecision", () => {
  it("no llama a postDecision si se aprueba sin elegir una opcion", async () => {
    const postDecision = vi.fn();
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({ docEntry: 1, cardCode: "C1-1", docNum: 1, decision: "approved" });
    });

    expect(postDecision).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it("al aprobar, manda exactamente cardCode/docNum/decision/motivo", async () => {
    const postDecision = vi.fn().mockResolvedValue({
      doc_entry: 900011, decision: "approved", sap_status: "no_ejecutado", activity_code: null, timestamp: "x",
    });
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({
        docEntry: 900011, cardCode: "C1-90011", docNum: 700011,
        decision: "approved", motivo: "Estado de cuenta",
      });
    });

    expect(postDecision).toHaveBeenCalledWith(900011, {
      cardCode: "C1-90011", docNum: 700011, decision: "approved", motivo: "Estado de cuenta",
    });
  });

  it("al rechazar, nunca manda motivo", async () => {
    const postDecision = vi.fn().mockResolvedValue({
      doc_entry: 900011, decision: "rejected", sap_status: "no_ejecutado", activity_code: null, timestamp: "x",
    });
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({ docEntry: 900011, cardCode: "C1-90011", docNum: 700011, decision: "rejected" });
    });

    const [, body] = postDecision.mock.calls[0];
    expect(body).toEqual({ cardCode: "C1-90011", docNum: 700011, decision: "rejected" });
    expect(body).not.toHaveProperty("motivo");
  });

  it("no asume exito antes de que la promesa resuelva - enviando es true durante la request", async () => {
    let resolver: (value: unknown) => void = () => {};
    const promesaControlada = new Promise((resolve) => {
      resolver = resolve;
    });
    const postDecision = vi.fn().mockReturnValue(promesaControlada);
    const { result } = renderHook(() => useDecision(postDecision));

    let promesaDecidir!: Promise<unknown>;
    act(() => {
      promesaDecidir = result.current.decidir({
        docEntry: 1, cardCode: "C1-1", docNum: 1, decision: "rejected",
      });
    });

    expect(result.current.enviando).toBe(true);

    await act(async () => {
      resolver({
        doc_entry: 1, decision: "rejected", sap_status: "no_ejecutado", activity_code: null, timestamp: "x",
      });
      await promesaDecidir;
    });

    expect(result.current.enviando).toBe(false);
  });

  it("si postDecision falla, expone un error y enviando vuelve a false", async () => {
    const postDecision = vi.fn().mockRejectedValue(new Error("fallo de red"));
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({ docEntry: 1, cardCode: "C1-1", docNum: 1, decision: "rejected" });
    });

    expect(result.current.enviando).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- useDecision`
Expected: FAIL — `Cannot find module './useDecision'`

- [ ] **Step 3: Write minimal implementation**

`src/routes/bandeja/useDecision.ts`:
```ts
import { useState } from "react";
import type { DecisionResponse } from "../../api/types";

export const OPCIONES_APROBAR = ["Emitir estado de cuenta", "Estado de cuenta", "Carta"] as const;

interface CuerpoDecision {
  cardCode: string;
  docNum: number;
  decision: "approved" | "rejected";
  motivo?: string;
}

interface ParametrosDecision {
  docEntry: number;
  cardCode: string;
  docNum: number;
  decision: "approved" | "rejected";
  motivo?: string;
}

interface EstadoDecision {
  enviando: boolean;
  error: string | null;
  decidir: (params: ParametrosDecision) => Promise<DecisionResponse | null>;
}

export function useDecision(
  postDecision: (docEntry: number, body: CuerpoDecision) => Promise<DecisionResponse>
): EstadoDecision {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decidir(params: ParametrosDecision): Promise<DecisionResponse | null> {
    if (params.decision === "approved" && !params.motivo) {
      setError("Elegí una opción antes de aprobar.");
      return null;
    }

    const body: CuerpoDecision =
      params.decision === "approved"
        ? { cardCode: params.cardCode, docNum: params.docNum, decision: params.decision, motivo: params.motivo }
        : { cardCode: params.cardCode, docNum: params.docNum, decision: params.decision };

    setEnviando(true);
    setError(null);
    try {
      const respuesta = await postDecision(params.docEntry, body);
      setEnviando(false);
      return respuesta;
    } catch {
      setEnviando(false);
      setError("No se pudo registrar la decisión. Intentá de nuevo.");
      return null;
    }
  }

  return { enviando, error, decidir };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- useDecision`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/routes/bandeja/useDecision.ts src/routes/bandeja/useDecision.test.ts
git commit -m "feat: add useDecision hook (no optimistic UI, closed-set approve comments)"
```

---

### Task 6: `BandejaPage.tsx` — wire everything together

**Files:**
- Modify: `src/routes/BandejaPage.tsx` (replaces the foundation's placeholder content entirely)

**Interfaces:**
- Consumes everything from Tasks 1-5, plus `Table`/`TableColumn` (now with `onRowClick`), `StatusTag`, `formatMoney`/`formatDate`, `apiFetch`, `useAccessToken` — all already exist.
- This task produces no new interface — it is the final integration point.

- [ ] **Step 1: Write the page**

Replace the entire content of `src/routes/BandejaPage.tsx`:
```tsx
import { useCallback, useState } from "react";
import { apiFetch } from "../api/client";
import type { CandidatoBandeja, DecisionResponse } from "../api/types";
import { useAccessToken } from "../auth/useAccessToken";
import { StatusTag } from "../components/StatusTag";
import { Table, type TableColumn } from "../components/Table";
import { formatDate, formatMoney } from "../design/format";
import { variantParaEstadoBandeja } from "./bandeja/estado";
import { useCandidatos } from "./bandeja/useCandidatos";
import { OPCIONES_APROBAR, useDecision } from "./bandeja/useDecision";

const COLUMNAS_CANDIDATOS: TableColumn<CandidatoBandeja>[] = [
  {
    key: "doc_num",
    header: "N° pedido",
    render: (c) => String(c.doc_num ?? "—"),
    sortValue: (c) => c.doc_num ?? 0,
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (c) => `${c.card_name ?? "—"} (${c.card_code ?? "—"})`,
  },
  {
    key: "importe",
    header: "Importe",
    align: "right",
    render: (c) => formatMoney(c.importe, c.moneda),
    sortValue: (c) => c.importe ?? 0,
  },
  { key: "vendedor", header: "Vendedor", render: (c) => c.vendedor ?? "—" },
  { key: "condicion_pago", header: "Cond. pago", render: (c) => c.condicion_pago ?? "—" },
  {
    key: "status_aprobacion",
    header: "Estado",
    render: (c) => (
      <StatusTag variant={variantParaEstadoBandeja(c.status_aprobacion)}>
        {c.status_aprobacion ?? "—"}
      </StatusTag>
    ),
  },
];

export function BandejaPage() {
  const getAccessToken = useAccessToken();
  const { candidatos, loading, error, recargar } = useCandidatos();
  const [seleccionado, setSeleccionado] = useState<CandidatoBandeja | null>(null);
  const [opcionAprobar, setOpcionAprobar] = useState<string | null>(null);

  const postDecision = useCallback(
    async (
      docEntry: number,
      body: { cardCode: string; docNum: number; decision: "approved" | "rejected"; motivo?: string }
    ): Promise<DecisionResponse> => {
      const token = await getAccessToken();
      return apiFetch<DecisionResponse>(`/api/bandeja/pedidos/${docEntry}/decision`, {
        token,
        method: "POST",
        body,
      });
    },
    [getAccessToken]
  );

  const { enviando, error: errorDecision, decidir } = useDecision(postDecision);

  async function aprobar() {
    if (!seleccionado || !opcionAprobar) return;
    if (seleccionado.doc_entry == null || seleccionado.doc_num == null) return;
    const resultado = await decidir({
      docEntry: seleccionado.doc_entry,
      cardCode: seleccionado.card_code ?? "",
      docNum: seleccionado.doc_num,
      decision: "approved",
      motivo: opcionAprobar,
    });
    if (resultado) {
      setSeleccionado(null);
      setOpcionAprobar(null);
      recargar();
    }
  }

  async function rechazar() {
    if (!seleccionado) return;
    if (seleccionado.doc_entry == null || seleccionado.doc_num == null) return;
    const resultado = await decidir({
      docEntry: seleccionado.doc_entry,
      cardCode: seleccionado.card_code ?? "",
      docNum: seleccionado.doc_num,
      decision: "rejected",
    });
    if (resultado) {
      setSeleccionado(null);
      recargar();
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Bandeja de autorización</h1>

      {error && <p style={{ color: "var(--color-risk)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--color-muted)" }}>Cargando pedidos...</p>}

      {!loading && !error && candidatos.length === 0 && (
        <p style={{ color: "var(--color-muted)" }}>No hay pedidos pendientes de autorización.</p>
      )}

      {!loading && candidatos.length > 0 && (
        <Table
          columns={COLUMNAS_CANDIDATOS}
          rows={candidatos}
          rowKey={(c) => c.doc_entry ?? c.doc_num ?? 0}
          onRowClick={(c) => {
            setSeleccionado(c);
            setOpcionAprobar(null);
          }}
        />
      )}

      {seleccionado && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            border: "1px solid var(--color-line)",
            borderRadius: 8,
            background: "var(--color-surface)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 0 }}>
            Pedido {seleccionado.doc_num} — {seleccionado.card_name}
          </h2>

          <p>Fecha: {formatDate(seleccionado.doc_date)} {seleccionado.hora_pedido ?? ""}</p>
          {seleccionado.nro_referencia_externa && (
            <p>Referencia externa: {seleccionado.nro_referencia_externa}</p>
          )}
          {seleccionado.cliente_suspendido && (
            <p>
              <StatusTag variant="risk">Cliente suspendido</StatusTag>
            </p>
          )}
          {seleccionado.comentarios && <p>Comentarios: {seleccionado.comentarios}</p>}

          <div style={{ marginTop: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Aprobar</p>
            {OPCIONES_APROBAR.map((opcion) => (
              <label key={opcion} style={{ display: "block", marginBottom: 4, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="opcion-aprobar"
                  value={opcion}
                  checked={opcionAprobar === opcion}
                  onChange={() => setOpcionAprobar(opcion)}
                  disabled={enviando}
                />{" "}
                {opcion}
              </label>
            ))}
          </div>

          {errorDecision && <p style={{ color: "var(--color-risk)" }}>{errorDecision}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={aprobar} disabled={enviando || !opcionAprobar}>
              {enviando ? "Aprobando..." : "Aprobar"}
            </button>
            <button onClick={rechazar} disabled={enviando}>
              {enviando ? "Rechazando..." : "Rechazar"}
            </button>
            <button onClick={() => setSeleccionado(null)} disabled={enviando}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the full suite and typecheck**

Run: `npm test`
Expected: every test across the whole project passes (foundation + Cliente 360 + this plan's).
Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, confirm the app still loads and shows the existing login prompt (this page is behind `RequireAuth`, same as Cliente 360 — never reached unauthenticated, so this only confirms nothing crashes at build/import time).

**Real end-to-end verification (clicking a real candidate, approving/rejecting against the real backend) requires a human login**, same as Cliente 360 and the foundation. Note this in your report rather than attempting to fake it.

- [ ] **Step 4: Commit**

```bash
git add src/routes/BandejaPage.tsx
git commit -m "feat: build the real Bandeja de Autorizacion screen (queue, detail, decision form)"
```

---

## Explicitly out of scope for this plan

- Any backend change — already complete and tested.
- Enabling `SAP_WRITE_ENABLED=true` — unrelated precondition, not resolved by this plan.
- Deploying to Azure Static Web Apps — next step after this plan, together with Cliente 360.
