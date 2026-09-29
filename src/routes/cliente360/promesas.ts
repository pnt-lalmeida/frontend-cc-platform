import type { EstadoPromesa, MiembroEquipo, PromesaPago, RegistrarPromesaRequest } from "../../api/types";
import type { StatusTagVariant } from "../../components/StatusTag";
import { formatDate, formatMoney } from "../../design/format";
import { hoyUruguay } from "../../utils/fechas";
import { esFechaValida, nombreDeUsuario, type Errores } from "./bitacora";

// Fase 4 CRM (29/09/2026): logica pura de las promesas de pago. Ninguna
// funcion lee la fecha del sistema: "hoy" siempre entra por parametro (como
// YYYY-MM-DD de Montevideo, ver hoyUruguay), asi los bordes (hoy, mañana,
// ayer, cambio de mes o de año) se prueban con fechas fijas.
//
// El historial (cumplida, incumplida, "cumplida con cheque a N dias") NO se
// arma aca: el backend lo escribe como evento de la Bitacora y se lee desde
// la linea de tiempo. Solo se muestra lo vigente.

export const MAX_FACTURAS = 500;

const MS_POR_DIA = 86_400_000;

function aDiaUTC(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
}

// Dias de calendario desde "hoy" hasta la fecha: 0 hoy, positivo a futuro,
// negativo si ya paso. Aritmetica en UTC sobre dias enteros: no depende de la
// zona del navegador ni de cambios de hora.
export function diasHastaVencimiento(fechaPrometida: string, hoy: string): number {
  return Math.round((aDiaUTC(fechaPrometida) - aDiaUTC(hoy)) / MS_POR_DIA);
}

// La frase que se lee primero en el bloque de vigentes. Una promesa vencida
// que sigue vigente es una que el proceso automatico todavia no verifico:
// "verificando" evita que parezca un incumplimiento ya confirmado.
export function fraseVencimiento(fechaPrometida: string, hoy: string): string | null {
  if (!esFechaValida(fechaPrometida) || !esFechaValida(hoy)) return null;
  const dias = diasHastaVencimiento(fechaPrometida, hoy);
  if (dias === 0) return "vence hoy";
  if (dias === 1) return "vence mañana";
  if (dias > 1) return `vence en ${dias} días`;
  if (dias === -1) return "venció ayer, verificando";
  return `venció hace ${-dias} días, verificando`;
}

export function esVigente(promesa: PromesaPago): boolean {
  return promesa.estado === "vigente" || promesa.estado === "vencida_a_verificar";
}

// Lo pendiente que necesita seguimiento, lo mas proximo primero. Sin mutar la entrada.
export function vigentesOrdenadas(promesas: PromesaPago[]): PromesaPago[] {
  return promesas
    .filter(esVigente)
    .sort(
      (a, b) =>
        a.fecha_prometida.localeCompare(b.fecha_prometida) ||
        a.registrada_utc.localeCompare(b.registrada_utc) ||
        a.id - b.id
    );
}

const VARIANTE_ESTADO: Record<EstadoPromesa, StatusTagVariant> = {
  vigente: "neutral",
  vencida_a_verificar: "neutral",
  cumplida: "ok",
  cumplida_parcial: "caution",
  incumplida: "risk",
  renegociada: "neutral",
};

const ETIQUETA_ESTADO: Record<EstadoPromesa, string> = {
  vigente: "Vigente",
  vencida_a_verificar: "Verificando",
  cumplida: "Cumplida",
  cumplida_parcial: "Cumplida en parte",
  incumplida: "Incumplida",
  renegociada: "Renegociada",
};

export function varianteEstadoPromesa(estado: EstadoPromesa): StatusTagVariant {
  return VARIANTE_ESTADO[estado];
}

export function etiquetaEstadoPromesa(estado: EstadoPromesa): string {
  return ETIQUETA_ESTADO[estado];
}

// Quien la registro y cuando, como linea tenue (mismo criterio que
// textoActualizada de la situacion de la cuenta). El dia es el uruguayo.
export function textoRegistrada(promesa: PromesaPago, equipo: MiembroEquipo[]): string {
  const fecha =
    promesa.registrada_utc && !Number.isNaN(new Date(promesa.registrada_utc).getTime())
      ? formatDate(hoyUruguay(new Date(promesa.registrada_utc)))
      : null;
  const nombre = promesa.registrada_por ? nombreDeUsuario(promesa.registrada_por, equipo) : null;
  return ["Registrada", nombre ? `por ${nombre}` : null, fecha ? `el ${fecha}` : null].filter(Boolean).join(" ");
}

