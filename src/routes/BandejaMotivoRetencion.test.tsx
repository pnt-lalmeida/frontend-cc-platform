import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidatoBandeja } from "../api/types";
import { BandejaPage } from "./BandejaPage";

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("../features/FeaturesContext", () => ({
  useFeatures: () => ({ habilitada: () => false, enPiloto: () => false, esSupervisor: false, cargando: false }),
}));

let candidatos: CandidatoBandeja[] = [];
vi.mock("./bandeja/useCandidatos", () => ({
  useCandidatos: () => ({ candidatos, loading: false, error: null, recargar: () => {} }),
}));

type Motivos = { motivo_deuda_vencida?: boolean; motivo_tope_cedula?: boolean };

function cand(n: number, estado: string, motivos: Motivos): CandidatoBandeja {
  return {
    doc_entry: n, doc_num: n, doc_date: `2026-09-${20 + n}`, hora_pedido: null, card_code: `C${n}`,
    card_name: `Cuenta ${n}`, nro_referencia_externa: null, moneda: "UYU", importe: 1000, vendedor: "V",
    cliente_suspendido: false, status_aprobacion: estado, condicion_pago: null, comentarios: null, ...motivos,
  };
}

const conMotivos = () => [
  cand(1, "Pendiente", { motivo_deuda_vencida: true, motivo_tope_cedula: false }),
  cand(2, "Pendiente", { motivo_deuda_vencida: false, motivo_tope_cedula: true }),
  cand(3, "Pendiente", { motivo_deuda_vencida: true, motivo_tope_cedula: true }),
  cand(4, "Rechazado", { motivo_deuda_vencida: false, motivo_tope_cedula: false }),
];
const sinMotivos = () => conMotivos().map(({ motivo_deuda_vencida, motivo_tope_cedula, ...resto }) => resto as CandidatoBandeja);

function renderBandeja() {
  const r = render(<MemoryRouter><BandejaPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", { name: /^Todos/ })); // por defecto solo se ven los pendientes
  return r;
}
const fila = (c: HTMLElement, n: number) => c.querySelector(`[data-doc-entry="${n}"]`) as HTMLElement;

describe("Bandeja — motivo de retencion", () => {
  beforeEach(() => { candidatos = conMotivos(); });

  it("cada pedido muestra su motivo en la fila", () => {
    const { container } = renderBandeja();
    expect(fila(container, 1).textContent).toContain("Deuda vencida");
    expect(fila(container, 1).textContent).not.toContain("Tope cédula");
    expect(fila(container, 2).textContent).toContain("Tope cédula");
    expect(fila(container, 2).textContent).not.toContain("Deuda vencida");
    expect(fila(container, 3).textContent).toContain("Deuda vencida");
    expect(fila(container, 3).textContent).toContain("Tope cédula");
    expect(fila(container, 4).textContent).toContain("Ya sin deuda vencida");
  });

  it("sin los campos (backend viejo) no muestra ningun motivo", () => {
    candidatos = sinMotivos();
    const { container } = renderBandeja();
    expect(container.textContent).not.toMatch(/Deuda vencida|Tope cédula|Ya sin deuda/);
  });

  it("el detalle del pedido seleccionado tambien muestra el motivo", () => {
    const { container } = renderBandeja();
    fireEvent.click(fila(container, 2));
    const detalle = container.querySelector(".bandeja-detail") as HTMLElement;
    expect(detalle.textContent).toContain("Tope cédula");
  });

  it("es solo informacion: mismas filas, orden y botones (tras elegir motivo de decision) con y sin los campos", () => {
    // Se recorren TODOS los pedidos, no uno solo: el Validador (14/10) mostro que comparando solo el 2
    // sobrevivia una mutacion que deshabilitaba Rechazar en los "Ya sin deuda vencida" (pedido 4).
    function estado() {
      const { container, unmount } = renderBandeja();
      const orden = [...container.querySelectorAll("[data-doc-entry]")].map((n) => n.getAttribute("data-doc-entry"));
      const botones = () => ({
        aprobar: (screen.getByRole("button", { name: "Aprobar" }) as HTMLButtonElement).disabled,
        rechazar: (screen.getByRole("button", { name: "Rechazar" }) as HTMLButtonElement).disabled,
      });
      const porPedido = [1, 2, 3, 4].map((n) => {
        fireEvent.click(fila(container, n));
        const antes = botones();
        fireEvent.click(screen.getAllByRole("radio")[0]);
        return { n, antes, despues: botones() };
      });
      unmount();
      return { orden, porPedido };
    }
    candidatos = conMotivos();
    const con = estado();
    candidatos = sinMotivos();
    const sin = estado();
    // Sin esto la comparacion no prueba nada: Aprobar arranca deshabilitado siempre.
    for (const p of con.porPedido) {
      expect(p.antes.aprobar).toBe(true);
      expect(p.despues.aprobar).toBe(false);
      expect(p.despues.rechazar).toBe(false);
    }
    expect(con).toEqual(sin);
  });
});
