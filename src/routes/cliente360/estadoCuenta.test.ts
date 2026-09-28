import { describe, expect, it } from "vitest";
import type { EstadoCuentaFila } from "../../api/types";
import { agruparPorMoneda, totalCuentaPropia } from "./estadoCuenta";

// Bug real (28/09/2026, feedback de Liber con captura): el Estado de cuenta
// mezcla pesos y dolares en una sola tabla, y el total de arriba ("Saldo cta.
// cte.") viene de SAP en moneda local (pesos) pero se etiqueta con la moneda
// de la cuenta -> un cliente USD mostraba "US$ -624" cuando en realidad debia
// eran -16,96 dolares. Confirmado contra SAP y HANA reales (solo lectura):
// CurrentAccountBalance de SAP = suma de -(BalDueCred-BalDueDeb) SIN convertir,
// que es la columna en pesos, no la columna en moneda extranjera (BalFc*).
//
// Bug 2 (28/09/2026, mismo feedback): el primer arreglo usaba "$" como clave
// de pesos, copiado de la columna cruda de la SQL - pero el backend ya
// traduce "$" -> "UYU" en normalize_estado_cuenta_fila (shared/normalization.py),
// para ser consistente con moneda_from_card_code() (ficha.moneda) en el resto
// de la plataforma. Con la clave equivocada, "Saldo cta. cte." daba $0 al
// mirar la cuenta en pesos, aunque el Estado de cuenta de abajo mostrara el
// total correcto (antiguedad.ts SI usaba "UYU", por eso a el no le pasaba).

function fila(overrides: Partial<EstadoCuentaFila>): EstadoCuentaFila {
  return {
    folio: "1", tipo: "Factura", moneda: "UYU", vendedor: null,
    fecha: "2026-09-01", vencimiento: "2026-09-01", saldo: 100, saldo_corrido: 100,
    ...overrides,
  };
}

describe("agruparPorMoneda", () => {
  it("agrupa por moneda, en orden UYU / USD / EUR, y suma el total de cada grupo", () => {
    const filas = [
      fila({ moneda: "USD", saldo: -10.97 }),
      fila({ moneda: "UYU", saldo: -902.13 }),
      fila({ moneda: "USD", saldo: -5.22 }),
      fila({ moneda: "EUR", saldo: 50 }),
      fila({ moneda: "UYU", saldo: 29499.6 }),
    ];

    const grupos = agruparPorMoneda(filas);

    expect(grupos.map((g) => g.moneda)).toEqual(["UYU", "USD", "EUR"]);
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
    const grupos = agruparPorMoneda([fila({ moneda: "ARS", saldo: 5 }), fila({ moneda: "UYU", saldo: 1 })]);
    expect(grupos.map((g) => g.moneda)).toEqual(["UYU", "ARS"]);
  });

  it("saldo null cuenta como 0 en el total del grupo", () => {
    const grupos = agruparPorMoneda([fila({ moneda: "UYU", saldo: null as unknown as number }), fila({ moneda: "UYU", saldo: 10 })]);
    expect(grupos[0].total).toBe(10);
  });
});

describe("totalCuentaPropia", () => {
  const filas = [
    fila({ moneda: "UYU", saldo: -902.13 }),
    fila({ moneda: "UYU", saldo: 29499.6 }),
    fila({ moneda: "USD", saldo: -10.97 }),
    fila({ moneda: "USD", saldo: -5.22 }),
    fila({ moneda: "USD", saldo: -2.45 }),
  ];

  it("suma solo las filas de la moneda de la cuenta (UYU)", () => {
    // Regresion del bug 2: con la clave equivocada esto daba 0.
    expect(totalCuentaPropia(filas, "UYU")).toBeCloseTo(28597.47);
  });

  it("suma solo las filas de la moneda de la cuenta (USD)", () => {
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
