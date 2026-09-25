import type { Factura } from "../../api/types";
import { diaCalendario, hoyUruguay } from "../../utils/fechas";
import { facturaVencida } from "./facturas";

export interface ResumenFacturas {
  saldoVencido: number;
  atrasoActualDias: number | null;
  pctAlDia: number;
  pctVencido: number;
}

export function calcularResumenFacturas(facturas: Factura[], hoy: Date = new Date()): ResumenFacturas {
  if (facturas.length === 0) {
    return { saldoVencido: 0, atrasoActualDias: null, pctAlDia: 100, pctVencido: 0 };
  }

  let saldoVencido = 0;
  let totalFacturas = 0;
  let maxAtrasoDias: number | null = null;

  for (const factura of facturas) {
    totalFacturas += factura.doc_total;
    if (facturaVencida(factura.doc_due_date, hoy)) {
      saldoVencido += factura.doc_total;
      const dias = diasDeAtraso(factura.doc_due_date, hoy);
      if (maxAtrasoDias === null || dias > maxAtrasoDias) {
        maxAtrasoDias = dias;
      }
    }
  }

  const pctVencido = totalFacturas > 0 ? (saldoVencido / totalFacturas) * 100 : 0;

  return {
    saldoVencido,
    atrasoActualDias: maxAtrasoDias,
    pctAlDia: 100 - pctVencido,
    pctVencido,
  };
}

// "Hoy" en Montevideo (mismo criterio que facturaVencida): despues de las 21 h
// de Uruguay, en UTC ya es el dia siguiente y sumaba un dia de mas.
function diasDeAtraso(docDueDate: string, hoy: Date): number {
  const vencimiento = diaCalendario(docDueDate) ?? 0;
  const hoyDia = diaCalendario(hoyUruguay(hoy)) ?? 0;
  return Math.round((hoyDia - vencimiento) / 86400000);
}
