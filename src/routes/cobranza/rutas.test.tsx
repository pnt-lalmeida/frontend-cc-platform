import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureNombre } from "../../features/features";
import { RutaCobranza } from "./rutas";

// Sin cobranza_programada la ruta no monta la pantalla (ni hace fetch) y
// redirige donde siempre; mientras carga la configuracion no decide nada.

const featuresHabilitadas = new Set<FeatureNombre>();
let cargandoConfig = false;
const montajes = vi.fn();

vi.mock("../../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (nombre: FeatureNombre) => featuresHabilitadas.has(nombre),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: cargandoConfig,
  }),
}));
vi.mock("./CobranzaPage", () => ({
  CobranzaPage: () => {
    montajes();
    return <div>Pantalla Cobranza</div>;
  },
}));

function Ubicacion() {
  return <div data-testid="ubicacion">{useLocation().pathname}</div>;
}

function montar() {
  return render(
    <MemoryRouter initialEntries={["/cobranza"]}>
      <Routes>
        <Route path="cobranza" element={<RutaCobranza />} />
        <Route path="cliente-360" element={<Ubicacion />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  featuresHabilitadas.clear();
  cargandoConfig = false;
  montajes.mockReset();
});

describe("RutaCobranza", () => {
  it("sin el flag redirige a Cliente 360 y no monta la pantalla", () => {
    montar();
    expect(screen.getByTestId("ubicacion").textContent).toBe("/cliente-360");
    expect(montajes).not.toHaveBeenCalled();
  });

  it("con el flag monta la pantalla", () => {
    featuresHabilitadas.add("cobranza_programada");
    montar();
    expect(screen.getByText("Pantalla Cobranza")).toBeTruthy();
  });

  it("mientras carga la configuración no monta ni redirige", () => {
    cargandoConfig = true;
    montar();
    expect(montajes).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ubicacion")).toBeNull();
  });
});
