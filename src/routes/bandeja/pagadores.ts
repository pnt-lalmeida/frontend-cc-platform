import type { GrupoCliente } from "./agrupar";

/**
 * PAGADOR CENTRAL EN LA BANDEJA - es solo informacion, no un control.
 * No filtra, no ordena, no agrupa de nuevo, no cambia que pedidos se ven ni
 * habilita/deshabilita nada del flujo de autorizacion. Solo lee los grupos ya
 * armados por agruparPorCliente para poder mostrar que cuentas distintas
 * responden al mismo pagador.
 */
export interface PagadorDeGrupo {
  codigo: string;
  nombre: string | null;
}

export interface ResumenPagador {
  cuentas: number;
  pedidos: number;
}

export function pagadorDeGrupo(grupo: GrupoCliente): PagadorDeGrupo | null {
  const conPagador = grupo.pedidos.find((p) => p.pagador_central);
  if (!conPagador?.pagador_central) return null;
  return { codigo: conPagador.pagador_central, nombre: conPagador.pagador_central_nombre ?? null };
}

/** Por codigo de pagador: cuantas cuentas (grupos) y pedidos hay hoy en la cola visible. */
export function resumenPagadores(grupos: GrupoCliente[]): Map<string, ResumenPagador> {
  const resumen = new Map<string, ResumenPagador>();
  for (const grupo of grupos) {
    const pagador = pagadorDeGrupo(grupo);
    if (!pagador) continue;
    const actual = resumen.get(pagador.codigo) ?? { cuentas: 0, pedidos: 0 };
    resumen.set(pagador.codigo, {
      cuentas: actual.cuentas + 1,
      pedidos: actual.pedidos + grupo.pedidos.length,
    });
  }
  return resumen;
}
