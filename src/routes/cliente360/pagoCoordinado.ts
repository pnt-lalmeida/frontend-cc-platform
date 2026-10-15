import type { RegistrarGestionRequest } from "../../api/types";
import { validarFechaNoAnterior, type Errores } from "./bitacora";
import { parsearImporte } from "./promesas";

// Entrega 2 (15/10/2026): "Pago coordinado" con fecha acordada, detras de
// cobranza_programada. Solo fecha (decision del sector: sin hora); el
// horario es un texto libre opcional. Logica pura, "hoy" entra por parametro.

export const RESULTADO_PAGO_COORDINADO = "Pago coordinado";
export const MAX_HORARIO = 60;
// Las que acepta el backend (nunca "$" literal).
export const MONEDAS_COBRANZA = ["UYU", "USD", "EUR"] as const;

export interface FormCobranza {
  fecha_cobranza: string;
  horario: string;
  importe: string;
  moneda: string;
}

export const COBRANZA_VACIA: FormCobranza = { fecha_cobranza: "", horario: "", importe: "", moneda: "UYU" };

export function esPagoCoordinado(resultado: string): boolean {
  return resultado === RESULTADO_PAGO_COORDINADO;
}

export function validarCobranza(form: FormCobranza, hoy: string): Errores<FormCobranza> {
  const errores: Errores<FormCobranza> = {};
  const errorFecha = validarFechaNoAnterior(form.fecha_cobranza, hoy);
  if (errorFecha) errores.fecha_cobranza = form.fecha_cobranza ? errorFecha : "Elegí la fecha acordada.";
  const largo = form.horario.trim().length;
  if (largo > MAX_HORARIO) errores.horario = `El horario puede tener hasta ${MAX_HORARIO} caracteres (tiene ${largo}).`;
  if (form.importe.trim()) {
    const importe = parsearImporte(form.importe);
    if (importe === null) errores.importe = "El importe tiene que ser un número.";
    else if (importe <= 0) errores.importe = "El importe tiene que ser mayor que cero.";
    if (!form.moneda) errores.moneda = "Elegí la moneda.";
    else if (!(MONEDAS_COBRANZA as readonly string[]).includes(form.moneda)) errores.moneda = "Elegí una moneda de la lista.";
  }
  return errores;
}

// Solo se llama con el formulario ya validado. Lo vacio no viaja.
export function sumarCobranzaAlRequest(gestion: RegistrarGestionRequest, form: FormCobranza): RegistrarGestionRequest {
  const horario = form.horario.trim();
  const importe = form.importe.trim() ? parsearImporte(form.importe) : null;
  return {
    ...gestion,
    fecha_cobranza: form.fecha_cobranza,
    ...(horario ? { horario } : {}),
    ...(importe !== null ? { importe, moneda: form.moneda } : {}),
  };
}
