import { describe, expect, it } from "vitest";
import { facturaVencida } from "./facturas";

describe("facturaVencida", () => {
  it("una fecha de vencimiento anterior a hoy esta vencida", () => {
    const hoy = new Date("2026-09-18T12:00:00Z");
    expect(facturaVencida("2026-09-17T00:00:00Z", hoy)).toBe(true);
  });

  it("una fecha de vencimiento de hoy no esta vencida", () => {
    const hoy = new Date("2026-09-18T12:00:00Z");
    expect(facturaVencida("2026-09-18T00:00:00Z", hoy)).toBe(false);
  });

  it("a las 22 h de Uruguay usa la fecha de Montevideo aunque en UTC ya sea el dia siguiente", () => {
    // 25/09 22:00 en Montevideo = 26/09 01:00 UTC.
    const hoy = new Date("2026-09-26T01:00:00Z");
    expect(facturaVencida("2026-09-25T00:00:00Z", hoy)).toBe(false);
    expect(facturaVencida("2026-09-24T00:00:00Z", hoy)).toBe(true);
  });

  it("una fecha de vencimiento futura no esta vencida", () => {
    const hoy = new Date("2026-09-18T12:00:00Z");
    expect(facturaVencida("2026-09-20T00:00:00Z", hoy)).toBe(false);
  });
});
