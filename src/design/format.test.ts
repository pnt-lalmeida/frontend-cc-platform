import { describe, expect, it } from "vitest";
import { formatDate, formatMoney } from "./format";

describe("formatMoney", () => {
  it("formatea UYU con coma decimal y punto de miles", () => {
    expect(formatMoney(1250.5, "UYU")).toBe("$ 1.250,50");
  });

  it("usa el simbolo de USD", () => {
    expect(formatMoney(732413.83, "USD")).toBe("US$ 732.413,83");
  });

  it("usa el simbolo de EUR", () => {
    expect(formatMoney(100, "EUR")).toBe("€ 100,00");
  });

  it("default a UYU cuando no se pasa moneda", () => {
    expect(formatMoney(10)).toBe("$ 10,00");
  });

  it("devuelve un guion largo para null/undefined", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("no adivina un simbolo cuando la moneda es explicitamente null", () => {
    expect(formatMoney(100, null)).toBe("100,00");
  });

  it("muestra el codigo de moneda tal cual si no esta en la tabla de simbolos", () => {
    expect(formatMoney(100, "C4")).toBe("C4 100,00");
  });
});

describe("formatDate", () => {
  it("formatea a DD/MM/AAAA en UTC, sin corrimiento de dia", () => {
    // Uruguay es UTC-3: sin forzar UTC este caso se mostraria como 26/07/2026.
    expect(formatDate("2026-07-27T00:00:00Z")).toBe("27/07/2026");
  });

  it("devuelve un guion largo para null/undefined/invalido", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("no-es-una-fecha")).toBe("—");
  });
});