// "02/10" si es del mismo año que hoy; con año si no (evita ambiguedad en diciembre/enero).
function fechaCorta(iso: string, hoy: string): string {
  const completa = formatDate(iso);
  return iso.slice(0, 4) === hoy.slice(0, 4) ? completa.slice(0, 5) : completa;
}

// Linea de contexto del detalle de la Bandeja. SOLO informa: no filtra, no
// ordena y no habilita ni bloquea nada de la autorizacion.
export function lineaPromesaBandeja(promesas: PromesaPago[], hoy: string): string | null {
  const vigentes = vigentesOrdenadas(promesas);
  if (vigentes.length === 0) return null;
  const proxima = vigentes[0];
  const otras = vigentes.length - 1;
  return [
    `Prometió ${formatMoney(proxima.importe, proxima.moneda)} para el ${fechaCorta(proxima.fecha_prometida, hoy)}`,
    fraseVencimiento(proxima.fecha_prometida, hoy),
    otras > 0 ? `${otras} promesa${otras === 1 ? "" : "s"} más` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Importe tal como lo escribe una persona en Uruguay: "45.000", "45.000,50",
// "45000,5". El punto es de miles salvo que sea claramente decimal ("450.5",
// "1200.50"). Devuelve null si no se puede leer.
export function parsearImporte(texto: string): number | null {
  const limpio = texto.replace(/[\s$]/g, "");
  if (!/^[\d.,]+$/.test(limpio)) return null;
  const MILES = /^\d{1,3}(\.\d{3})+$/;
  let numero: string;
  if (limpio.includes(",")) {
    const partes = limpio.split(",");
    if (partes.length !== 2) return null;
    const [entero, decimales] = partes;
    if (!/^\d+$/.test(decimales)) return null;
    if (MILES.test(entero)) numero = `${entero.replace(/\./g, "")}.${decimales}`;
    else if (/^\d+$/.test(entero)) numero = `${entero}.${decimales}`;
    else return null;
  } else if (limpio.includes(".")) {
    if (MILES.test(limpio)) numero = limpio.replace(/\./g, "");
    else if (/^\d+\.\d+$/.test(limpio)) numero = limpio;
    else return null;
  } else {
    numero = limpio;
  }
  const valor = Number(numero);
  return Number.isFinite(valor) ? Math.round(valor * 100) / 100 : null;
}

export interface FormPromesa {
  fecha_prometida: string;
  importe: string;
  moneda: string;
  canal: string;
  facturas: string;
}

// Refleja lo que valida el backend (validar_promesa). Bloquear fechas pasadas
// es solo una ayuda del frontend, no una regla del backend.
export function validarPromesa(
  form: FormPromesa,
  hoy: string,
  monedas: string[],
  canales: string[]
): Errores<FormPromesa> {
  const errores: Errores<FormPromesa> = {};
  if (!form.fecha_prometida) errores.fecha_prometida = "Elegí la fecha en que va a pagar.";
  else if (!esFechaValida(form.fecha_prometida)) errores.fecha_prometida = "La fecha no es válida.";
  else if (form.fecha_prometida < hoy) errores.fecha_prometida = "La fecha no puede ser anterior a hoy.";

  if (!form.importe.trim()) errores.importe = "Escribí el importe prometido.";
  else {
    const importe = parsearImporte(form.importe);
    if (importe === null) errores.importe = "El importe tiene que ser un número.";
    else if (importe <= 0) errores.importe = "El importe tiene que ser mayor que cero.";
  }

  if (!form.moneda) errores.moneda = "Elegí la moneda.";
  else if (!monedas.includes(form.moneda)) errores.moneda = "Elegí una moneda de la lista.";

  if (form.canal && !canales.includes(form.canal)) errores.canal = "Elegí un canal de la lista.";

  const largo = form.facturas.trim().length;
  if (largo > MAX_FACTURAS)
    errores.facturas = `Las facturas pueden tener hasta ${MAX_FACTURAS} caracteres (tiene ${largo}).`;
  return errores;
}

// Solo se llama con el formulario ya validado.
export function armarPromesaRequest(form: FormPromesa): RegistrarPromesaRequest {
  const facturas = form.facturas.trim();
  return {
    fecha_prometida: form.fecha_prometida,
    importe: parsearImporte(form.importe) ?? 0,
    moneda: form.moneda,
    ...(form.canal ? { canal: form.canal } : {}),
    ...(facturas ? { facturas } : {}),
  };
}
