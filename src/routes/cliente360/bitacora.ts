import { ApiError } from "../../api/client";
import type {
  CrearRecordatorioRequest,
  EventoBitacora,
  FiltroBitacora,
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

/* ------------------------------------------------ Bitácora v2 (28/09/2026) */

// Los automaticos de la Bandeja no tienen id (se arman en la lectura): la
// clave es su referencia + instante.
export function claveEvento(evento: EventoBitacora): string {
  return evento.id !== null ? `e${evento.id}` : `${evento.referencia ?? "sin-ref"}@${evento.fecha_utc}`;
}

export type ItemHistorial =
  | { tipo: "evento"; clave: string; evento: EventoBitacora }
  | { tipo: "grupo"; clave: string; resultado: string; eventos: EventoBitacora[] };

export interface DiaHistorial {
  clave: string;
  titulo: string;
  items: ItemHistorial[];
}

function diaLocal(evento: EventoBitacora): string {
  return fechaLocalISO(new Date(evento.fecha_utc));
}

// Automaticos consecutivos del mismo dia local y el mismo resultado van en un
// solo grupo; uno suelto queda como evento. Las gestiones cortan el grupo.
export function agruparAutomaticos(eventos: EventoBitacora[]): ItemHistorial[] {
  const items: ItemHistorial[] = [];
  let corrida: EventoBitacora[] = [];
  const cerrar = () => {
    if (corrida.length === 1) items.push({ tipo: "evento", clave: claveEvento(corrida[0]), evento: corrida[0] });
    else if (corrida.length > 1)
      items.push({ tipo: "grupo", clave: `g:${claveEvento(corrida[0])}`, resultado: corrida[0].resultado, eventos: corrida });
    corrida = [];
  };
  for (const e of eventos) {
    if (!esAutomatico(e)) {
      cerrar();
      items.push({ tipo: "evento", clave: claveEvento(e), evento: e });
      continue;
    }
    const previo = corrida[0];
    if (previo && (previo.resultado !== e.resultado || diaLocal(previo) !== diaLocal(e))) cerrar();
    corrida.push(e);
  }
  cerrar();
  return items;
}

// Se arma siempre sobre todo lo cargado: al sumar una pagina que sigue el
// mismo dia, el dia completo se reagrupa (no queda un grupo partido).
export function armarHistorial(eventos: EventoBitacora[], hoy: string): DiaHistorial[] {
  return agruparEventosPorDia(eventos, hoy).map((dia) => ({
    clave: dia.clave,
    titulo: dia.titulo,
    items: agruparAutomaticos(dia.eventos),
  }));
}

const PLURALES: Record<string, [string, string]> = {
  "Pedido autorizado": ["pedido autorizado", "pedidos autorizados"],
  "Pedido rechazado": ["pedido rechazado", "pedidos rechazados"],
  "Recordatorio completado": ["recordatorio completado", "recordatorios completados"],
  "Situación de la cuenta": ["cambio de situación de la cuenta", "cambios de situación de la cuenta"],
};

export function tituloGrupo(resultado: string, cantidad: number): string {
  const formas = PLURALES[resultado];
  if (!formas) return `${resultado} (${cantidad})`;
  return `${cantidad} ${cantidad === 1 ? formas[0] : formas[1]}`;
}

export interface DescripcionGrupo {
  titulo: string;
  quien: string;
  rango: string;
}

// `eventos` viene en fecha descendente (como la API): el rango va del ultimo
// (mas temprano) al primero.
export function describirGrupo(eventos: EventoBitacora[], equipo: MiembroEquipo[]): DescripcionGrupo {
  const personas = new Set(eventos.map((e) => e.origen.toLowerCase()));
  const desde = horaLocal(eventos[eventos.length - 1].fecha_utc);
  const hasta = horaLocal(eventos[0].fecha_utc);
  return {
    titulo: tituloGrupo(eventos[0].resultado, eventos.length),
    quien: personas.size === 1 ? nombreDeUsuario(eventos[0].origen, equipo) : `${personas.size} personas`,
    rango: desde === hasta ? desde : `${desde}–${hasta}`,
  };
}

const DIAS_RELATIVOS = 60;

export function haceCuanto(isoTimestamp: string, hoy: string): string {
  const dia = fechaLocalISO(new Date(isoTimestamp));
  const dias = diferenciaDias(dia, hoy);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias <= DIAS_RELATIVOS) return `hace ${dias} días`;
  return `el ${formatDate(dia)}`;
}

