import { describe, expect, it } from "vitest";
import type { Factura } from "../../api/types";
import { calcularResumenFacturas } from "./resumenSaldos";

function factura(overrides: Partial<Factura>): Factura {
  return {
    doc_entry: 1,
    doc_num: 1,
    doc_date: "2026-08-01T00:00:00Z",
    doc_due_date: "2026-09-01T00:00:00Z",
    doc_total: 1000,
    ...overrides,
  };
}

describe("calcularResumenFacturas", () => {
  const hoy = new Date("2026-09-18T12:00:00Z");

  it("sin facturas devuelve saldo vencido cero y 100% al dia", () => {
    expect(calcularResumenFacturas([], hoy)).toEqual({
      saldoVencido: 0,
      atrasoActualDias: null,
      pctAlDia: 100,
      pctVencido: 0,
    });
  });

  it("con una factura vencida y una al dia calcula saldo vencido y atraso maximo", () => {
    const facturas = [
      factura({ doc_entry: 1, doc_due_date: "2026-07-27T00:00:00Z", doc_total: 512000 }),
      factura({ doc_entry: 2, doc_due_date: "2026-10-01T00:00:00Z", doc_total: 488000 }),
    ];

    const resumen = calcularResumenFacturas(facturas, hoy);

    expect(resumen.saldoVencido).toBe(512000);
    expect(resumen.atrasoActualDias).toBe(53);
    expect(resumen.pctVencido).toBeCloseTo(51.2, 1);
    expect(resumen.pctAlDia).toBeCloseTo(48.8, 1);
  });

  it("el atraso actual es el de la factura mas vencida, no la primera de la lista", () => {
    const facturas = [
      factura({ doc_entry: 1, doc_due_date: "2026-09-10T00:00:00Z", doc_total: 100 }),
      factura({ doc_entry: 2, doc_due_date: "2026-08-01T00:00:00Z", doc_total: 100 }),
    ];

    const resumen = calcularResumenFacturas(facturas, hoy);

    expect(resumen.atrasoActualDias).toBe(48);
  });

  it("sin facturas vencidas el atraso actual es null", () => {
    const facturas = [factura({ doc_due_date: "2026-12-01T00:00:00Z", doc_total: 100 })];

    const resumen = calcularResumenFacturas(facturas, hoy);

    expect(resumen.atrasoActualDias).toBeNull();
    expect(resumen.saldoVencido).toBe(0);
    expect(resumen.pctAlDia).toBe(100);
  });
});
