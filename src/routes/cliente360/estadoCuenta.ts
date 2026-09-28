import type { EstadoCuentaFila } from "../../api/types";

export interface GrupoEstadoCuenta {
  // Tal cual viene en EstadoCuentaFila.moneda: "$" (pesos), "USD", "EUR"...
  moneda: string;
  filas: EstadoCuentaFila[];
  total: number;
}

// Orden fijo, igual al de los prefijos de cliente (C1/C2/C3, Architecture.md
// S4.4). Una moneda no reconocida va al final, en el orden en que aparece.
const ORDEN_MONEDA: Record<string, number> = { $: 0, USD: 1, EUR: 2 };

// Agrupa el Estado de cuenta (que consolida por numero_sn y por eso mezcla
// pesos/dolares en una sola tabla) por moneda, para mostrarlo sin confundir.
export function agruparPorMoneda(filas: EstadoCuentaFila[]): GrupoEstadoCuenta[] {
  const porMoneda = new Map<string, EstadoCuentaFila[]>();
  for (const fila of filas) {
    const clave = fila.moneda ?? "—";
    const grupo = porMoneda.get(clave);
    if (grupo) grupo.push(fila);
    else porMoneda.set(clave, [fila]);
  }
  return [...porMoneda.entries()]
    .map(([moneda, filasDeGrupo]) => ({
      moneda,
      filas: filasDeGrupo,
      total: filasDeGrupo.reduce((acumulado, f) => acumulado + (f.saldo ?? 0), 0),
    }))
    .sort((a, b) => (ORDEN_MONEDA[a.moneda] ?? 99) - (ORDEN_MONEDA[b.moneda] ?? 99));
}

// FichaCliente.moneda ("UYU"/"USD"/"EUR", de moneda_from_card_code en el
// backend) al simbolo que usa el Estado de cuenta ("$"/"USD"/"EUR").
const SIMBOLO_DE_MONEDA_FICHA: Record<string, string> = { UYU: "$", USD: "USD", EUR: "EUR" };

// Saldo de la cuenta EN SU PROPIA MONEDA, calculado con el mismo criterio que
// el Estado de cuenta (FC cuando corresponde), no el campo crudo de SAP
// (CurrentAccountBalance viene siempre en moneda local del sistema - pesos -
// y mostrarlo con el simbolo de una cuenta en dolares/euros es enganioso:
// bug real encontrado 28/09/2026, confirmado contra SAP y HANA).
// null si no se puede determinar la moneda de la cuenta; 0 (no null) si la
// moneda es valida pero no hay filas - es un saldo cero real, no un dato
// faltante.
export function totalCuentaPropia(filas: EstadoCuentaFila[], monedaFicha: string | null): number | null {
  if (!monedaFicha) return null;
  const simbolo = SIMBOLO_DE_MONEDA_FICHA[monedaFicha];
  if (!simbolo) return null;
  const grupo = agruparPorMoneda(filas).find((g) => g.moneda === simbolo);
  return grupo ? grupo.total : 0;
}
