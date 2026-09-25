import type { EstadoCuentaFila } from "../../api/types";
import { diaCalendario } from "../../utils/fechas";

// Antiguedad de saldos (planilla semanal del equipo, Architecture.md punto 48).
// Se calcula sobre las filas del Estado de cuenta que Cliente 360 ya carga
// (consolidadas con el pagador central): no hay endpoint propio. "Hoy" lo
// pasa quien llama, como la fecha de Montevideo (utils/fechas).

export type Tramo = "a_vencer" | "d0_30" | "d31_60" | "d61_90" | "d91_120" | "d121";

export const TRAMOS: { key: Tramo; label: string }[] = [
  { key: "a_vencer", label: "A vencer" },
  { key: "d0_30", label: "0-30 días" },
  { key: "d31_60", label: "31-60 días" },
  { key: "d61_90", label: "61-90 días" },
  { key: "d91_120", label: "91-120 días" },
  { key: "d121", label: "121+ días" },
];

// Los tramos que forman "Más de 61 días", la cifra que sigue el equipo.
export const TRAMOS_MAYOR_61: Tramo[] = ["d61_90", "d91_120", "d121"];

export type AntiguedadMoneda = Record<Tramo, number> & {
  moneda: string | null;
  total: number;
  mayor_61: number;
};

export function tramoDeDias(dias: number): Tramo {
  if (dias <= 0) return "a_vencer";
  if (dias <= 30) return "d0_30";
  if (dias <= 60) return "d31_60";
  if (dias <= 90) return "d61_90";
  if (dias <= 120) return "d91_120";
  return "d121";
}

function diasDeAtraso(fila: EstadoCuentaFila, hoy: number): number | null {
  const referencia = fila.vencimiento ?? fila.fecha;
  if (!referencia) return null;
  const dia = diaCalendario(referencia);
  return dia === null ? null : Math.round((hoy - dia) / 86_400_000);
}

function aCentavos(valor: number): number {
  const redondeado = Math.round(valor * 100) / 100;
  return redondeado === 0 ? 0 : redondeado; // sin -0
}

function vacia(moneda: string | null): AntiguedadMoneda {
  return { moneda, a_vencer: 0, d0_30: 0, d31_60: 0, d61_90: 0, d91_120: 0, d121: 0, total: 0, mayor_61: 0 };
}

// Una entrada por moneda, en el orden en que aparecen. Nunca se suman monedas.
// Los saldos negativos (recibos o notas de credito sin aplicar) entran en su
// tramo segun su fecha, como el reporte de antiguedad de SAP.
export function calcularAntiguedad(filas: EstadoCuentaFila[], hoy: string): AntiguedadMoneda[] {
  const hoyDia = diaCalendario(hoy) ?? 0;
  const porMoneda = new Map<string | null, AntiguedadMoneda>();

  for (const fila of filas) {
    if (fila.saldo === null || fila.saldo === undefined) continue;
    let acumulado = porMoneda.get(fila.moneda);
    if (!acumulado) {
      acumulado = vacia(fila.moneda);
      porMoneda.set(fila.moneda, acumulado);
    }
    const dias = diasDeAtraso(fila, hoyDia);
    const tramo = dias === null ? "a_vencer" : tramoDeDias(dias);
    acumulado[tramo] += fila.saldo;
    acumulado.total += fila.saldo;
  }

  const resultado: AntiguedadMoneda[] = [];
  for (const m of porMoneda.values()) {
    // A centavos: evita restos de punto flotante (ej. 0,1 + 0,2 − 0,3) que
    // mostrarian una moneda "con saldo" que en realidad esta en 0.
    for (const { key } of TRAMOS) m[key] = aCentavos(m[key]);
    m.total = aCentavos(m.total);
    m.mayor_61 = aCentavos(TRAMOS_MAYOR_61.reduce((suma, t) => suma + m[t], 0));
    const hayAlgo = m.total !== 0 || TRAMOS.some(({ key }) => m[key] !== 0);
    if (hayAlgo) resultado.push(m);
  }
  return resultado;
}
