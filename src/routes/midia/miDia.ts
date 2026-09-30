import type { ClienteDelDia, PromesaMiDia, TareaMiDia } from "../../api/types";
import { formatMoneyEntero } from "../../design/format";

// Fase 6 CRM (30/09/2026): logica pura de "Mi dia". Es una lista de trabajo:
// todo lo que decide que se ve, en que orden y cuanto falta vive aca, no en
// el JSX. Las fechas "de calendario" (YYYY-MM-DD) se comparan como dia UTC.

// Mismo valor que NO_CUENTA_COMO_GESTION del backend (shared/bitacora.py): se
// intento contactar y no se logro, asi que el cliente sigue pendiente.
export const RESULTADO_SIN_CONTACTO = "No contactado";

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "setiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function aDiaUTC(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

// "Miércoles 30 de setiembre". Uruguay dice "setiembre", no "septiembre".
export function fechaEncabezado(iso: string): string {
  const fecha = new Date(aDiaUTC(iso));
  return `${DIAS_SEMANA[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]}`;
}

// El encabezado dice cuanto falta, no cuantos hay.
export function textoQuedan(quedan: number, total: number): string {
  if (quedan === 0) {
    return total === 1 ? "Gestionaste el único cliente de hoy" : `No te queda ninguno de los ${total} de hoy`;
  }
  return `${quedan === 1 ? "Te queda" : "Te quedan"} ${quedan} de ${total}`;
}

export function nombreCliente(cliente: ClienteDelDia): string {
  return cliente.nombre?.trim() || cliente.card_code;
}

/* ---------------------------------------------------------------- grupos */

export type ClaveGrupo = "manual" | "automaticos" | "otros" | "mensuales";

// Orden de trabajo, no alfabetico: Manual (alguien tiene que llamar),
// Automaticos (el mail o WhatsApp ya salio), lo que gestiona otra persona, y
// Mensuales al final (otro ritmo).
const GRUPOS: ReadonlyArray<{ clave: ClaveGrupo; titulo: string }> = [
  { clave: "manual", titulo: "Manual" },
  { clave: "automaticos", titulo: "Automáticos" },
  // DECISION REVERSIBLE: el brief no dice donde van Daniel y pagador central
  // (los gestiona otra persona / otra cuenta). Grupo aparte para no mezclarlos
  // con lo que el equipo tiene que hacer, ni esconderlos.
  { clave: "otros", titulo: "Daniel y pagador central" },
  { clave: "mensuales", titulo: "Mensuales" },
];

function grupoDe(cliente: ClienteDelDia): ClaveGrupo {
  if (cliente.origen === "mensual") return "mensuales";
  if (cliente.canal === "manual") return "manual";
  if (cliente.canal === "mail" || cliente.canal === "whatsapp") return "automaticos";
  return "otros";
}

function comparar(a: ClienteDelDia, b: ClienteDelDia): number {
  // Por numero de cliente; los que no tienen, al final y por codigo de cuenta.
  if (a.numero_sn && !b.numero_sn) return -1;
  if (!a.numero_sn && b.numero_sn) return 1;
  const clave = (c: ClienteDelDia) => c.numero_sn ?? c.card_code;
  return clave(a).localeCompare(clave(b), "es", { numeric: true }) || a.card_code.localeCompare(b.card_code);
}

export interface FilaVista {
  cliente: ClienteDelDia;
  // Recien gestionado en esta sesion: se queda en su lugar, apagado, para que
  // las filas de abajo no salten bajo el cursor.
  apagada: boolean;
}

export interface GrupoVista {
  clave: ClaveGrupo;
  titulo: string;
  // Pendientes reales del grupo, con o sin filtro.
  pendientes: number;
  filas: FilaVista[];
}

export interface VistaClientes {
  total: number;
  hechos: number;
  quedan: number;
  grupos: GrupoVista[];
  // Gestionados desde antes de abrir la pantalla: van a "Hechos hoy".
  hechosLista: ClienteDelDia[];
}

interface OpcionesVista {
  recienHechos: ReadonlySet<string>;
  soloVencido: boolean;
}

