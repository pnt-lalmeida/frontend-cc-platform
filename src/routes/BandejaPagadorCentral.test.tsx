import { fireEvent, render, screen, within } from "@testing-library/react";
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

function cand(n: number, card: string, pagador: string | null): CandidatoBandeja {
  return {
    doc_entry: n, doc_num: n, doc_date: `2026-09-${20 + n}`, hora_pedido: null, card_code: card,
    card_name: `Cuenta ${card}`, nro_referencia_externa: null, moneda: "UYU", importe: 1000, vendedor: "V",
    cliente_suspendido: false, status_aprobacion: "Pendiente", condicion_pago: null, comentarios: null,
    pagador_central: pagador, pagador_central_nombre: pagador ? "CASA CENTRAL SA" : null,
  };
}

const conPagador = () => [
  cand(1, "L1-UYU", "C1-9"), cand(2, "L2-UYU", "C1-9"), cand(3, "SOLO", null), cand(4, "L1-USD", "C1-9"),
];
const sinPagador = () => conPagador().map((x) => ({ ...x, pagador_central: null, pagador_central_nombre: null }));

function renderBandeja() {
  return render(<MemoryRouter><BandejaPage /></MemoryRouter>);
}

function ordenFilas(container: HTMLElement) {
  return [...container.querySelectorAll("[data-doc-entry]")].map((n) => n.getAttribute("data-doc-entry"));
}

describe("Bandeja — pagador central", () => {
  beforeEach(() => { candidatos = conPagador(); });

  it("muestra el pagador en cada cuenta que lo tiene, con cuantas cuentas comparten, y nada en las demas", () => {
    renderBandeja();
    const etiquetas = screen.getAllByText(/Lo paga C1-9/);
    expect(etiquetas).toHaveLength(3);
    expect(etiquetas[0].textContent).toContain("CASA CENTRAL SA");
    expect(etiquetas[0].textContent).toContain("3 cuentas en la cola");
    expect(screen.queryByText(/sin pagador/i)).toBeNull();
    expect(screen.getAllByText(/Lo paga/)).toHaveLength(3);
  });

  it("si solo una cuenta tiene ese pagador, no dice 'cuentas en la cola'", () => {
    candidatos = [cand(1, "A", "C1-9"), cand(2, "B", null)];
    renderBandeja();
    const e = screen.getByText(/Lo paga C1-9/);
    expect(e.textContent).not.toMatch(/en la cola/);
  });

  it("en el detalle muestra codigo y nombre del pagador; sin pagador no muestra nada", () => {
    const { container } = renderBandeja();
    fireEvent.click(container.querySelector('[data-doc-entry="1"]')!);
    const detalle = container.querySelector(".bandeja-detail") as HTMLElement;
    expect(within(detalle).getByText(/Pagador central/)).toBeTruthy();
    expect(detalle.textContent).toContain("C1-9");
    expect(detalle.textContent).toContain("CASA CENTRAL SA");
    fireEvent.click(container.querySelector('[data-doc-entry="3"]')!);
    expect(within(detalle).queryByText(/Pagador central/)).toBeNull();
  });

  it("es solo informacion: mismas filas, mismo orden y mismos botones (tras elegir motivo) con y sin pagador", () => {
    function estado() {
      const { container, unmount } = renderBandeja();
      const orden = ordenFilas(container);
      const textoFilas = orden.map((d) => container.querySelector(`[data-doc-entry="${d}"]`)!.textContent!.replace(/Lo paga.*?(?=Pedido|$)/, ""));
      fireEvent.click(container.querySelector('[data-doc-entry="2"]')!);
      const antes = {
        aprobar: (screen.getByRole("button", { name: "Aprobar" }) as HTMLButtonElement).disabled,
        rechazar: (screen.getByRole("button", { name: "Rechazar" }) as HTMLButtonElement).disabled,
      };
      fireEvent.click(screen.getAllByRole("radio")[0]);
      const despues = {
        aprobar: (screen.getByRole("button", { name: "Aprobar" }) as HTMLButtonElement).disabled,
        rechazar: (screen.getByRole("button", { name: "Rechazar" }) as HTMLButtonElement).disabled,
      };
      unmount();
      return { orden, textoFilas, antes, despues };
    }
    candidatos = conPagador();
    const con = estado();
    candidatos = sinPagador();
    const sin = estado();
    expect(con.despues.aprobar).toBe(false); // el motivo realmente habilito Aprobar
    expect(con.antes.aprobar).toBe(true);
    expect(con).toEqual(sin);
  });
});
