import { ApiError } from "../../api/client";
import type {
  CrearRecordatorioRequest,
  EventoBitacora,
  MiembroEquipo,
  RegistrarGestionRequest,
  TareaBitacora,
} from "../../api/types";
import { formatDate } from "../../design/format";

// Fase 3 CRM (25/09/2026): logica pura de la pestaña "Actividad" (Bitacora de
// gestion). Las fechas "de calendario" (fecha_objetivo) viajan como YYYY-MM-DD
// sin hora; se comparan como texto contra el "hoy" local del navegador.

export const MAX_NOTA = 1000;
export const MAX_DESCRIPCION = 500;

function dosDigitos(n: number): string {
  return String(n).padStart(2, "0");
}

export function fechaLocalISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${dosDigitos(fecha.getMonth() + 1)}-${dosDigitos(fecha.getDate())}`;
}

// Aritmetica en UTC para no depender de cambios de hora.
function aDiaUTC(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

export function sumarDias(iso: string, dias: number): string {
  const fecha = new Date(aDiaUTC(iso) + dias * 86_400_000);
  return `${fecha.getUTCFullYear()}-${dosDigitos(fecha.getUTCMonth() + 1)}-${dosDigitos(fecha.getUTCDate())}`;
}

function diferenciaDias(desde: string, hasta: string): number {
  return Math.round((aDiaUTC(hasta) - aDiaUTC(desde)) / 86_400_000);
}

export interface TareasClasificadas {
  vencidas: TareaBitacora[];
  pendientes: TareaBitacora[];
  completadas: TareaBitacora[];
}

// El backend ya ordena (pendientes por fecha ascendente, completadas mas
// recientes primero): aca solo se separa, sin reordenar.
export function clasificarTareas(tareas: TareaBitacora[], hoy: string): TareasClasificadas {
  const resultado: TareasClasificadas = { vencidas: [], pendientes: [], completadas: [] };
  for (const t of tareas) {
    if (t.estado === "completada") resultado.completadas.push(t);
    else if (t.fecha_objetivo < hoy) resultado.vencidas.push(t);
    else resultado.pendientes.push(t);
  }
  return resultado;
}

export interface Vencimiento {
  texto: string;
  variante: "vencida" | "hoy" | "futura";
}

export function describirVencimiento(fechaObjetivo: string, hoy: string): Vencimiento {
  const dias = diferenciaDias(hoy, fechaObjetivo);
  if (dias < -1) return { texto: `Venció hace ${-dias} días`, variante: "vencida" };
  if (dias === -1) return { texto: "Venció ayer", variante: "vencida" };
  if (dias === 0) return { texto: "Hoy", variante: "hoy" };
  if (dias === 1) return { texto: "Mañana", variante: "futura" };
  return { texto: formatDate(fechaObjetivo), variante: "futura" };
}

function buscarEnEquipo(upn: string | null | undefined, equipo: MiembroEquipo[]): MiembroEquipo | undefined {
  if (!upn) return undefined;
  const clave = upn.toLowerCase();
  return equipo.find((m) => m.upn.toLowerCase() === clave);
}

export function nombreDeUsuario(upn: string, equipo: MiembroEquipo[]): string {
  if (!upn) return "—";
  return buscarEnEquipo(upn, equipo)?.nombre ?? upn.split("@")[0];
}

export function responsablePorDefecto(usuarioActual: string | null, equipo: MiembroEquipo[]): string {
  return buscarEnEquipo(usuarioActual, equipo)?.upn ?? "";
}

export function esAutomatico(evento: EventoBitacora): boolean {
  return evento.tipo === "automatico";
}

export function etiquetaEvento(evento: EventoBitacora): string {
  if (!esAutomatico(evento)) return evento.canal ?? "Gestión";
  if (evento.referencia?.startsWith("decision:")) return "Bandeja de autorización";
  if (evento.referencia?.startsWith("tarea:")) return "Recordatorio";
  return "Sistema";
}

export interface GrupoEventos {
  clave: string;
  titulo: string;
  eventos: EventoBitacora[];
}

export function agruparEventosPorDia(eventos: EventoBitacora[], hoy: string): GrupoEventos[] {
  const ayer = sumarDias(hoy, -1);
  const grupos: GrupoEventos[] = [];
  for (const e of eventos) {
    const clave = fechaLocalISO(new Date(e.fecha_utc));
    let grupo = grupos[grupos.length - 1];
    if (!grupo || grupo.clave !== clave) {
      const titulo = clave === hoy ? "Hoy" : clave === ayer ? "Ayer" : formatDate(clave);
      grupo = { clave, titulo, eventos: [] };
      grupos.push(grupo);
    }
    grupo.eventos.push(e);
  }
  return grupos;
}

export function horaLocal(isoTimestamp: string): string {
  const fecha = new Date(isoTimestamp);
  if (Number.isNaN(fecha.getTime())) return "";
  return `${dosDigitos(fecha.getHours())}:${dosDigitos(fecha.getMinutes())}`;
}

export interface FormGestion {
  resultado: string;
  canal: string;
  nota: string;
}

export interface FormRecordatorio {
  descripcion: string;
  fecha_objetivo: string;
  responsable: string;
}

export type Errores<T> = Partial<Record<keyof T, string>>;

export function validarGestion(form: FormGestion, motivos: string[], canales: string[]): Errores<FormGestion> {
  const errores: Errores<FormGestion> = {};
  if (!form.resultado) errores.resultado = "Elegí un motivo.";
  else if (!motivos.includes(form.resultado)) errores.resultado = "Elegí un motivo de la lista.";
  if (form.canal && !canales.includes(form.canal)) errores.canal = "Elegí un canal de la lista.";
  const largoNota = form.nota.trim().length;
  if (largoNota > MAX_NOTA) errores.nota = `La nota puede tener hasta ${MAX_NOTA} caracteres (tiene ${largoNota}).`;
  return errores;
}

function esFechaValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d));
  return fecha.getUTCFullYear() === a && fecha.getUTCMonth() === m - 1 && fecha.getUTCDate() === d;
}

export function validarRecordatorio(form: FormRecordatorio, hoy: string): Errores<FormRecordatorio> {
  const errores: Errores<FormRecordatorio> = {};
  const largo = form.descripcion.trim().length;
  if (largo === 0) errores.descripcion = "Escribí qué hay que hacer.";
  else if (largo > MAX_DESCRIPCION)
    errores.descripcion = `La descripción puede tener hasta ${MAX_DESCRIPCION} caracteres (tiene ${largo}).`;
  if (!form.fecha_objetivo) errores.fecha_objetivo = "Elegí una fecha.";
  else if (!esFechaValida(form.fecha_objetivo)) errores.fecha_objetivo = "La fecha no es válida.";
  else if (form.fecha_objetivo < hoy) errores.fecha_objetivo = "La fecha no puede ser anterior a hoy.";
  return errores;
}

export function hayErrores<T>(errores: Errores<T>): boolean {
  return Object.values(errores).some(Boolean);
}

export function armarGestionRequest(form: FormGestion): RegistrarGestionRequest {
  const nota = form.nota.trim();
  return {
    resultado: form.resultado,
    ...(form.canal ? { canal: form.canal } : {}),
    ...(nota ? { nota } : {}),
  };
}

export function armarRecordatorioRequest(form: FormRecordatorio): CrearRecordatorioRequest {
  return {
    descripcion: form.descripcion.trim(),
    fecha_objetivo: form.fecha_objetivo,
    ...(form.responsable ? { responsable: form.responsable } : {}),
  };
}

export function mensajeDeErrorApi(err: unknown, porDefecto: string): string {
  if (
    err instanceof ApiError &&
    typeof err.body === "object" &&
    err.body !== null &&
    "error" in err.body &&
    typeof (err.body as { error: unknown }).error === "string"
  ) {
    return (err.body as { error: string }).error;
  }
  return porDefecto;
}
