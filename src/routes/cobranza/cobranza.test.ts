import { describe, expect, it } from "vitest";
import type { CobranzaProgramada, DireccionCobranza } from "../../api/types";
import {
  MAX_DIRECCION,
  etiquetaDia,
  fraseOrigenDireccion,
  importeDeCobranza,
  nombreDeCobranza,
  validarDireccion,
} from "./cobranza";

const HOY = "2026-10-15";

describe("etiquetaDia", () => {
  it("hoy, mañana y ayer; otro día, null", () => {
    expect(etiquetaDia("2026-10-15", HOY)).toBe("Hoy");
    expect(etiquetaDia("2026-10-16", HOY)).toBe("Mañana");
    expect(etiquetaDia("2026-10-14", HOY)).toBe("Ayer");
    expect(etiquetaDia("2026-10-20", HOY)).toBeNull();
    expect(etiquetaDia("2026-11-01", "2026-10-31")).toBe("Mañana");
  });
});

describe("fraseOrigenDireccion", () => {
  const dir = (p: Partial<DireccionCobranza>): DireccionCobranza => ({
    texto: "18 de Julio 1234",
    origen: "sap",
    editada_por: null,
    editada_utc: null,
    ...p,
  });
  it("de SAP", () => {
    expect(fraseOrigenDireccion(dir({}), false)).toBe("Dirección de SAP");
  });
  it("editada en la plataforma: quién y cuándo (día de Montevideo)", () => {
    // 15/10 01:00 UTC es 14/10 22:00 en Montevideo.
    expect(
      fraseOrigenDireccion(dir({ origen: "plataforma", editada_por: "rlopez@pontyn.com.uy", editada_utc: "2026-10-15T01:00:00Z" }), false)
    ).toBe("Editada por rlopez el 14/10/2026");
  });
  it("editada sin autor o sin fecha no deja huecos", () => {
    expect(fraseOrigenDireccion(dir({ origen: "plataforma", editada_por: "rlopez@pontyn.com.uy" }), false)).toBe("Editada por rlopez");
    expect(fraseOrigenDireccion(dir({ origen: "plataforma" }), false)).toBe("Editada en la plataforma");
  });
  it("sin texto: distingue que no hay en SAP de que no se pudo traer", () => {
    const vacia = dir({ texto: null, origen: null });
    expect(fraseOrigenDireccion(vacia, false)).toBe("Sin dirección en SAP");
    expect(fraseOrigenDireccion(vacia, true)).toBe("No se pudo traer la dirección de SAP");
  });
});

describe("validarDireccion", () => {
  it("obligatoria, hasta 300 caracteres", () => {
    expect(validarDireccion("   ")).toBe("Escribí la dirección.");
    expect(validarDireccion("Rivera 2020")).toBeNull();
    expect(validarDireccion("x".repeat(MAX_DIRECCION))).toBeNull();
    expect(validarDireccion("x".repeat(MAX_DIRECCION + 1))).toContain("300");
  });
});

describe("importeDeCobranza / nombreDeCobranza", () => {
  const base = { cliente_nombre: "Dulces del Sur", card_code: "C1-02928", importe: 45000, moneda: "UYU" } as CobranzaProgramada;
  it("importe formateado con su moneda; sin importe, null", () => {
    expect(importeDeCobranza(base)).toBe("$ 45.000,00");
    expect(importeDeCobranza({ ...base, moneda: "USD", importe: 1200.5 })).toBe("US$ 1.200,50");
    expect(importeDeCobranza({ ...base, importe: null })).toBeNull();
  });
  it("nombre, o el card_code si no hay", () => {
    expect(nombreDeCobranza(base)).toBe("Dulces del Sur");
    expect(nombreDeCobranza({ ...base, cliente_nombre: "  " })).toBe("C1-02928");
    expect(nombreDeCobranza({ ...base, cliente_nombre: null })).toBe("C1-02928");
  });
});
