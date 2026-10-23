import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MiDiaResponse, TareaMiDia } from "../../api/types";
import type { FeatureNombre } from "../../features/features";
import { MiDiaPage } from "./MiDiaPage";

// 23/10/2026, pedido del sector: "Cobranza programada no deberia aparecer en Mi dia, solo promesas y
// recordatorios". "Para hoy" NUNCA muestra cobranzas, ni con cobranza_programada habilitada ni aunque una
// respuesta (de un backend anterior, que todavia las mandaba) las traiga.

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

// Lo que mandaba el backend anterior a este cambio (el tipo ya no existe en el frontend).
function cobranza(parcial: Record<string, unknown> = {}) {
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

function respuesta(parcial: Partial<MiDiaResponse> & Record<string, unknown> = {}): MiDiaResponse {
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

describe("Mi día: Para hoy con cobranza_programada habilitada (NO muestra cobranzas)", () => {
  beforeEach(() => {
    featuresHabilitadas.clear();
    featuresHabilitadas.add("cobranza_programada");
    obtener.mockReset();
  });

  it("aunque la respuesta traiga cobranzas, Para hoy muestra solo promesas y recordatorios", async () => {
    obtener.mockResolvedValue(respuesta({ tareas: [tarea()], cobranzas: [cobranza()] }));
    await montar();
    const seccion = await screen.findByRole("region", { name: "Para hoy" });
    expect(within(seccion).getAllByRole("listitem")).toHaveLength(1);
    expect(within(seccion).getByText("Llamar por la factura")).toBeTruthy();
    expect(within(seccion).queryByText(/Cobranza coordinada/)).toBeNull();
    expect(within(seccion).queryByText("Dulces del Sur")).toBeNull();
  });

  it("si lo unico que hay son cobranzas, la seccion Para hoy no aparece", async () => {
    obtener.mockResolvedValue(respuesta({ cobranzas: [cobranza()] }));
    await montar();
    await waitFor(() => expect(screen.queryByText("Cargando Mi día...")).toBeNull());
    expect(screen.queryByRole("region", { name: "Para hoy" })).toBeNull();
  });

  it("cobranzas null (backend que falla en leerlas) no muestra ningun aviso", async () => {
    obtener.mockResolvedValue(respuesta({ tareas: [tarea()], cobranzas: null, errores: ["cobranzas"] }));
    await montar();
    const seccion = await screen.findByRole("region", { name: "Para hoy" });
    expect(within(seccion).getByText("Llamar por la factura")).toBeTruthy();
    expect(screen.queryByText(/No se pudieron cargar las cobranzas/)).toBeNull();
  });
});
