import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatMoney, formatMoneyEntero } from "./format";

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

describe("formatMoneyEntero", () => {
  it("monto completo con separador de miles y sin decimales", () => {
    expect(formatMoneyEntero(740755.54, "USD")).toBe("US$ 740.756");
  });

  it("redondea al entero mas cercano", () => {
    expect(formatMoneyEntero(1432730.4, "UYU")).toBe("$ 1.432.730");
  });

  it("montos chicos sin separador", () => {
    expect(formatMoneyEntero(320.4, "UYU")).toBe("$ 320");
  });

  it("preserva el signo de un valor negativo", () => {
    expect(formatMoneyEntero(-148560.32, "UYU")).toBe("$ -148.560");
  });

  it("devuelve un guion largo para null/undefined", () => {
    expect(formatMoneyEntero(null)).toBe("—");
    expect(formatMoneyEntero(undefined)).toBe("—");
  });

  it("no adivina un simbolo cuando la moneda es explicitamente null", () => {
    expect(formatMoneyEntero(148560.32, null)).toBe("148.560");
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

describe("formatDateTime", () => {
  it("incluye dia y hora (formato DD/MM/AAAA HH:mm, zona horaria del navegador)", () => {
    // No fuerza UTC (a diferencia de formatDate) - la hora depende de la zona
    // del entorno de test, por eso solo se valida la forma, no el valor exacto.
    expect(formatDateTime("2026-09-22T01:06:26+00:00")).toMatch(/^\d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}$/);
  });

  it("devuelve un guion largo para null/undefined/invalido", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
    expect(formatDateTime("no-es-una-fecha")).toBe("—");
  });
});
