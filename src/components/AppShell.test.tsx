import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Alerta, AlertasResponse } from "../api/types";
import type { FeatureNombre } from "../features/features";
import { AppShell } from "./AppShell";

// Fase 2 CRM: la campana existe solo con la funcionalidad "alertas"
// habilitada; sin ella no se monta y no hay fetch a /api/alertas.

const featuresHabilitadas = new Set<FeatureNombre>();
let piloto = false;
const apiFetch = vi.fn();

vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: { getActiveAccount: () => ({ name: "Rosina López" }), logoutPopup: () => Promise.resolve() },
    accounts: [],
  }),
}));
vi.mock("../api/client", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }));
vi.mock("../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("../features/FeaturesContext", () => ({
  FeaturesProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useFeatures: () => ({
    habilitada: (nombre: FeatureNombre) => featuresHabilitadas.has(nombre),
    enPiloto: () => piloto,
    esSupervisor: false,
    cargando: false,
  }),
}));

function alerta(parcial: Partial<Alerta> = {}): Alerta {
  return {
    id: 7,
    tipo: "pedido_bloqueado",
    descripcion: "Pedido 1146083 de Ferretería Norte bloqueado por deuda vencida · $ 12.345,00",
    card_code: "C1-17453",
    numero_sn: null,
    entidad_ref: "pedido:1400895",
    fecha_utc: new Date(Date.now() - 20 * 60_000).toISOString(),
    estado: "nueva",
    vista_por: null,
    vista_utc: null,
    resuelta_por: null,
    resuelta_utc: null,
    ...parcial,
  };
}

function respuesta(parcial: Partial<AlertasResponse> = {}): AlertasResponse {
  return { no_vistas: 0, abiertas: [], resueltas_recientes: [], equipo: [], ...parcial };
}

