import type { CobranzaProgramada, DireccionCobranza } from "../../api/types";
import { formatDate, formatMoney } from "../../design/format";
import { hoyUruguay } from "../../utils/fechas";
import { nombreDeUsuario, sumarDias } from "../cliente360/bitacora";

// Entrega 2 (15/10/2026): logica pura de la pestaña "Cobranza programada".
// "Hoy" siempre entra por parametro (YYYY-MM-DD de Montevideo).

export const MAX_DIRECCION = 300;

// "Hoy", "Mañana" o "Ayer" para el selector de dia; null para cualquier otro
// (ahi alcanza con la fecha).
export function etiquetaDia(fecha: string, hoy: string): string | null {
  if (fecha === hoy) return "Hoy";
  if (fecha === sumarDias(hoy, 1)) return "Mañana";
  if (fecha === sumarDias(hoy, -1)) return "Ayer";
  return null;
}

// De donde sale la direccion que se muestra. Sin texto distingue dos casos
// que no son lo mismo: SAP no tiene direccion (se puede cargar) y no se pudo
// consultar SAP (lo dice, no afirma que no hay).
export function fraseOrigenDireccion(direccion: DireccionCobranza, sapFallo: boolean): string {
  if (!direccion.texto) {
    return sapFallo ? "No se pudo traer la dirección de SAP" : "Sin dirección en SAP";
  }
  if (direccion.origen === "plataforma") {
    const autor = direccion.editada_por ? nombreDeUsuario(direccion.editada_por, []) : null;
    const fecha =
      direccion.editada_utc && !Number.isNaN(new Date(direccion.editada_utc).getTime())
        ? formatDate(hoyUruguay(new Date(direccion.editada_utc)))
        : null;
    if (!autor && !fecha) return "Editada en la plataforma";
    return ["Editada", autor ? `por ${autor}` : null, fecha ? `el ${fecha}` : null].filter(Boolean).join(" ");
  }
  return "Dirección de SAP";
}

export function validarDireccion(texto: string): string | null {
  const largo = texto.trim().length;
  if (largo === 0) return "Escribí la dirección.";
  if (largo > MAX_DIRECCION) return `La dirección puede tener hasta ${MAX_DIRECCION} caracteres (tiene ${largo}).`;
  return null;
}

export function importeDeCobranza(cobranza: CobranzaProgramada): string | null {
  return cobranza.importe === null || cobranza.importe === undefined ? null : formatMoney(cobranza.importe, cobranza.moneda);
}

export function nombreDeCobranza(cobranza: Pick<CobranzaProgramada, "cliente_nombre" | "card_code">): string {
  return cobranza.cliente_nombre?.trim() || cobranza.card_code;
}
