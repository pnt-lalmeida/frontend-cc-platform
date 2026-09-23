import { useEffect, useState } from "react";
import type { AdjuntoRequest, DecisionRequest, DecisionResponse } from "../../api/types";
import { mensajeDeError } from "./errores";

// docs/superpowers/specs/2026-09-21-bandeja-adjuntos-y-suspendido-design.md S1:
// conjunto cerrado, texto final. "Estado de cuenta/carta" es la unica opcion
// que admite adjuntar un archivo (OPCION_CON_ADJUNTO).
export const OPCIONES_APROBAR = ["Emitir", "Estado de cuenta", "Estado de cuenta/carta", "Etiqueta"] as const;
export const OPCION_CON_ADJUNTO: (typeof OPCIONES_APROBAR)[number] = "Estado de cuenta/carta";

interface ParametrosDecision {
  docEntry: number;
  cardCode: string;
  docNum: number;
  decision: "approved" | "rejected";
  motivo?: string;
  adjunto?: AdjuntoRequest;
}

interface EstadoDecision {
  enviando: boolean;
  segundosTranscurridos: number;
  error: string | null;
  decidir: (params: ParametrosDecision) => Promise<DecisionResponse | null>;
  limpiarError: () => void;
}

export function useDecision(
  postDecision: (docEntry: number, body: DecisionRequest) => Promise<DecisionResponse>
): EstadoDecision {
  const [enviando, setEnviando] = useState(false);
  const [segundosTranscurridos, setSegundosTranscurridos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Mismo motivo que useDecisionMultiple.ts (22/09/2026): un pedido
  // individual ya puede tardar varios segundos (SAP + Azure SQL) - un
  // contador deja claro que sigue en curso, no que se colgo.
  useEffect(() => {
    if (!enviando) return;
    const inicio = Date.now();
    const intervalo = setInterval(() => {
      setSegundosTranscurridos(Math.floor((Date.now() - inicio) / 1000));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [enviando]);

  async function decidir(params: ParametrosDecision): Promise<DecisionResponse | null> {
    if (params.decision === "approved" && !params.motivo) {
      setError("Elegí una opción antes de aprobar.");
      return null;
    }

    const body: DecisionRequest =
      params.decision === "approved"
        ? {
            cardCode: params.cardCode,
            docNum: params.docNum,
            decision: params.decision,
            motivo: params.motivo,
            ...(params.motivo === OPCION_CON_ADJUNTO && params.adjunto ? { adjunto: params.adjunto } : {}),
          }
        : { cardCode: params.cardCode, docNum: params.docNum, decision: params.decision };

    setEnviando(true);
    setSegundosTranscurridos(0);
    setError(null);
    try {
      const respuesta = await postDecision(params.docEntry, body);
      setEnviando(false);
      return respuesta;
    } catch (err) {
      setEnviando(false);
      setError(mensajeDeError(err));
      return null;
    }
  }

  function limpiarError() {
    setError(null);
  }

  return { enviando, segundosTranscurridos, error, decidir, limpiarError };
}
