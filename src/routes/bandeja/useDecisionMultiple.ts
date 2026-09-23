import { useEffect, useState } from "react";
import type {
  AdjuntoRequest,
  DecisionMultipleRequest,
  DecisionMultipleResponse,
  PedidoParaDecisionMultiple,
} from "../../api/types";
import { mensajeDeError } from "./errores";

interface ParametrosDecisionMultiple {
  pedidos: PedidoParaDecisionMultiple[];
  decision: "approved" | "rejected";
  motivo?: string;
  adjunto?: AdjuntoRequest;
}

export interface ResultadoDecisionMultiple {
  docEntry: number;
  docNum: number;
  ok: boolean;
  mensaje?: string;
}

interface EstadoDecisionMultiple {
  procesando: boolean;
  segundosTranscurridos: number;
  resultados: ResultadoDecisionMultiple[] | null;
  decidirVarios: (params: ParametrosDecisionMultiple) => Promise<ResultadoDecisionMultiple[]>;
  limpiarResultados: () => void;
}

export function useDecisionMultiple(
  postDecisionMultiple: (body: DecisionMultipleRequest) => Promise<DecisionMultipleResponse>
): EstadoDecisionMultiple {
  const [procesando, setProcesando] = useState(false);
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);
  const [resultados, setResultados] = useState<ResultadoDecisionMultiple[] | null>(null);

  // Una sola request para todo el lote (spec 22/09/2026: el backend reutiliza
  // una unica conexion a Azure SQL en vez de 3 por pedido) - a cambio, se
  // pierde el progreso real "X de Y". Este contador de segundos es lo que
  // reemplaza esa señal: no dice cuanto falta, pero deja claro que sigue
  // trabajando, no que se colgo.
  useEffect(() => {
    if (!procesando) return;
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      setSegundosTranscurridos(Math.floor((Date.now() - inicio) / 1000));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [procesando]);

  async function decidirVarios(params: ParametrosDecisionMultiple): Promise<ResultadoDecisionMultiple[]> {
    setProcesando(true);
    setSegundosTranscurridos(0);
    setResultados(null);

    try {
      const respuesta = await postDecisionMultiple({
        decision: params.decision,
        motivo: params.decision === "approved" ? params.motivo : undefined,
        pedidos: params.pedidos,
        adjunto: params.decision === "approved" ? params.adjunto : undefined,
      });
      const items: ResultadoDecisionMultiple[] = respuesta.resultados.map((r) => ({
        docEntry: r.docEntry,
        docNum: r.docNum,
        ok: r.ok,
        mensaje: r.ok ? undefined : r.error ?? "No se pudo procesar.",
      }));
      setResultados(items);
      return items;
    } catch (err) {
      // Fallo la request entera (ej. red caida antes de llegar al backend) -
      // se reporta como fallido para todos los pedidos del lote.
      const mensaje = mensajeDeError(err);
      const items: ResultadoDecisionMultiple[] = params.pedidos.map((p) => ({
        docEntry: p.docEntry,
        docNum: p.docNum,
        ok: false,
        mensaje,
      }));
      setResultados(items);
      return items;
    } finally {
      setProcesando(false);
    }
  }

  function limpiarResultados() {
    setResultados(null);
  }

  return { procesando, segundosTranscurridos, resultados, decidirVarios, limpiarResultados };
}