export interface DescripcionUltimaGestion {
  cuando: string;
  detalle: string;
}

export const SIN_GESTIONES = "Todavía no hay gestiones registradas";

export function describirUltimaGestion(
  evento: EventoBitacora | null,
  equipo: MiembroEquipo[],
  hoy: string
): DescripcionUltimaGestion | null {
  if (!evento) return null;
  return {
    cuando: haceCuanto(evento.fecha_utc, hoy),
    detalle: `${evento.resultado} (${nombreDeUsuario(evento.origen, equipo)})`,
  };
}

export function textoUltimaGestion(evento: EventoBitacora | null, equipo: MiembroEquipo[], hoy: string): string {
  const d = describirUltimaGestion(evento, equipo, hoy);
  return d ? `Última gestión: ${d.cuando} — ${d.detalle}` : SIN_GESTIONES;
}

export interface DescripcionRecordatorios {
  pendientes: string;
  vencidas: string | null;
}

// `pendientes` incluye las vencidas (contrato del resumen).
export function describirRecordatorios(pendientes: number, vencidas: number): DescripcionRecordatorios | null {
  if (pendientes <= 0) return null;
  return {
    pendientes: `${pendientes} ${pendientes === 1 ? "recordatorio pendiente" : "recordatorios pendientes"}`,
    vencidas: vencidas > 0 ? `${vencidas} ${vencidas === 1 ? "vencido" : "vencidos"}` : null,
  };
}

export const FILTROS: ReadonlyArray<{ clave: FiltroBitacora; etiqueta: string }> = [
  { clave: "todo", etiqueta: "Todo" },
  { clave: "gestiones", etiqueta: "Gestiones" },
  { clave: "autorizaciones", etiqueta: "Autorizaciones" },
  { clave: "situacion", etiqueta: "Situación" },
];

export function esFiltro(valor: unknown): valor is FiltroBitacora {
  return FILTROS.some((f) => f.clave === valor);
}

// "Registrar" y no "el panel de la derecha": en celular el panel queda arriba.
const VACIOS: Record<FiltroBitacora, string> = {
  todo: "Todavía no hay actividad para este cliente. Registrá la primera gestión desde el panel Registrar.",
  gestiones: "No hay gestiones registradas. Registrá la primera desde el panel Registrar.",
  autorizaciones: "No hay pedidos autorizados ni rechazados desde la Bandeja para este cliente.",
  situacion: "No hay cambios de situación de la cuenta registrados.",
};

export function vacioDeFiltro(filtro: FiltroBitacora): string {
  return VACIOS[filtro];
}

// Por persona: en una PC compartida cada usuario recupera su propio filtro.
export function claveFiltroGuardado(usuario: string | null): string {
  return `pontyn.bitacora.filtro:${(usuario ?? "").toLowerCase()}`;
}

// localStorage puede no existir o tirar (modo privado, bloqueado): nunca rompe
// la pestaña, queda en "Todo".
export function leerFiltroGuardado(usuario: string | null): FiltroBitacora {
  try {
    const valor = window.localStorage.getItem(claveFiltroGuardado(usuario));
    return esFiltro(valor) ? valor : "todo";
  } catch {
    return "todo";
  }
}

export function guardarFiltro(usuario: string | null, filtro: FiltroBitacora): void {
  try {
    window.localStorage.setItem(claveFiltroGuardado(usuario), filtro);
  } catch {
    // Sin persistencia: el filtro vale solo mientras la pestaña esta abierta.
  }
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
