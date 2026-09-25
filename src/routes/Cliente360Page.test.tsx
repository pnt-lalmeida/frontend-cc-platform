import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FichaCliente } from "../api/types";
import type { FeatureNombre } from "../features/features";
import { Cliente360Page } from "./Cliente360Page";

// Fase 3 CRM: la pestaña "Actividad" existe solo con la funcionalidad
// "bitacora" habilitada para el usuario; sin ella no se monta la Bitacora
// (y por lo tanto no hay fetch a /bitacora).

const featuresHabilitadas = new Set<FeatureNombre>();
const apiFetch = vi.fn();

vi.mock("../api/client", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock("../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("../auth/useUsuarioActual", () => ({ useUsuarioActual: () => "rlopez@pontyn.com.uy" }));
vi.mock("../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (nombre: FeatureNombre) => featuresHabilitadas.has(nombre),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: false,
  }),
}));

const ficha: FichaCliente = {
  card_code: "C1-17453",
  card_name: "Cliente de prueba",
  moneda: "$",
  credit_limit: 100000,
  sin_limite: false,
  current_account_balance: 0,
  open_orders_balance: 0,
  valid: true,
  frozen: false,
  block_dunning: false,
  payment_block: false,
  numero_sn: "17454",
  email_cc: null,
  whatsapp_cc: null,
  clasificacion_cc: "A",
  dias_tolerancia_cc: null,
  cheques_pendientes: null,
  condicion_pago: null,
  suspendido: false,
  zona_ctas_ctes: null,
  pagador_central: null,
  cuentas_relacionadas: [],
};

vi.mock("./cliente360/useClienteSearch", () => ({
  useClienteSearch: () => ({ query: "", setQuery: () => {}, resultados: [], loading: false, error: null }),
}));
vi.mock("./cliente360/useFichaCliente", () => ({
  useFichaCliente: () => ({
    ficha,
    facturas: [],
    pedidos: [],
    cheques: null,
    loading: false,
    error: null,
    recargar: () => {},
  }),
}));
vi.mock("./cliente360/useEstadoCuenta", () => ({
  useEstadoCuenta: () => ({
    filas: [
      {
        folio: "1",
        tipo: "Factura",
        moneda: "UYU",
        vendedor: null,
        fecha: "2020-01-01",
        vencimiento: "2020-02-01",
        saldo: 4200,
        saldo_corrido: 4200,
      },
    ],
    pagadorCentral: null,
    loading: false,
    error: null,
  }),
}));
vi.mock("./cliente360/useAutorizaciones", () => ({
  useAutorizaciones: () => ({ autorizaciones: [], loading: false, error: null }),
}));
vi.mock("./cliente360/BloqueComportamientoPago", () => ({ BloqueComportamientoPago: () => null }));
vi.mock("./cliente360/BitacoraActividad", () => ({
  BitacoraActividad: ({ cardCode }: { cardCode: string }) => <div data-testid="bitacora">{cardCode}</div>,
}));

describe("Cliente360Page — pestaña Actividad", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    apiFetch.mockReset();
  });

  it("sin la funcionalidad bitacora no aparece la pestaña ni se monta la Bitácora", () => {
    render(<Cliente360Page />);

    expect(screen.getByRole("button", { name: "Resumen" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Actividad" })).toBeNull();
    expect(screen.queryByTestId("bitacora")).toBeNull();
    expect(apiFetch.mock.calls.some(([url]) => String(url).includes("/bitacora"))).toBe(false);
  });

  it("con la funcionalidad habilitada aparece la pestaña y muestra la Bitácora del cliente", () => {
    featuresHabilitadas.add("bitacora");
    render(<Cliente360Page />);

    expect(screen.queryByTestId("bitacora")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Actividad" }));
    expect(screen.getByTestId("bitacora").textContent).toBe("C1-17453");
  });
});

describe("Cliente360Page — Situación de la cuenta y Antigüedad de saldos", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    apiFetch.mockReset();
  });

  it("sin las funcionalidades no aparecen ni se pide /situacion", async () => {
    render(<Cliente360Page />);

    expect(screen.queryByText("Antigüedad de saldos")).toBeNull();
    expect(screen.queryByRole("button", { name: /situación/i })).toBeNull();
    await Promise.resolve();
    expect(apiFetch.mock.calls.some(([url]) => String(url).includes("/situacion"))).toBe(false);
  });

  it("con las funcionalidades aparecen el control de situación y el bloque de antigüedad", async () => {
    featuresHabilitadas.add("situacion_cuenta");
    featuresHabilitadas.add("antiguedad_saldos");
    apiFetch.mockImplementation(async (url: string) =>
      String(url).includes("/situacion")
        ? {
            situacion: "Abogados",
            actualizada_por: null,
            actualizada_por_nombre: null,
            actualizada_utc: null,
            opciones: ["Abogados"],
          }
        : undefined
    );
    render(<Cliente360Page />);

    expect(screen.getByText("Antigüedad de saldos")).toBeTruthy();
    expect(screen.getByTestId("mayor-61-UYU").textContent).toBe("$ 4.200");
    expect(await screen.findByRole("button", { name: /situación: abogados/i })).toBeTruthy();
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/clientes/C1-17453/situacion", { token: "token" })
    );
  });
});
