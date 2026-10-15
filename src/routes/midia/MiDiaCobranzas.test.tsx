import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CobranzaDeMiDia, MiDiaResponse, TareaMiDia } from "../../api/types";
import type { FeatureNombre } from "../../features/features";
import { MiDiaPage } from "./MiDiaPage";

// Entrega 2: "Cobranza coordinada" en Para hoy, solo con cobranza_programada.
// Sin ella (y sin la clave en la respuesta) Para hoy es el de siempre.

const featuresHabilitadas = new Set<FeatureNombre>();
const obtener = vi.fn();
vi.mock("../../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (nombre: FeatureNombre) => featuresHabilitadas.has(nombre),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: false,
  }),
}));
vi.mock("./useApiMiDia", () => ({
  useApiMiDia: () => ({
    obtener: () => obtener(),
    registro: { registrar: vi.fn(), obtenerResultados: vi.fn().mockResolvedValue([]) },
  }),
}));

function tarea(parcial: Partial<TareaMiDia> = {}): TareaMiDia {
  return {
    id: 1,
    descripcion: "Llamar por la factura",
    fecha_objetivo: "2026-10-15",
    estado: "pendiente",
    responsable: "rlopez@pontyn.com.uy",
    creada_por: "rlopez@pontyn.com.uy",
    creada_utc: "2026-10-10T12:00:00Z",
    completada_utc: null,
    numero_sn: "00001",
    cliente_nombre: "Pinturas Norte",
    es_mia: true,
    card_code: "C1-00001",
    ...parcial,
  };
}

function cobranza(parcial: Partial<CobranzaDeMiDia> = {}): CobranzaDeMiDia {
  return {
    id: 3,
    numero_sn: "02928",
    card_code: "C1-02928",
    cliente_nombre: "Dulces del Sur",
    horario: "14 a 16 h",
    importe: 45000,
    moneda: "UYU",
    ...parcial,
  };
}

function respuesta(parcial: Partial<MiDiaResponse> = {}): MiDiaResponse {
  return {
    fecha: "2026-10-15",
    dia: "JUEVES",
    clientes_del_dia: null,
    tareas: [],
    promesas: [],
    alertas: { abiertas: 0, no_vistas: 0 },
    pedidos_bandeja: { pendientes: 0 },
    habilitadas: { promesas: false, alertas: false },
    errores: [],
    ...parcial,
  };
}

async function montar() {
  render(
    <MemoryRouter>
      <MiDiaPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(obtener).toHaveBeenCalled());
}

describe("Mi día: Para hoy sin cobranza_programada (como hoy)", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    obtener.mockReset();
  });

  it("sin la clave cobranzas, Para hoy muestra solo los recordatorios y ningún aviso nuevo", async () => {
    obtener.mockResolvedValue(respuesta({ tareas: [tarea()] }));
    await montar();
    const seccion = await screen.findByRole("region", { name: "Para hoy" });
    expect(within(seccion).getAllByRole("listitem")).toHaveLength(1);
    expect(within(seccion).getByText("Llamar por la factura")).toBeTruthy();
    expect(within(seccion).queryByText(/Cobranza coordinada/)).toBeNull();
    expect(within(seccion).queryByText(/cobranzas/)).toBeNull();
  });

  it("sin nada para hoy la sección no aparece", async () => {
    obtener.mockResolvedValue(respuesta());
    await montar();
    await waitFor(() => expect(screen.queryByText("Cargando Mi día...")).toBeNull());
    expect(screen.queryByRole("region", { name: "Para hoy" })).toBeNull();
  });

  it("aunque la respuesta trajera cobranzas, sin el flag no se muestran", async () => {
    obtener.mockResolvedValue(respuesta({ cobranzas: [cobranza()] }));
    await montar();
    await waitFor(() => expect(screen.queryByText("Cargando Mi día...")).toBeNull());
    expect(screen.queryByText(/Cobranza coordinada/)).toBeNull();
  });
});

describe("Mi día: Para hoy con cobranza_programada", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    featuresHabilitadas.add("cobranza_programada");
    obtener.mockReset();
  });

  it("muestra la cobranza con cliente, horario, número y Ver ficha", async () => {
    obtener.mockResolvedValue(respuesta({ cobranzas: [cobranza()] }));
    await montar();
    const seccion = await screen.findByRole("region", { name: "Para hoy" });
    const item = within(seccion).getByText("Cobranza coordinada:").closest("li")!;
    expect(within(item).getByText("Dulces del Sur")).toBeTruthy();
    expect(within(item).getByText(/14 a 16 h/)).toBeTruthy();
    expect(within(item).getByText("02928")).toBeTruthy();
    const enlace = within(item).getByRole("link", { name: "Ver ficha de Dulces del Sur" });
    expect(enlace.getAttribute("href")).toBe("/cliente-360?cliente=C1-02928");
    expect(enlace.className).toBe("midia-ficha");
  });

  it("sin horario no inventa uno", async () => {
    obtener.mockResolvedValue(respuesta({ cobranzas: [cobranza({ horario: null })] }));
    await montar();
    const seccion = await screen.findByRole("region", { name: "Para hoy" });
    const item = within(seccion).getByText("Cobranza coordinada:").closest("li")!;
    expect(item.textContent).not.toMatch(/ · /);
  });

  it("convive con los recordatorios y aparece aunque sea lo único", async () => {
    obtener.mockResolvedValue(respuesta({ tareas: [tarea()], cobranzas: [cobranza()] }));
    await montar();
    const seccion = await screen.findByRole("region", { name: "Para hoy" });
    expect(within(seccion).getAllByRole("listitem")).toHaveLength(2);
  });

  it("cobranzas vacías: la sección no aparece", async () => {
    obtener.mockResolvedValue(respuesta({ cobranzas: [] }));
    await montar();
    await waitFor(() => expect(screen.queryByText("Cargando Mi día...")).toBeNull());
    expect(screen.queryByRole("region", { name: "Para hoy" })).toBeNull();
  });

  it("cobranzas null (falló): aviso como el de las promesas, y el resto de Para hoy se ve", async () => {
    obtener.mockResolvedValue(respuesta({ tareas: [tarea()], cobranzas: null, errores: ["cobranzas"] }));
    await montar();
    const seccion = await screen.findByRole("region", { name: "Para hoy" });
    expect(within(seccion).getByText("No se pudieron cargar las cobranzas coordinadas.")).toBeTruthy();
    expect(within(seccion).getByText("Llamar por la factura")).toBeTruthy();
  });

  it("cobranzas null sin nada más: igual muestra el aviso", async () => {
    obtener.mockResolvedValue(respuesta({ cobranzas: null, errores: ["cobranzas"] }));
    await montar();
    expect(await screen.findByText("No se pudieron cargar las cobranzas coordinadas.")).toBeTruthy();
  });
});
