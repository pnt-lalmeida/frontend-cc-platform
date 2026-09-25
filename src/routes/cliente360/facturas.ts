import { diaCalendario, hoyUruguay } from "../../utils/fechas";

// Vencida = el vencimiento es anterior a "hoy" en Montevideo (no en UTC: a las
// 22 h de Uruguay, en UTC ya es el dia siguiente).
export function facturaVencida(docDueDate: string, hoy: Date = new Date()): boolean {
  const vencimiento = diaCalendario(docDueDate);
  const hoyDia = diaCalendario(hoyUruguay(hoy));
  return vencimiento !== null && hoyDia !== null && vencimiento < hoyDia;
}