function Ubicacion() {
  const location = useLocation();
  return <div data-testid="ubicacion">{location.pathname + location.search}</div>;
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={["/cliente-360"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<Ubicacion />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function llamadasA(path: string) {
  return apiFetch.mock.calls.filter(([p]) => p === path);
}

describe("AppShell — campana de alertas", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    piloto = false;
    apiFetch.mockReset();
  });

  it("sin la funcionalidad no hay campana ni fetch de alertas", async () => {
    renderShell();
    expect(screen.queryByRole("button", { name: /Alertas/ })).toBeNull();
    await act(async () => {});
    expect(llamadasA("/api/alertas")).toHaveLength(0);
  });

  it("con la funcionalidad aparece la campana con el badge de no vistas", async () => {
    featuresHabilitadas.add("alertas");
    apiFetch.mockResolvedValue(respuesta({ no_vistas: 3, abiertas: [alerta()] }));
    renderShell();

    const campana = await screen.findByRole("button", { name: "Alertas: 3 nuevas" });
    expect(campana.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("alertas-badge").textContent).toBe("3");
    expect(llamadasA("/api/alertas")).toHaveLength(1);
  });

  it("sin alertas nuevas no muestra badge; más de 99 muestra 99+", async () => {
    featuresHabilitadas.add("alertas");
    apiFetch.mockResolvedValueOnce(respuesta({ no_vistas: 0 }));
    const { unmount } = renderShell();
    await screen.findByRole("button", { name: "Alertas: sin nuevas" });
    expect(screen.queryByTestId("alertas-badge")).toBeNull();
    unmount();

    apiFetch.mockResolvedValueOnce(respuesta({ no_vistas: 150 }));
    renderShell();
    await screen.findByRole("button", { name: "Alertas: 150 nuevas" });
    expect(screen.getByTestId("alertas-badge").textContent).toBe("99+");
  });

  it("abre el panel, muestra la lista y se cierra con Esc", async () => {
    featuresHabilitadas.add("alertas");
    piloto = true;
    apiFetch.mockResolvedValue(
      respuesta({
        no_vistas: 1,
        abiertas: [
          alerta(),
          alerta({ id: 8, tipo: "pedido_reabierto", estado: "vista", descripcion: "Pedido 1146090 (C1-2) autorizado después de haber sido rechazado · rlopez@pontyn.com.uy" }),
        ],
        resueltas_recientes: [
          alerta({ id: 5, estado: "resuelta", resuelta_por: "CGomez@pontyn.com.uy", resuelta_utc: new Date().toISOString() }),
          alerta({ id: 4, estado: "resuelta", resuelta_por: "sistema", resuelta_utc: new Date().toISOString() }),
        ],
        equipo: [{ upn: "cgomez@pontyn.com.uy", nombre: "Claudia Gómez" }],
      })
    );
    renderShell();
    const campana = await screen.findByRole("button", { name: "Alertas: 1 nueva" });

    fireEvent.click(campana);
    expect(campana.getAttribute("aria-expanded")).toBe("true");
    const panel = screen.getByRole("dialog", { name: "Alertas" });
    expect(panel.textContent).toContain("Piloto");
    expect(panel.textContent).toContain("Pedido bloqueado");
    expect(panel.textContent).toContain("Pedido reautorizado");
    expect(panel.textContent).toContain("hace 20 min");
    expect(panel.textContent).toContain("Resuelta por Claudia Gómez");
    expect(panel.textContent).toContain("El pedido ya no está bloqueado");
    expect(screen.getByRole("button", { name: "Marcar todas como vistas" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(campana.getAttribute("aria-expanded")).toBe("false");
  });

  it("se cierra con clic afuera", async () => {
    featuresHabilitadas.add("alertas");
    apiFetch.mockResolvedValue(respuesta());
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: /Alertas/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId("ubicacion"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("estado vacío: explica cuándo va a aparecer algo y no ofrece marcar todas", async () => {
    featuresHabilitadas.add("alertas");
    apiFetch.mockResolvedValue(respuesta());
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: /Alertas/ }));
    expect(screen.getByText("No hay alertas abiertas.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Marcar todas como vistas" })).toBeNull();
  });

  it("'Ver pedido' marca la alerta como vista y navega a la Bandeja con el pedido", async () => {
    featuresHabilitadas.add("alertas");
    apiFetch.mockImplementation(async (path: string) =>
      path === "/api/alertas" ? respuesta({ no_vistas: 1, abiertas: [alerta()] }) : alerta({ estado: "vista" })
    );
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: /Alertas/ }));
    await screen.findByText(/Ferretería Norte/);

    fireEvent.click(screen.getByRole("button", { name: "Ver pedido" }));
    expect(screen.getByTestId("ubicacion").textContent).toBe("/bandeja?pedido=1400895");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith("/api/alertas/7", { token: "token", method: "PATCH", body: { estado: "vista" } })
    );
  });

  it("'Resolver' manda el PATCH y recarga la lista", async () => {
    featuresHabilitadas.add("alertas");
    apiFetch.mockImplementation(async (path: string) =>
      path === "/api/alertas" ? respuesta({ no_vistas: 0, abiertas: [alerta({ estado: "vista" })] }) : {}
    );
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: /Alertas/ }));
    await screen.findByText(/Ferretería Norte/);

    fireEvent.click(screen.getByRole("button", { name: "Resolver" }));
    await waitFor(() => expect(llamadasA("/api/alertas")).toHaveLength(2));
    expect(apiFetch).toHaveBeenCalledWith("/api/alertas/7", { token: "token", method: "PATCH", body: { estado: "resuelta" } });
  });
});

describe("AppShell — panel de alertas en celular", () => {
  const original = window.matchMedia;
  let esCelular = false;

  beforeEach(() => {
    featuresHabilitadas.clear();
    featuresHabilitadas.add("alertas");
    piloto = false;
    apiFetch.mockReset();
    apiFetch.mockResolvedValue(respuesta({ no_vistas: 1, abiertas: [alerta()] }));
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(max-width: 720px)" && esCelular,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  async function abrirPanel() {
    renderShell();
    fireEvent.click(await screen.findByRole("button", { name: /Alertas/ }));
    await screen.findByText(/Ferretería Norte/);
    return screen.getByRole("dialog", { name: "Alertas" });
  }

  it("en escritorio no es modal ni atrapa el foco", async () => {
    esCelular = false;
    const panel = await abrirPanel();
    expect(panel.getAttribute("aria-modal")).toBeNull();

    const botones = panel.querySelectorAll<HTMLButtonElement>("button");
    const ultimo = botones[botones.length - 1];
    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(ultimo);
  });

  it("en celular es modal y el Tab da la vuelta dentro del panel", async () => {
    esCelular = true;
    const panel = await abrirPanel();
    expect(panel.getAttribute("aria-modal")).toBe("true");

    const botones = panel.querySelectorAll<HTMLButtonElement>("button");
    const primero = botones[0];
    const ultimo = botones[botones.length - 1];

    ultimo.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(primero);

    primero.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(ultimo);
  });

  it("en celular, si el foco quedó afuera, Tab lo devuelve al panel", async () => {
    esCelular = true;
    const panel = await abrirPanel();
    screen.getByRole("button", { name: "Cerrar sesión" }).focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(panel.contains(document.activeElement)).toBe(true);
  });
});
