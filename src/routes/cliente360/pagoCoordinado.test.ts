import { describe, expect, it } from "vitest";
import {
  COBRANZA_VACIA,
  MAX_HORARIO,
  MONEDAS_COBRANZA,
  esPagoCoordinado,
  sumarCobranzaAlRequest,
  validarCobranza,
} from "./pagoCoordinado";

const HOY = "2026-10-15";

describe("esPagoCoordinado", () => {
  it("solo con el resultado exacto", () => {
    expect(esPagoCoordinado("Pago coordinado")).toBe(true);
    expect(esPagoCoordinado("Promesa de pago")).toBe(false);
    expect(esPagoCoordinado("")).toBe(false);
  });
});

describe("validarCobranza", () => {
  it("la fecha es obligatoria", () => {
    expect(validarCobranza(COBRANZA_VACIA, HOY).fecha_cobranza).toBe("Elegí la fecha acordada.");
  });
  it("rechaza fecha inválida y anterior a hoy, acepta hoy y futuras", () => {
    expect(validarCobranza({ ...COBRANZA_VACIA, fecha_cobranza: "2026-02-31" }, HOY).fecha_cobranza).toBe("La fecha no es válida.");
    expect(validarCobranza({ ...COBRANZA_VACIA, fecha_cobranza: "2026-10-14" }, HOY).fecha_cobranza).toBe(
      "La fecha no puede ser anterior a hoy."
    );
    expect(validarCobranza({ ...COBRANZA_VACIA, fecha_cobranza: HOY }, HOY)).toEqual({});
    expect(validarCobranza({ ...COBRANZA_VACIA, fecha_cobranza: "2026-11-02" }, HOY)).toEqual({});
  });
  it("horario hasta 60 caracteres", () => {
    const base = { ...COBRANZA_VACIA, fecha_cobranza: HOY };
    expect(validarCobranza({ ...base, horario: "x".repeat(MAX_HORARIO) }, HOY)).toEqual({});
    expect(validarCobranza({ ...base, horario: "x".repeat(MAX_HORARIO + 1) }, HOY).horario).toContain("60");
  });
  it("importe opcional; si está, número mayor que cero", () => {
    const base = { ...COBRANZA_VACIA, fecha_cobranza: HOY };
    expect(validarCobranza({ ...base, importe: "" }, HOY)).toEqual({});
    expect(validarCobranza({ ...base, importe: "45.000,50" }, HOY)).toEqual({});
    expect(validarCobranza({ ...base, importe: "abc" }, HOY).importe).toBe("El importe tiene que ser un número.");
    expect(validarCobranza({ ...base, importe: "0" }, HOY).importe).toBe("El importe tiene que ser mayor que cero.");
  });
  it("moneda: solo se exige si hay importe, y tiene que ser de la lista", () => {
    const base = { ...COBRANZA_VACIA, fecha_cobranza: HOY };
    expect(validarCobranza({ ...base, moneda: "" }, HOY)).toEqual({});
    expect(validarCobranza({ ...base, importe: "100", moneda: "" }, HOY).moneda).toBe("Elegí la moneda.");
    expect(validarCobranza({ ...base, importe: "100", moneda: "ARS" }, HOY).moneda).toBe("Elegí una moneda de la lista.");
    expect(MONEDAS_COBRANZA).toEqual(["UYU", "USD", "EUR"]);
  });
});

describe("sumarCobranzaAlRequest", () => {
  const gestion = { resultado: "Pago coordinado", nota: "Paga el viernes" };
  it("suma fecha y no manda lo vacío", () => {
    expect(sumarCobranzaAlRequest(gestion, { ...COBRANZA_VACIA, fecha_cobranza: "2026-10-20" })).toEqual({
      ...gestion,
      fecha_cobranza: "2026-10-20",
    });
  });
  it("suma horario recortado, importe numérico y moneda", () => {
    expect(
      sumarCobranzaAlRequest(gestion, {
        fecha_cobranza: "2026-10-20",
        horario: "  14 a 16 h ",
        importe: "45.000,50",
        moneda: "USD",
      })
    ).toEqual({ ...gestion, fecha_cobranza: "2026-10-20", horario: "14 a 16 h", importe: 45000.5, moneda: "USD" });
  });
  it("sin importe no manda moneda aunque haya una elegida", () => {
    const r = sumarCobranzaAlRequest(gestion, { ...COBRANZA_VACIA, fecha_cobranza: "2026-10-20", moneda: "USD" });
    expect(r).not.toHaveProperty("moneda");
    expect(r).not.toHaveProperty("importe");
  });
});
