import { describe, expect, it } from "vitest";
import type { CandidatoBandeja } from "../../api/types";
import { agruparPorCliente } from "./agrupar";
import { pagadorDeGrupo, resumenPagadores } from "./pagadores";

function c(n: number, card: string, pagador: string | null, nombre: string | null = null): CandidatoBandeja {
  return {
    doc_entry: n, doc_num: n, doc_date: "2026-09-25", hora_pedido: null, card_code: card, card_name: card,
    nro_referencia_externa: null, moneda: "UYU", importe: 1, vendedor: null, cliente_suspendido: false,
    status_aprobacion: "Pendiente", condicion_pago: null, comentarios: null,
    pagador_central: pagador, pagador_central_nombre: nombre,
  };
}

describe("pagadores", () => {
  const grupos = agruparPorCliente([
    c(1, "A-UYU", "C1-9", "CASA CENTRAL SA"),
    c(2, "B-UYU", "C1-9", "CASA CENTRAL SA"),
    c(3, "X", null),
    c(4, "A-USD", "C1-9", "CASA CENTRAL SA"),
    c(5, "Z", "C1-7", "OTRO"),
  ]);

  it("pagadorDeGrupo devuelve el pagador o null", () => {
    expect(pagadorDeGrupo(grupos[0])).toEqual({ codigo: "C1-9", nombre: "CASA CENTRAL SA" });
    expect(pagadorDeGrupo(grupos[2])).toBeNull();
  });

  it("resumenPagadores cuenta cuentas (grupos) y pedidos por pagador", () => {
    const r = resumenPagadores(grupos);
    expect(r.get("C1-9")).toEqual({ cuentas: 3, pedidos: 3 });
    expect(r.get("C1-7")).toEqual({ cuentas: 1, pedidos: 1 });
    expect(r.has("null")).toBe(false);
  });

  it("no reordena ni modifica los grupos", () => {
    const antes = grupos.map((g) => g.clave);
    resumenPagadores(grupos);
    expect(grupos.map((g) => g.clave)).toEqual(antes);
  });
});
