import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureNombre } from "../features/features";
import { AppShell } from "./AppShell";

// Caracterizacion del menu: que entradas aparecen segun las funcionalidades.
// Entrega 2: la cuarta ("Cobranza programada") solo con cobranza_programada.

const featuresHabilitadas = new Set<FeatureNombre>();
vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({
    instance: { getActiveAccount: () => ({ name: "Rosina López" }), logoutPopup: () => Promise.resolve() },
    accounts: [],
  }),
}));
vi.mock("../api/client", () => ({ apiFetch: vi.fn().mockResolvedValue({}) }));
vi.mock("../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("../features/FeaturesContext", () => ({
  FeaturesProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useFeatures: () => ({
    habilitada: (nombre: FeatureNombre) => featuresHabilitadas.has(nombre),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: false,
  }),
}));

function entradasDelMenu(): string[] {
  const nav = screen.getByRole("navigation");
  return Array.from(nav.querySelectorAll("a")).map((a) => `${a.textContent}|${a.getAttribute("href")}`);
}

function montar() {
  render(
    <MemoryRouter initialEntries={["/cliente-360"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<div />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("AppShell: entradas del menú", () => {
  beforeEach(() => featuresHabilitadas.clear());

  it("sin funcionalidades: Cliente 360 y Bandeja", () => {
    montar();
    expect(entradasDelMenu()).toEqual(["Cliente 360|/cliente-360", "Bandeja de autorización|/bandeja"]);
  });

  it("con mi_dia: Mi día va primero", () => {
    featuresHabilitadas.add("mi_dia");
    montar();
    expect(entradasDelMenu()).toEqual([
      "Mi día|/mi-dia",
      "Cliente 360|/cliente-360",
      "Bandeja de autorización|/bandeja",
    ]);
  });
});

describe("AppShell: Cobranza programada", () => {
  beforeEach(() => featuresHabilitadas.clear());

  it("con cobranza_programada es la cuarta entrada, después de la Bandeja", () => {
    featuresHabilitadas.add("mi_dia");
    featuresHabilitadas.add("cobranza_programada");
    montar();
    expect(entradasDelMenu()).toEqual([
      "Mi día|/mi-dia",
      "Cliente 360|/cliente-360",
      "Bandeja de autorización|/bandeja",
      "Cobranza programada|/cobranza",
    ]);
  });

  it("sin mi_dia igual va al final", () => {
    featuresHabilitadas.add("cobranza_programada");
    montar();
    expect(entradasDelMenu().slice(-1)[0]).toBe("Cobranza programada|/cobranza");
  });
});

describe("AppShell: estructura del encabezado (caracterización)", () => {
  beforeEach(() => featuresHabilitadas.clear());

  it("el menú vive dentro del header, junto a Pontyn, el usuario y Cerrar sesión", () => {
    montar();
    const header = screen.getByRole("banner");
    expect(header.contains(screen.getByRole("navigation"))).toBe(true);
    expect(header.textContent).toContain("Pontyn");
    expect(header.textContent).toContain("Rosina López");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
  });

  it("la entrada activa lleva aria-current=page", () => {
    montar();
    const activa = screen.getByRole("navigation").querySelector('a[aria-current="page"]');
    expect(activa?.getAttribute("href")).toBe("/cliente-360");
  });
});

describe("AppShell: menú en el celular (barra al pie)", () => {
  beforeEach(() => featuresHabilitadas.clear());

  it("el nav tiene nombre accesible", () => {
    montar();
    expect(screen.getByRole("navigation", { name: "Menú principal" })).toBeTruthy();
  });

  it("cada entrada trae su etiqueta corta; el texto largo sigue siendo el contenido", () => {
    featuresHabilitadas.add("mi_dia");
    featuresHabilitadas.add("cobranza_programada");
    montar();
    const nav = screen.getByRole("navigation");
    const cortas = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("data-corto"));
    expect(cortas).toEqual(["Mi día", "Cliente 360", "Bandeja", "Cobranza"]);
    expect(entradasDelMenu()[2]).toBe("Bandeja de autorización|/bandeja");
  });

  it("la cantidad de entradas va en data-entradas (3 o 4) para que la barra reparta el ancho", () => {
    featuresHabilitadas.add("mi_dia");
    montar();
    expect(screen.getByRole("navigation").getAttribute("data-entradas")).toBe("3");
  });
});
