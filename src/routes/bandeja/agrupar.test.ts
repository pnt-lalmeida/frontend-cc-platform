import { describe, expect, it } from "vitest";
import type { CandidatoBandeja } from "../../api/types";
import { agruparPorCliente } from "./agrupar";

function candidato(overrides: Partial<CandidatoBandeja>): CandidatoBandeja {
  return {
    doc_entry: null,
    doc_num: null,
    doc_date: null,
    hora_pedido: null,
    card_code: null,
    card_name: null,
    nro_referencia_externa: null,
    moneda: null,
    importe: null,
    vendedor: null,
    cliente_suspendido: null,
    status_aprobacion: null,
    condicion_pago: null,
    comentarios: null,
    ...overrides,
  };
}

describe("agruparPorCliente", () => {
  it("agrupa varios pedidos del mismo card_code en un solo grupo", () => {
    const a = candidato({ doc_entry: 1, card_code: "C1-11391", card_name: "-18° CONGELADOS" });
    const b = candidato({ doc_entry: 2, card_code: "C1-11391", card_name: "-18° CONGELADOS" });
    const c = candidato({ doc_entry: 3, card_code: "C1-12526", card_name: "PABLO GARCIA" });

    const grupos = agruparPorCliente([a, b, c]);

    expect(grupos).toHaveLength(2);
    expect(grupos[0].cardCode).toBe("C1-11391");
    expect(grupos[0].pedidos).toEqual([a, b]);
    expect(grupos[1].cardCode).toBe("C1-12526");
    expect(grupos[1].pedidos).toEqual([c]);
  });

  it("el orden de los grupos sigue el orden de aparicion de la lista de entrada", () => {
    // La lista de entrada ya viene ordenada por fecha mas reciente primero
    // (ordenarPorFechaDesc) - agrupar no debe reordenar, solo agrupar.
    const masReciente = candidato({ doc_entry: 1, card_code: "C1-12526", doc_date: "2026-09-24" });
    const masVieja = candidato({ doc_entry: 2, card_code: "C1-11391", doc_date: "2026-09-01" });

    const grupos = agruparPorCliente([masReciente, masVieja]);

    expect(grupos.map((g) => g.cardCode)).toEqual(["C1-12526", "C1-11391"]);
  });

  it("un pedido nuevo de un cliente ya agrupado no crea un grupo nuevo, aunque no sea contiguo", () => {
    const a = candidato({ doc_entry: 1, card_code: "C1-11391" });
    const otro = candidato({ doc_entry: 2, card_code: "C1-12526" });
    const b = candidato({ doc_entry: 3, card_code: "C1-11391" });

    const grupos = agruparPorCliente([a, otro, b]);

    expect(grupos).toHaveLength(2);
    expect(grupos[0].pedidos).toEqual([a, b]);
  });

  it("pedidos sin card_code no se mezclan entre si", () => {
    const a = candidato({ doc_entry: 1, card_code: null });
    const b = candidato({ doc_entry: 2, card_code: null });

    const grupos = agruparPorCliente([a, b]);

    expect(grupos).toHaveLength(2);
  });

  it("toma el card_name del primer pedido del grupo", () => {
    const a = candidato({ doc_entry: 1, card_code: "C1-11391", card_name: "-18° CONGELADOS" });
    const b = candidato({ doc_entry: 2, card_code: "C1-11391", card_name: null });

    const grupos = agruparPorCliente([a, b]);

    expect(grupos[0].cardName).toBe("-18° CONGELADOS");
  });

  it("lista vacia da lista de grupos vacia", () => {
    expect(agruparPorCliente([])).toEqual([]);
  });
});
