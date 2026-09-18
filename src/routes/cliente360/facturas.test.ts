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

  it("una fecha de vencimiento futura no esta vencida", () => {
    const hoy = new Date("2026-09-18T12:00:00Z");
    expect(facturaVencida("2026-09-20T00:00:00Z", hoy)).toBe(false);
  });
});