export function armarVista(clientes: ClienteDelDia[], { recienHechos, soloVencido }: OpcionesVista): VistaClientes {
  const ordenados = [...clientes].sort(comparar);
  const hechosLista: ClienteDelDia[] = [];
  const porGrupo = new Map<ClaveGrupo, { pendientes: number; filas: FilaVista[] }>();
  let hechos = 0;

  for (const cliente of ordenados) {
    const reciente = recienHechos.has(cliente.card_code);
    const hecho = cliente.gestionada_hoy === true;
    if (hecho || reciente) hechos += 1;
    if (hecho && !reciente) {
      hechosLista.push(cliente);
      continue;
    }
    const clave = grupoDe(cliente);
    const grupo = porGrupo.get(clave) ?? { pendientes: 0, filas: [] };
    porGrupo.set(clave, grupo);
    if (!reciente) grupo.pendientes += 1;
    if (!soloVencido || cliente.tiene_vencido) grupo.filas.push({ cliente, apagada: reciente });
  }

  const grupos = GRUPOS.flatMap(({ clave, titulo }) => {
    const grupo = porGrupo.get(clave);
    return grupo && grupo.filas.length > 0 ? [{ clave, titulo, pendientes: grupo.pendientes, filas: grupo.filas }] : [];
  });

  return { total: clientes.length, hechos, quedan: clientes.length - hechos, grupos, hechosLista };
}

function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

export function resumenGrupo(clave: ClaveGrupo, pendientes: number): string {
  if (clave === "mensuales") return pendientes === 0 ? "todos gestionados" : `${pendientes} sin gestionar este mes`;
  return pendientes === 0 ? "todo hecho" : plural(pendientes, "pendiente", "pendientes");
}

/* -------------------------------------------------------------- para hoy */

export interface ItemPromesa {
  id: number;
  cliente: string;
  importe: string;
  cuando: string;
}

export interface ItemRecordatorio {
  id: number;
  descripcion: string;
  cliente: string | null;
  vencido: boolean;
  cuando: string;
}

export interface ParaHoy {
  promesas: ItemPromesa[];
  recordatoriosMios: ItemRecordatorio[];
  recordatoriosDeOtros: ItemRecordatorio[];
  hayAlgo: boolean;
}

function diasDesde(fecha: string, hoy: string): number {
  return Math.round((aDiaUTC(hoy) - aDiaUTC(fecha)) / 86_400_000);
}

function cuandoPromesa(fecha: string, hoy: string): string {
  const dias = diasDesde(fecha, hoy);
  return dias <= 0 ? "vence hoy" : `venció hace ${dias} d`;
}

function recordatorio(tarea: TareaMiDia, hoy: string): ItemRecordatorio {
  const dias = diasDesde(tarea.fecha_objetivo, hoy);
  return {
    id: tarea.id,
    descripcion: tarea.descripcion,
    cliente: tarea.cliente_nombre,
    vencido: dias > 0,
    cuando: dias > 0 ? `hace ${dias} d` : "hoy",
  };
}

// Lo que pesa mas que el barrido de rutina: promesas que vencen y recordatorios
// vencidos o de hoy. Los de otras personas no ensucian la lista de cada uno:
// van aparte (un supervisor igual los ve).
export function armarParaHoy(tareas: TareaMiDia[], promesas: PromesaMiDia[], hoy: string): ParaHoy {
  const ordenadas = [...tareas]
    .filter((t) => t.estado === "pendiente")
    .sort((a, b) => a.fecha_objetivo.localeCompare(b.fecha_objetivo) || a.id - b.id);
  const mios = ordenadas.filter((t) => t.es_mia).map((t) => recordatorio(t, hoy));
  const deOtros = ordenadas.filter((t) => !t.es_mia).map((t) => recordatorio(t, hoy));
  const itemsPromesa = promesas.map<ItemPromesa>((p) => ({
    id: p.id,
    cliente: p.cliente_nombre?.trim() || p.card_code,
    importe: formatMoneyEntero(p.importe, p.moneda),
    cuando: cuandoPromesa(p.fecha_prometida, hoy),
  }));
  return {
    promesas: itemsPromesa,
    recordatoriosMios: mios,
    recordatoriosDeOtros: deOtros,
    hayAlgo: itemsPromesa.length + mios.length + deOtros.length > 0,
  };
}
