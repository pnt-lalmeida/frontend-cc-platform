import { useState } from "react";
import type { DecisionRequest, DecisionResponse } from "../../api/types";
import { mensajeDeError } from "./errores";

interface PedidoAProcesar {
  docEntry: number;
  cardCode: string;
  docNum: number;
}

interface ParametrosDecisionMultiple {
  pedidos: PedidoAProcesar[];
  decision: "approved" | "rejected";
  motivo?: string;
}

export interface ResultadoDecisionMultiple {
  docEntry: number;
  docNum: number;
  ok: boolean;
  mensaje?: string;
}

interface EstadoDecisionMultiple {
  procesando: boolean;
  progreso: { actual: number; total: number } | null;
  resultados: ResultadoDecisionMultiple[] | null;
  decidirVarios: (params: ParametrosDecisionMultiple) => Promise<ResultadoDecisionMultiple[]>;
  limpiarResultados: () => void;
}

export function useDecisionMultiple(
  postDecision: (docEntry: number, body: DecisionRequest) => Promise<DecisionResponse>
): EstadoDecisionMultiple {
  const [procesando, setProcesando] = useState(false);
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);
  const [resultados, setResultados] = useState<ResultadoDecisionMultiple[] | null>(null);

  async function decidirVarios(params: ParametrosDecisionMultiple): Promise<ResultadoDecisionMultiple[]> {
    const { pedidos, decision, motivo } = params;
    setProcesando(true);
    setResultados(null);

    // Secuencial a proposito, no Promise.all: evita saturar SAP con N
    // requests en simultaneo y permite mostrar progreso real ("3 de 8").
    // Un pedido que falla no frena al resto - se sigue y se reporta al final.
    const items: ResultadoDecisionMultiple[] = [];
    for (let i = 0; i < pedidos.length; i++) {
      const pedido = pedidos[i];
      setProgreso({ actual: i + 1, total: pedidos.length });
      const body: DecisionRequest =
        decision === "approved"
          ? { cardCode: pedido.cardCode, docNum: pedido.docNum, decision, motivo }
          : { cardCode: pedido.cardCode, docNum: pedido.docNum, decision };
      try {
        await postDecision(pedido.docEntry, body);
        items.push({ docEntry: pedido.docEntry, docNum: pedido.docNum, ok: true });
      } catch (err) {
        items.push({ docEntry: pedido.docEntry, docNum: pedido.docNum, ok: false, mensaje: mensajeDeError(err) });
      }
    }

    setResultados(items);
    setProgreso(null);
    setProcesando(false);
    return items;
  }

  function limpiarResultados() {
    setResultados(null);
  }

  return { procesando, progreso, resultados, decidirVarios, limpiarResultados };
}
