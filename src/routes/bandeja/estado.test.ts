import { describe, expect, it } from "vitest";
import { variantParaEstadoBandeja } from "./estado";

describe("variantParaEstadoBandeja", () => {
  it("Pendiente es caution", () => {
    expect(variantParaEstadoBandeja("Pendiente")).toBe("caution");
  });

  it("Rechazado es risk (nunca resuelto, mas urgente que Pendiente)", () => {
    expect(variantParaEstadoBandeja("Rechazado")).toBe("risk");
  });

  it("nunca devuelve ok - un valor desconocido es neutral, no se inventa un color", () => {
    expect(variantParaEstadoBandeja("OK")).toBe("neutral");
    expect(variantParaEstadoBandeja("Zoho")).toBe("neutral");
  });

  it("null es neutral", () => {
    expect(variantParaEstadoBandeja(null)).toBe("neutral");
  });
});
