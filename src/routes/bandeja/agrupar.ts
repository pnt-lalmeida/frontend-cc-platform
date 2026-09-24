import type { CandidatoBandeja } from "../../api/types";

export interface GrupoCliente {
  clave: string;
  cardCode: string | null;
  cardName: string | null;
  pedidos: CandidatoBandeja[];
}

/**
 * Agrupa por card_code preservando el orden de entrada: la lista ya viene
 * ordenada por fecha mas reciente primero (ordenarPorFechaDesc), asi que el
 * primer pedido de cada cliente que aparece define la posicion del grupo -
 * el grupo con el pedido mas reciente queda primero, sin volver a ordenar.
 */
export function agruparPorCliente(candidatos: CandidatoBandeja[]): GrupoCliente[] {
  const grupos = new Map<string, GrupoCliente>();

  candidatos.forEach((candidato, indice) => {
    const clave = candidato.card_code ?? `sin-cliente-${candidato.doc_entry ?? candidato.doc_num ?? indice}`;
    let grupo = grupos.get(clave);
    if (!grupo) {
      grupo = { clave, cardCode: candidato.card_code, cardName: candidato.card_name, pedidos: [] };
      grupos.set(clave, grupo);
    }
    grupo.pedidos.push(candidato);
  });

  return [...grupos.values()];
}
