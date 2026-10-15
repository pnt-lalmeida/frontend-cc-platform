import { describe, expect, it } from "vitest";
import { motivosDeRetencion } from "./motivos";

const base = { status_aprobacion: "Pendiente" };

describe("motivosDeRetencion", () => {
  it("deuda vencida sola", () => {
    expect(motivosDeRetencion({ ...base, motivo_deuda_vencida: true, motivo_tope_cedula: false })).toEqual(["Deuda vencida"]);
  });
  it("tope cedula solo", () => {
    expect(motivosDeRetencion({ ...base, motivo_deuda_vencida: false, motivo_tope_cedula: true })).toEqual(["Tope cédula"]);
  });
  it("los dos, deuda primero", () => {
    expect(motivosDeRetencion({ ...base, motivo_deuda_vencida: true, motivo_tope_cedula: true })).toEqual(["Deuda vencida", "Tope cédula"]);
  });
  it("ninguno y rechazado: ya sin deuda vencida", () => {
    expect(motivosDeRetencion({ status_aprobacion: "Rechazado", motivo_deuda_vencida: false, motivo_tope_cedula: false })).toEqual(["Ya sin deuda vencida"]);
  });
  it("ninguno y pendiente: nada", () => {
    expect(motivosDeRetencion({ ...base, motivo_deuda_vencida: false, motivo_tope_cedula: false })).toEqual([]);
  });
  it("backend viejo (campos ausentes o null): nada, tampoco en rechazados", () => {
    expect(motivosDeRetencion({ status_aprobacion: "Rechazado" })).toEqual([]);
    expect(motivosDeRetencion({ status_aprobacion: "Rechazado", motivo_deuda_vencida: null, motivo_tope_cedula: null })).toEqual([]);
    expect(motivosDeRetencion({ status_aprobacion: "Rechazado", motivo_deuda_vencida: false })).toEqual([]);
  });
});
