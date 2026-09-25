import type { IndicadoresPago, TendenciaPago } from "../../api/types";
import type { StatusTagVariant } from "../../components/StatusTag";

export interface TagTendencia {
  texto: string;
  variant: StatusTagVariant;
}

const TAGS_TENDENCIA: Record<TendenciaPago, TagTendencia> = {
  mejora: { texto: "Mejora", variant: "ok" },
  empeora: { texto: "Empeora", variant: "risk" },
  estable: { texto: "Estable", variant: "neutral" },
};

export function tagTendencia(tendencia: TendenciaPago | null): TagTendencia | null {
  return tendencia ? TAGS_TENDENCIA[tendencia] : null;
}

const FORMATO_DIAS = new Intl.NumberFormat("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

function redondear(dias: number): number {
  return Math.round(dias * 10) / 10;
}

export function formatearDias(dias: number | null): string {
  if (dias === null) return "—";
  const redondeado = redondear(dias);
  return `${FORMATO_DIAS.format(redondeado)} ${redondeado === 1 ? "día" : "días"}`;
}

export interface DescripcionAtraso {
  valor: string;
  detalle: string;
}

// El atraso negativo (pagó antes de vencer) se muestra sin signo menos: para
// cobranza "-3 días de atraso" se lee como un error, "3 días antes" no.
export function describirAtraso(dias: number | null): DescripcionAtraso {
  if (dias === null) return { valor: "—", detalle: "" };
  const redondeado = redondear(dias);
  if (redondeado === 0) return { valor: "En fecha", detalle: "paga el día del vencimiento" };
  if (redondeado < 0) return { valor: formatearDias(-redondeado), detalle: "antes del vencimiento" };
  return { valor: formatearDias(redondeado), detalle: "después del vencimiento" };
}

export function textoFacturasConsideradas(cantidad: number, ventanaMeses: number): string {
  const facturas = cantidad === 1 ? "factura cobrada" : "facturas cobradas";
  return `Sobre ${cantidad} ${facturas} en los últimos ${ventanaMeses} meses`;
}

export interface LineaBandeja {
  texto: string;
  tendencia: TagTendencia | null;
  completo: string;
}

function atrasoCorto(dias: number | null): string {
  const redondeado = dias === null ? null : redondear(dias);
  if (redondeado === null) return "atraso sin dato";
  if (redondeado === 0) return "en fecha";
  if (redondeado < 0) return `${formatearDias(-redondeado)} antes del vencimiento prom.`;
  return `${formatearDias(redondeado)} de atraso prom.`;
}

export function lineaBandeja(datos: IndicadoresPago): LineaBandeja {
  if (!datos.historial_suficiente) {
    const texto = "Sin historial de pagos suficiente";
    return { texto, tendencia: null, completo: texto };
  }
  const texto = `Paga en ${formatearDias(datos.dias_para_cobrar)} prom. · ${atrasoCorto(datos.dias_atraso)}`;
  const tendencia = tagTendencia(datos.tendencia);
  return { texto, tendencia, completo: tendencia ? `${texto} · ${tendencia.texto}` : texto };
}

export function textoAtrasoAnterior(dias: number): string {
  const redondeado = redondear(dias);
  if (redondeado === 0) return "Período anterior: en fecha";
  if (redondeado < 0) return `Período anterior: ${formatearDias(-redondeado)} antes del vencimiento`;
  return `Período anterior: ${formatearDias(redondeado)} de atraso`;
}

export function textoHistorialInsuficiente(cantidad: number, minimo: number, ventanaMeses: number): string {
  if (cantidad === 0) return `No hay facturas cobradas en los últimos ${ventanaMeses} meses.`;
  const facturas = cantidad === 1 ? "factura cobrada" : "facturas cobradas";
  return `Hay ${cantidad} ${facturas} en los últimos ${ventanaMeses} meses; se necesitan al menos ${minimo}.`;
}
