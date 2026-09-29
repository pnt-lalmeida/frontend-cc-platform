import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidatoBandeja, PromesaPago, PromesasResponse } from "../api/types";
import { BandejaPage } from "./BandejaPage";

// Fase 4 CRM: linea de contexto "Prometio ..." en el detalle de la Bandeja.
// Es solo contexto: no filtra, no ordena y no habilita ni bloquea nada.

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const flags = new Set<string>();
vi.mock("../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (n: string) => flags.has(n),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: false,
  }),
}));

const obtenerPromesas = vi.fn();
vi.mock("./cliente360/useApiPromesas", () => {
  const api = { obtener: (...a: unknown[]) => obtenerPromesas(...a), registrar: vi.fn() };
  return { useApiPromesas: () => api };
});

vi.mock("./bandeja/useCandidatos", () => ({
  useCandidatos: () => ({ candidatos, loading: false, error: null, recargar: () => {} }),
}));

let candidatos: CandidatoBandeja[] = [];

function candidato(parcial: Partial<CandidatoBandeja> = {}): CandidatoBandeja {
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

function promesa(parcial: Partial<PromesaPago> = {}): PromesaPago {
  return {
    id: 1,
    numero_sn: "1",
    card_code: "C1-1",
    fecha_prometida: "2026-10-02",
    importe: 45000,
    moneda: "UYU",
    canal: null,
    facturas: null,
    registrada_por: "rlopez@pontyn.com.uy",
    registrada_utc: "2026-09-29T14:00:00Z",
    estado: "vigente",
    estado_utc: null,
    importe_verificado: null,
    ...parcial,
  };
}

function respuesta(promesas: PromesaPago[]): PromesasResponse {
  return { promesas, monedas: ["UYU"] };
}

function montar() {
  return render(
    <MemoryRouter initialEntries={["/bandeja?pedido=1"]}>
      <Routes>
        <Route path="/bandeja" element={<BandejaPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Bandeja — línea de promesa vigente", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T15:00:00Z"));
    flags.clear();
    candidatos = [candidato()];
    obtenerPromesas.mockReset().mockResolvedValue(respuesta([promesa()]));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sin la funcionalidad habilitada no se muestra ni se hace ningún fetch", async () => {
    montar();
    await screen.findByRole("heading", { name: "Cliente Uno" });
    expect(screen.queryByText(/Prometió/)).toBeNull();
    expect(obtenerPromesas).not.toHaveBeenCalled();
  });

  it("con la funcionalidad, muestra qué prometió el cliente y cuándo vence", async () => {
    flags.add("promesas");
    montar();
    expect(await screen.findByText("Prometió $ 45.000,00 para el 02/10 · vence en 3 días")).toBeTruthy();
    expect(obtenerPromesas).toHaveBeenCalledWith("C1-1");
  });

  it("es solo contexto: con y sin la funcionalidad la cola tiene las mismas filas, el mismo orden y Aprobar/Rechazar el mismo estado", async () => {
    candidatos = [
      candidato({ doc_entry: 1, doc_num: 100, card_code: "C1-1", card_name: "Cliente Uno" }),
      candidato({ doc_entry: 2, doc_num: 101, card_code: "C1-2", card_name: "Cliente Dos" }),
      candidato({ doc_entry: 3, doc_num: 102, card_code: "C1-3", card_name: "Cliente Tres" }),
    ];
    // Solo el cliente seleccionado (C1-1) tiene una promesa vigente; la de otro
    // cliente de la cola tampoco debe reordenar nada.
    obtenerPromesas.mockImplementation(async (cc: string) => respuesta([promesa({ card_code: cc })]));

    function foto() {
      const cola = document.querySelector(".bandeja-queue") as HTMLElement;
      const nombres = ["Cliente Uno", "Cliente Dos", "Cliente Tres"];
      const orden = nombres
        .map((n) => ({ n, pos: cola.textContent?.indexOf(n) ?? -1 }))
        .sort((a, b) => a.pos - b.pos)
        .map((x) => x.n);
      const deshabilitado = (nombre: string) => (screen.getByRole("button", { name: nombre }) as HTMLButtonElement).disabled;
      // Aprobar empieza deshabilitado (falta el motivo) y se habilita al elegir
      // uno: las dos fotos tienen que coincidir con y sin el flag.
      const aprobarSinMotivo = deshabilitado("Aprobar");
      fireEvent.click(screen.getAllByRole("radio")[0]);
      return {
        orden,
        filas: nombres.filter((n) => (cola.textContent ?? "").includes(n)).length,
        aprobarSinMotivo,
        aprobarConMotivo: deshabilitado("Aprobar"),
        rechazarDeshabilitado: deshabilitado("Rechazar"),
      };
    }

    const sin = montar();
    await screen.findByRole("heading", { name: "Cliente Uno" });
    const fotoSin = foto();
    sin.unmount();

    flags.add("promesas");
    montar();
    await screen.findByText(/Prometió/);
    expect(foto()).toEqual(fotoSin);
    expect(fotoSin.filas).toBe(3);
    expect(fotoSin.aprobarSinMotivo).toBe(true);
    expect(fotoSin.aprobarConMotivo).toBe(false);
    expect(obtenerPromesas).toHaveBeenCalledTimes(1);
  });

  it("sin promesas vigentes no muestra nada", async () => {
    flags.add("promesas");
    obtenerPromesas.mockResolvedValue(respuesta([promesa({ estado: "cumplida" })]));
    montar();
    await waitFor(() => expect(obtenerPromesas).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByText(/Prometió/)).toBeNull();
  });

  it("si falla, lo dice en gris y no molesta a la decisión", async () => {
    flags.add("promesas");
    obtenerPromesas.mockRejectedValue(new Error("500"));
    montar();
    expect(await screen.findByText("Promesas de pago no disponibles")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rechazar" })).toBeTruthy();
  });
});
