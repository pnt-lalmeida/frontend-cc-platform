import type { Factura } from "../../api/types";
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

function diasDeAtraso(docDueDate: string, hoy: Date): number {
  const vencimiento = new Date(docDueDate);
  const vencimientoUTC = Date.UTC(
    vencimiento.getUTCFullYear(),
    vencimiento.getUTCMonth(),
    vencimiento.getUTCDate()
  );
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return Math.round((hoyUTC - vencimientoUTC) / 86400000);
}
