import { render } from "@testing-library/react";
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

function cand(n: number, card: string, extra: Partial<CandidatoBandeja> = {}): CandidatoBandeja {
  return {
    doc_entry: n, doc_num: n, doc_date: `2026-09-${20 + n}`, hora_pedido: null, card_code: card,
    card_name: `Cuenta ${card}`, nro_referencia_externa: null, moneda: "UYU", importe: 1000, vendedor: "V",
    cliente_suspendido: false, status_aprobacion: "Pendiente", condicion_pago: null, comentarios: null,
    pagador_central: null, pagador_central_nombre: null, ...extra,
  };
}

// Las etiquetas de la fila: la ultima fila de flex-wrap dentro de cada pedido.
function etiquetas(container: HTMLElement, docEntry: number): string[] {
  const fila = container.querySelector(`[data-doc-entry="${docEntry}"]`)!;
  const spans = [...fila.querySelectorAll("span")].filter((s) => s.style.borderRadius === "20px" && s.style.fontWeight === "600" && s.style.fontSize === "12px");
  return spans.map((s) => s.textContent ?? "");
}

function render1() {
  return render(<MemoryRouter><BandejaPage /></MemoryRouter>).container;
}

describe("Bandeja: etiquetas de cada pedido", () => {
  beforeEach(() => {
    candidatos = [
      cand(1, "A", { cliente_suspendido: true }),
      cand(2, "B"),
    ];
  });

  // Caracterizacion (verde antes de tocar nada)
  it("hoy: estado y, si corresponde, Cliente suspendido", () => {
    const c = render1();
    expect(etiquetas(c, 1)).toEqual(["Pendiente", "Cliente suspendido"]);
    expect(etiquetas(c, 2)).toEqual(["Pendiente"]);
  });

  // Nuevo
  it("con pagador central: etiqueta neutral 'Pagador central' al final, con title de quien paga", () => {
    candidatos = [
      cand(1, "A", { pagador_central: "C1-17527", pagador_central_nombre: "CASA CENTRAL SA" }),
      cand(2, "B", { pagador_central: "", pagador_central_nombre: "" }),
      cand(3, "C"),
    ];
    const c = render1();
    expect(etiquetas(c, 1)).toEqual(["Pendiente", "Pagador central"]);
    const tag = [...c.querySelectorAll('[data-doc-entry="1"] span')].find((s) => s.textContent === "Pagador central") as HTMLElement;
    expect(tag.getAttribute("title")).toBe("Lo paga C1-17527 · CASA CENTRAL SA");
    expect(tag.style.background).toBe("var(--color-paper)");
    expect(etiquetas(c, 2)).toEqual(["Pendiente"]);
    expect(etiquetas(c, 3)).toEqual(["Pendiente"]);
  });

  it("sin nombre del pagador, el title lleva solo el codigo", () => {
    candidatos = [cand(1, "A", { pagador_central: "C1-9", pagador_central_nombre: null })];
    const c = render1();
    const tag = [...c.querySelectorAll('[data-doc-entry="1"] span')].find((s) => s.textContent === "Pagador central") as HTMLElement;
    expect(tag.getAttribute("title")).toBe("Lo paga C1-9");
  });
});
