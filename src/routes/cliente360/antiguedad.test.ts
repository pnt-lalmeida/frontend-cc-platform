import { describe, expect, it } from "vitest";
import type { EstadoCuentaFila } from "../../api/types";
import { calcularAntiguedad, tramoDeDias } from "./antiguedad";

const HOY = "2026-09-25";

function fila(parcial: Partial<EstadoCuentaFila>): EstadoCuentaFila {
  return {
    folio: "1",
    tipo: "Factura",
    moneda: "UYU",
    vendedor: null,
    fecha: "2026-09-01",
    vencimiento: null,
    saldo: 0,
    saldo_corrido: 0,
    ...parcial,
  };
}

// Vencimiento que da exactamente `dias` de atraso respecto de HOY.
function venceHace(dias: number): string {
  const d = new Date(Date.UTC(2026, 8, 25) - dias * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe("tramoDeDias", () => {
  it.each([
    [-5, "a_vencer"],
    [0, "a_vencer"],
    [1, "d0_30"],
    [30, "d0_30"],
    [31, "d31_60"],
    [60, "d31_60"],
    [61, "d61_90"],
    [90, "d61_90"],
    [91, "d91_120"],
    [120, "d91_120"],
    [121, "d121"],
    [900, "d121"],
  ] as const)("%i días de atraso → %s", (dias, tramo) => {
    expect(tramoDeDias(dias)).toBe(tramo);
  });
});

describe("calcularAntiguedad", () => {
  it.each([
    [0, "a_vencer"],
    [1, "d0_30"],
    [30, "d0_30"],
    [31, "d31_60"],
    [60, "d31_60"],
    [61, "d61_90"],
    [120, "d91_120"],
    [121, "d121"],
  ] as const)("una fila vencida hace %i días cae en %s", (dias, tramo) => {
    const [uyu] = calcularAntiguedad([fila({ vencimiento: venceHace(dias), saldo: 100 })], HOY);
    expect(uyu[tramo]).toBe(100);
    expect(uyu.total).toBe(100);
  });

  it("acepta vencimientos con hora (formato de SAP)", () => {
    const [uyu] = calcularAntiguedad([fila({ vencimiento: `${venceHace(61)}T00:00:00Z`, saldo: 10 })], HOY);
    expect(uyu.d61_90).toBe(10);
  });

  it("sin vencimiento usa la fecha del documento", () => {
    const [uyu] = calcularAntiguedad([fila({ vencimiento: null, fecha: venceHace(45), saldo: 7 })], HOY);
    expect(uyu.d31_60).toBe(7);
  });

  it("sin vencimiento ni fecha va a 'a vencer'", () => {
    const [uyu] = calcularAntiguedad([fila({ vencimiento: null, fecha: null, saldo: 7 })], HOY);
    expect(uyu.a_vencer).toBe(7);
  });

  it("los saldos negativos entran en su tramo y restan", () => {
    const [uyu] = calcularAntiguedad(
      [
        fila({ vencimiento: venceHace(70), saldo: 1000 }),
        fila({ vencimiento: venceHace(80), saldo: -300 }),
        fila({ vencimiento: venceHace(10), saldo: -50 }),
      ],
      HOY
    );
    expect(uyu.d61_90).toBe(700);
    expect(uyu.d0_30).toBe(-50);
    expect(uyu.total).toBe(650);
  });

  it("mayor_61 suma 61-90, 91-120 y 121+", () => {
    const [uyu] = calcularAntiguedad(
      [
        fila({ vencimiento: venceHace(60), saldo: 1 }),
        fila({ vencimiento: venceHace(61), saldo: 10 }),
        fila({ vencimiento: venceHace(100), saldo: 100 }),
        fila({ vencimiento: venceHace(200), saldo: 1000 }),
      ],
      HOY
    );
    expect(uyu.mayor_61).toBe(1110);
    expect(uyu.total).toBe(1111);
  });

  it("nunca suma monedas distintas: una fila por moneda, en orden de aparición", () => {
    const resultado = calcularAntiguedad(
      [
        fila({ moneda: "USD", vencimiento: venceHace(90), saldo: 50 }),
        fila({ moneda: "UYU", vencimiento: venceHace(90), saldo: 2000 }),
        fila({ moneda: "USD", vencimiento: venceHace(5), saldo: 25 }),
      ],
      HOY
    );
    expect(resultado.map((m) => m.moneda)).toEqual(["USD", "UYU"]);
    expect(resultado[0].total).toBe(75);
    expect(resultado[0].d61_90).toBe(50);
    expect(resultado[1].total).toBe(2000);
  });

  it("el total coincide con la suma de los tramos y con el saldo corrido final de la moneda", () => {
    const filas = [
      fila({ vencimiento: venceHace(-10), saldo: 120.5, saldo_corrido: 120.5 }),
      fila({ vencimiento: venceHace(15), saldo: 300.25, saldo_corrido: 420.75 }),
      fila({ vencimiento: venceHace(40), saldo: -20.75, saldo_corrido: 400 }),
      fila({ vencimiento: venceHace(95), saldo: 99.9, saldo_corrido: 499.9 }),
      fila({ vencimiento: venceHace(300), saldo: 0.1, saldo_corrido: 500 }),
    ];
    const [uyu] = calcularAntiguedad(filas, HOY);
    const sumaTramos = uyu.a_vencer + uyu.d0_30 + uyu.d31_60 + uyu.d61_90 + uyu.d91_120 + uyu.d121;
    expect(uyu.total).toBeCloseTo(sumaTramos, 6);
    expect(uyu.total).toBeCloseTo(filas[filas.length - 1].saldo_corrido, 6);
  });

  it("ignora saldos null y oculta monedas sin nada", () => {
    const resultado = calcularAntiguedad(
      [
        fila({ moneda: "USD", vencimiento: venceHace(10), saldo: 100 }),
        fila({ moneda: "USD", vencimiento: venceHace(10), saldo: -100 }),
        fila({ moneda: "UYU", saldo: null }),
        fila({ moneda: "EUR", vencimiento: venceHace(70), saldo: 5 }),
      ],
      HOY
    );
    expect(resultado.map((m) => m.moneda)).toEqual(["EUR"]);
  });

  it("una moneda con total 0 pero tramos distintos de 0 se muestra", () => {
    const resultado = calcularAntiguedad(
      [
        fila({ vencimiento: venceHace(100), saldo: 100 }),
        fila({ vencimiento: venceHace(5), saldo: -100 }),
      ],
      HOY
    );
    expect(resultado).toHaveLength(1);
    expect(resultado[0].total).toBe(0);
    expect(resultado[0].mayor_61).toBe(100);
  });

  it("restos de punto flotante no hacen aparecer una moneda en 0", () => {
    const resultado = calcularAntiguedad(
      [
        fila({ vencimiento: venceHace(10), saldo: 0.1 }),
        fila({ vencimiento: venceHace(10), saldo: 0.2 }),
        fila({ vencimiento: venceHace(10), saldo: -0.3 }),
      ],
      HOY
    );
    expect(resultado).toEqual([]);
  });

  it("sin filas no devuelve monedas", () => {
    expect(calcularAntiguedad([], HOY)).toEqual([]);
  });
});
