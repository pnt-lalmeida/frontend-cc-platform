import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidatoBandeja } from "../api/types";
import { BandejaPage } from "./BandejaPage";

// Fase 2 CRM: "Ver pedido" del Centro de alertas abre /bandeja?pedido=<doc_entry>.

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("../features/FeaturesContext", () => ({
  useFeatures: () => ({ habilitada: () => false, enPiloto: () => false, esSupervisor: false, cargando: false }),
}));

let candidatos: CandidatoBandeja[] = [];
vi.mock("./bandeja/useCandidatos", () => ({
  useCandidatos: () => ({ candidatos, loading: false, error: null, recargar: () => {} }),
}));

function candidato(parcial: Partial<CandidatoBandeja>): CandidatoBandeja {
  return {
    doc_entry: 1,
    doc_num: 100,
    doc_date: "2026-09-25",
    hora_pedido: null,
    card_code: "C1-1",
    card_name: "Cliente Uno",
    nro_referencia_externa: null,
    moneda: "UYU",
    importe: 1000,
    vendedor: "Vendedor",
    cliente_suspendido: false,
    status_aprobacion: "Pendiente",
    condicion_pago: null,
    comentarios: null,
    ...parcial,
  };
}

function Ubicacion() {
  const location = useLocation();
  return <div data-testid="ubicacion">{location.pathname + location.search}</div>;
}

function renderBandeja(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/bandeja"
          element={
            <>
              <BandejaPage />
              <Ubicacion />
            </>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("BandejaPage — ?pedido=<doc_entry>", () => {
  beforeEach(() => {
    candidatos = [
      candidato({ doc_entry: 1, doc_num: 100, card_code: "C1-1", card_name: "Cliente Uno" }),
      candidato({ doc_entry: 1400895, doc_num: 1146083, card_code: "C1-2", card_name: "Ferretería Norte", status_aprobacion: "Rechazado" }),
    ];
  });

  it("sin parámetro no selecciona nada", () => {
    renderBandeja("/bandeja");
    expect(screen.getByText("Seleccioná un pedido de la lista para ver el detalle.")).toBeTruthy();
  });

  it("selecciona el pedido de la URL (aunque el filtro no lo mostrara) y limpia el parámetro", () => {
    renderBandeja("/bandeja?pedido=1400895");
    expect(screen.getByRole("heading", { name: "Ferretería Norte" })).toBeTruthy();
    expect(screen.queryByText("Seleccioná un pedido de la lista para ver el detalle.")).toBeNull();
    expect(screen.getByTestId("ubicacion").textContent).toBe("/bandeja");
  });

  it("si el pedido ya no está en la cola, abre la Bandeja normal", () => {
    renderBandeja("/bandeja?pedido=999");
    expect(screen.getByText("Seleccioná un pedido de la lista para ver el detalle.")).toBeTruthy();
    expect(screen.getByTestId("ubicacion").textContent).toBe("/bandeja");
  });
});
