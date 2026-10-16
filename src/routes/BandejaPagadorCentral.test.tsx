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

  it("es solo informacion: mismas filas, orden, etiquetas y botones (tras elegir motivo) en TODOS los pedidos, con y sin pagador", () => {
    // Validador 16/10: comparando solo el pedido 2 sobrevivian 4 de 6 mutaciones (deshabilitar Aprobar o
    // Rechazar en otro pedido con pagador, ocultar "Cliente suspendido" o el motivo de retencion). Mismo
    // hueco que el 14/10 en BandejaMotivoRetencion. Ahora se recorren los 4 pedidos y los datos traen
    // suspendido y motivos, para que esconderlos cambie el texto de la fila.
    const conDatos = (lista: CandidatoBandeja[]): CandidatoBandeja[] => lista.map((c) => ({
      ...c,
      cliente_suspendido: c.doc_entry === 1,
      motivo_deuda_vencida: (c.doc_entry ?? 0) % 2 === 0,
      motivo_tope_cedula: c.doc_entry === 4,
    }));
    function estado() {
      const { container, unmount } = renderBandeja();
      const fila = (n: number) => container.querySelector(`[data-doc-entry="${n}"]`) as HTMLElement;
      const orden = ordenFilas(container);
      const textoFilas = orden.map((d) => fila(Number(d)).textContent!.replace(/Lo paga.*?(?=Pedido|$)/, "").replace("Pagador central", ""));
      const botones = () => ({
        aprobar: (screen.getByRole("button", { name: "Aprobar" }) as HTMLButtonElement).disabled,
        rechazar: (screen.getByRole("button", { name: "Rechazar" }) as HTMLButtonElement).disabled,
      });
      const porPedido = [1, 2, 3, 4].map((n) => {
        fireEvent.click(fila(n));
        const antes = botones();
        fireEvent.click(screen.getAllByRole("radio")[0]);
        return { n, antes, despues: botones() };
      });
      unmount();
      return { orden, textoFilas, porPedido };
    }
    candidatos = conDatos(conPagador());
    const con = estado();
    candidatos = conDatos(sinPagador());
    const sin = estado();
    // Sin esto la comparacion no prueba nada: Aprobar arranca deshabilitado siempre.
    for (const p of con.porPedido) {
      expect(p.antes.aprobar).toBe(true);
      expect(p.despues.aprobar).toBe(false);
      expect(p.despues.rechazar).toBe(false);
    }
    expect(con.textoFilas.join(" ")).toContain("Tope cédula");
    expect(con.textoFilas.join(" ")).toContain("Cliente suspendido");
    expect(con).toEqual(sin);
  });
});
