import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureNombre } from "../../features/features";
import { RutaInicial, RutaMiDia } from "./rutas";

// La ruta por defecto pasa a Mi dia solo con el flag prendido; sin el flag,
// todo sigue como hoy y no se monta nada ni se hace ningun fetch.

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
vi.mock("./MiDiaPage", () => ({
  MiDiaPage: () => {
    montajes();
    return <div>Pantalla Mi día</div>;
  },
}));

function Ubicacion() {
  return <div data-testid="ubicacion">{useLocation().pathname}</div>;
}

function montar(entrada: string) {
  return render(
    <MemoryRouter initialEntries={[entrada]}>
      <Routes>
        <Route index element={<RutaInicial />} />
        <Route path="mi-dia" element={<RutaMiDia />} />
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

describe("RutaInicial", () => {
  it("con el flag apagado sigue yendo a Cliente 360", () => {
    montar("/");
    expect(screen.getByTestId("ubicacion").textContent).toBe("/cliente-360");
  });

  it("con el flag prendido va a Mi día", () => {
    featuresHabilitadas.add("mi_dia");
    montar("/");
    expect(screen.getByText("Pantalla Mi día")).toBeTruthy();
  });

  it("mientras carga la configuración no decide todavía (no hay salto de pantalla)", () => {
    cargandoConfig = true;
    montar("/");
    expect(screen.queryByTestId("ubicacion")).toBeNull();
    expect(screen.queryByText("Pantalla Mi día")).toBeNull();
  });
});

describe("RutaMiDia", () => {
  it("sin el flag no monta la pantalla (ni hace fetch) y vuelve a Cliente 360", () => {
    montar("/mi-dia");
    expect(montajes).not.toHaveBeenCalled();
    expect(screen.getByTestId("ubicacion").textContent).toBe("/cliente-360");
  });

  it("con el flag monta la pantalla", () => {
    featuresHabilitadas.add("mi_dia");
    montar("/mi-dia");
    expect(screen.getByText("Pantalla Mi día")).toBeTruthy();
  });

  it("mientras carga la configuración no monta ni redirige", () => {
    cargandoConfig = true;
    montar("/mi-dia");
    expect(montajes).not.toHaveBeenCalled();
    expect(screen.queryByTestId("ubicacion")).toBeNull();
  });
});
