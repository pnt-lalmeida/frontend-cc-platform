import { describe, expect, it } from "vitest";
import type { EstadoCuentaFila } from "../../api/types";
import { agruparPorMoneda, totalCuentaPropia } from "./estadoCuenta";

// Bug real (28/09/2026, feedback de Liber con captura): el Estado de cuenta
// mezcla pesos y dolares en una sola tabla, y el total de arriba ("Saldo cta.
// cte.") viene de SAP en moneda local (pesos) pero se etiqueta con la moneda
// de la cuenta -> un cliente USD mostraba "US$ -624" cuando en realidad debia
// eran -18,64 dolares. Confirmado contra SAP y HANA reales (solo lectura):
// CurrentAccountBalance de SAP = suma de -(BalDueCred-BalDueDeb) SIN convertir,
// que es la columna en pesos, no la columna en moneda extranjera (BalFc*).

function fila(overrides: Partial<EstadoCuentaFila>): EstadoCuentaFila {
  return {
    folio: "1", tipo: "Factura", moneda: "$", vendedor: null,
    fecha: "2026-09-01", vencimiento: "2026-09-01", saldo: 100, saldo_corrido: 100,
    ...overrides,
  };
}

describe("agruparPorMoneda", () => {
  it("agrupa por moneda, en orden $ / USD / EUR, y suma el total de cada grupo", () => {
    const filas = [
      fila({ moneda: "USD", saldo: -10.97 }),
      fila({ moneda: "$", saldo: -902.13 }),
      fila({ moneda: "USD", saldo: -5.22 }),
      fila({ moneda: "EUR", saldo: 50 }),
      fila({ moneda: "$", saldo: 29499.6 }),
    ];

    const grupos = agruparPorMoneda(filas);

    expect(grupos.map((g) => g.moneda)).toEqual(["$", "USD", "EUR"]);
    expect(grupos[0].filas).toHaveLength(2);
    expect(grupos[0].total).toBeCloseTo(28597.47);
    expect(grupos[1].filas).toHaveLength(2);
    expect(grupos[1].total).toBeCloseTo(-16.19);
    expect(grupos[2].total).toBe(50);
  });

  it("sin filas devuelve la lista vacía", () => {
    expect(agruparPorMoneda([])).toEqual([]);
  });

  it("una moneda no reconocida igual arma su grupo, al final", () => {
    const grupos = agruparPorMoneda([fila({ moneda: "ARS", saldo: 5 }), fila({ moneda: "$", saldo: 1 })]);
    expect(grupos.map((g) => g.moneda)).toEqual(["$", "ARS"]);
  });

  it("saldo null cuenta como 0 en el total del grupo", () => {
    const grupos = agruparPorMoneda([fila({ moneda: "$", saldo: null as unknown as number }), fila({ moneda: "$", saldo: 10 })]);
    expect(grupos[0].total).toBe(10);
  });
});

describe("totalCuentaPropia", () => {
  const filas = [
    fila({ moneda: "$", saldo: -902.13 }),
    fila({ moneda: "$", saldo: 29499.6 }),
    fila({ moneda: "USD", saldo: -10.97 }),
    fila({ moneda: "USD", saldo: -5.22 }),
    fila({ moneda: "USD", saldo: -2.45 }),
  ];

  it("suma solo las filas de la moneda de la cuenta (UYU -> '$')", () => {
    expect(totalCuentaPropia(filas, "UYU")).toBeCloseTo(28597.47);
  });

  it("suma solo las filas de la moneda de la cuenta (USD -> 'USD')", () => {
    expect(totalCuentaPropia(filas, "USD")).toBeCloseTo(-18.64);
  });

  it("sin filas de esa moneda, el saldo es 0 (no falta el dato, es cero real)", () => {
    expect(totalCuentaPropia(filas, "EUR")).toBe(0);
  });

  it("sin moneda de ficha, no se puede calcular", () => {
    expect(totalCuentaPropia(filas, null)).toBeNull();
  });

  it("una moneda de ficha desconocida, no se puede calcular", () => {
    expect(totalCuentaPropia(filas, "GBP")).toBeNull();
  });
});
