import { describe, expect, it } from "vitest";
import type { CandidatoBandeja } from "../../api/types";
import { coincideBusqueda, ordenarPorFechaDesc } from "./busqueda";

function candidato(overrides: Partial<CandidatoBandeja>): CandidatoBandeja {
  return {
    doc_entry: 1,
    doc_num: 1,
    doc_date: "2026-09-01T00:00:00Z",
    hora_pedido: null,
    card_code: "C1-00001",
    card_name: "Almacén Don Pedro",
    nro_referencia_externa: null,
    moneda: "$",
    importe: 1000,
    vendedor: "Sebastián Orta",
    cliente_suspendido: false,
    status_aprobacion: "Pendiente",
    condicion_pago: null,
    comentarios: null,
    ...overrides,
  };
}

describe("coincideBusqueda", () => {
  it("sin texto de busqueda coincide siempre", () => {
    expect(coincideBusqueda(candidato({}), "")).toBe(true);
  });

  it("coincide por nombre de cliente sin distinguir mayusculas", () => {
    expect(coincideBusqueda(candidato({ card_name: "Almacén Don Pedro" }), "don pedro")).toBe(true);
  });

  it("coincide por vendedor", () => {
    expect(coincideBusqueda(candidato({ vendedor: "Karina Silva" }), "karina")).toBe(true);
  });

  it("no coincide si ni cliente ni vendedor calzan", () => {
    expect(coincideBusqueda(candidato({ card_name: "Kiosco 24hs", vendedor: "Martín Paz" }), "rambla")).toBe(
      false
    );
  });
});

describe("ordenarPorFechaDesc", () => {
  it("ordena por fecha de pedido, mas reciente primero", () => {
    const candidatos = [
      candidato({ doc_entry: 1, doc_date: "2026-09-10T00:00:00Z" }),
      candidato({ doc_entry: 2, doc_date: "2026-09-17T00:00:00Z" }),
      candidato({ doc_entry: 3, doc_date: "2026-09-01T00:00:00Z" }),
    ];

    const ordenados = ordenarPorFechaDesc(candidatos);

    expect(ordenados.map((c) => c.doc_entry)).toEqual([2, 1, 3]);
  });

  it("deja las fechas nulas al final", () => {
    const candidatos = [
      candidato({ doc_entry: 1, doc_date: null }),
      candidato({ doc_entry: 2, doc_date: "2026-09-17T00:00:00Z" }),
    ];

    const ordenados = ordenarPorFechaDesc(candidatos);

    expect(ordenados.map((c) => c.doc_entry)).toEqual([2, 1]);
  });
});
