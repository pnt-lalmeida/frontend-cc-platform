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
  moneda: "UYU",
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
const useFichaClienteMock = vi.fn((_cardCode: string | null) => ({
  ficha,
  facturas: [],
  pedidos: [],
  cheques: null,
  loading: false,
  error: null,
  recargar: () => {},
}));
vi.mock("./cliente360/useFichaCliente", () => ({
  useFichaCliente: (cardCode: string | null) => useFichaClienteMock(cardCode),
}));
const FILA_ESTADO_CUENTA_DEFAULT = {
  folio: "1",
  tipo: "Factura",
  moneda: "UYU",
  vendedor: null,
  fecha: "2020-01-01",
  vencimiento: "2020-02-01",
  saldo: 4200,
  saldo_corrido: 4200,
};
const useEstadoCuentaMock = vi.fn((_cardCode: string | null) => ({
  filas: [FILA_ESTADO_CUENTA_DEFAULT],
  pagadorCentral: null,
  loading: false,
  error: null,
}));
vi.mock("./cliente360/useEstadoCuenta", () => ({
  useEstadoCuenta: (cardCode: string | null) => useEstadoCuentaMock(cardCode),
}));
vi.mock("./cliente360/useAutorizaciones", () => ({
  useAutorizaciones: () => ({ autorizaciones: [], loading: false, error: null }),
}));
vi.mock("./cliente360/BloqueComportamientoPago", () => ({ BloqueComportamientoPago: () => null }));
vi.mock("./cliente360/BitacoraActividad", () => ({
  BitacoraActividad: ({ cardCode }: { cardCode: string }) => <div data-testid="bitacora">{cardCode}</div>,
}));

// Corre antes del beforeEach de cada describe: deja useFichaCliente/
// useEstadoCuenta en su default salvo que un describe los pise despues
// (evita que un mockReturnValue de un test se filtre a los siguientes).
beforeEach(() => {
  useFichaClienteMock.mockReturnValue({
    ficha, facturas: [], pedidos: [], cheques: null, loading: false, error: null, recargar: () => {},
  });
  useEstadoCuentaMock.mockReturnValue({ filas: [FILA_ESTADO_CUENTA_DEFAULT], pagadorCentral: null, loading: false, error: null });
});

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

// 28/09/2026: el estado Suspendido se ve siempre ("Suspendido: No/Sí", nunca
// "Activo"); cambiarlo requiere la funcionalidad "cambiar_suspendido".
describe("Cliente360Page — Suspendido", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    apiFetch.mockReset();
  });

  it("sin la funcionalidad muestra 'Suspendido: No' como etiqueta, sin poder cambiarlo", () => {
    render(<Cliente360Page />);

    expect(screen.getByText("Suspendido: No")).toBeTruthy();
    expect(screen.queryByText("Activo")).toBeNull();
    expect(screen.queryByRole("button", { name: /suspendido/i })).toBeNull();
  });

  it("con la funcionalidad la etiqueta es un botón que pide confirmación antes de suspender", () => {
    featuresHabilitadas.add("cambiar_suspendido");
    render(<Cliente360Page />);

    fireEvent.click(screen.getByRole("button", { name: /suspendido: no/i }));
    expect(screen.getByText(/¿Seguro que querés suspender a este cliente\?/)).toBeTruthy();
  });
});

// 28/09/2026: "Saldo cta. cte." y "Cuentas relacionadas" NO usan el campo
// crudo de SAP (current_account_balance, siempre en pesos) - se calculan
// sumando el Estado de cuenta filtrado a la moneda de cada cuenta. Dos bugs
// reales encontrados con captura de Liber:
// 1) "Cuentas relacionadas" seguia mostrando el campo crudo de SAP para las
//    cuentas relacionadas (solo se habia arreglado el tile de arriba).
// 2) el primer arreglo comparaba contra la clave equivocada ("$" en vez de
//    "UYU", que es lo que realmente manda el backend) - "Saldo cta. cte."
//    daba $0 al mirar la cuenta en pesos.
describe("Cliente360Page — Saldo cta. cte. y Cuentas relacionadas (multi-moneda)", () => {
  const fichaConCuentaUsd: FichaCliente = {
    ...ficha,
    numero_sn: "6958",
    cuentas_relacionadas: [{ ...ficha, card_code: "C2-06958", moneda: "USD", cuentas_relacionadas: [] }],
  };
  const filasMultiMoneda = [
    { ...FILA_ESTADO_CUENTA_DEFAULT, moneda: "UYU", saldo: 25535.85, saldo_corrido: 25535.85 },
    { ...FILA_ESTADO_CUENTA_DEFAULT, folio: "2", moneda: "USD", saldo: -16.96, saldo_corrido: -16.96 },
  ];

  beforeEach(() => {
    featuresHabilitadas.clear();
    apiFetch.mockReset();
    useEstadoCuentaMock.mockReturnValue({ filas: filasMultiMoneda, pagadorCentral: null, loading: false, error: null });
    useFichaClienteMock.mockReturnValue({
      ficha: fichaConCuentaUsd, facturas: [], pedidos: [], cheques: null, loading: false, error: null, recargar: () => {},
    });
  });

  it("Saldo cta. cte. suma el Estado de cuenta en la moneda de la cuenta seleccionada (UYU)", () => {
    render(<Cliente360Page />);

    // Antes del bug 2: "$0" (comparaba contra la clave equivocada, "$" en
    // vez de "UYU").
    expect(screen.getByTitle(/25\.535,85/)).toBeTruthy();
  });

  it("Cuentas relacionadas suma el Estado de cuenta en la moneda de cada cuenta, no el campo crudo de SAP", () => {
    render(<Cliente360Page />);

    // Antes del bug 1: mostraba ficha.current_account_balance (0, en este
    // fixture) en vez de la suma real del Estado de cuenta.
    expect(screen.getByText("US$ -16,96")).toBeTruthy();
  });
});

// 30/09/2026: "Comentarios" de la ficha SAP, solo lectura. Sin contenido no se
// dibuja nada (2 de cada 3 fichas no lo tienen).
describe("Cliente360Page — Comentarios", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    apiFetch.mockReset();
  });

  it("con comentarios los muestra, y siguen visibles al cambiar de pestaña", () => {
    useFichaClienteMock.mockReturnValue({
      ficha: { ...ficha, comentarios: "Paga a 30 dias\nAvisar por WhatsApp" },
      facturas: [], pedidos: [], cheques: null, loading: false, error: null, recargar: () => {},
    });
    render(<Cliente360Page />);

    expect(screen.getByTestId("comentarios-texto").textContent).toBe("Paga a 30 dias\nAvisar por WhatsApp");
    fireEvent.click(screen.getByRole("button", { name: "Facturas" }));
    expect(screen.getByTestId("comentarios-texto")).toBeTruthy();
  });

  it("sin comentarios (null) no dibuja el bloque", () => {
    useFichaClienteMock.mockReturnValue({
      ficha: { ...ficha, comentarios: null },
      facturas: [], pedidos: [], cheques: null, loading: false, error: null, recargar: () => {},
    });
    render(<Cliente360Page />);

    expect(screen.queryByTestId("comentarios-texto")).toBeNull();
    expect(screen.queryByText(/comentarios/i)).toBeNull();
  });
});
