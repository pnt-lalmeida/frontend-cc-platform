import { useState } from "react";
import { ApiError } from "../../api/client";
import type { AdjuntoRequest, DecisionRequest, DecisionResponse } from "../../api/types";

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
  error: string | null;
  decidir: (params: ParametrosDecision) => Promise<DecisionResponse | null>;
  limpiarError: () => void;
}

function mensajeDeError(err: unknown): string {
  if (
    err instanceof ApiError &&
    typeof err.body === "object" &&
    err.body !== null &&
    "error" in err.body &&
    typeof (err.body as { error: unknown }).error === "string"
  ) {
    return (err.body as { error: string }).error;
  }
  return "No se pudo registrar la decisión. Intentá de nuevo.";
}

export function useDecision(
  postDecision: (docEntry: number, body: DecisionRequest) => Promise<DecisionResponse>
): EstadoDecision {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return { enviando, error, decidir, limpiarError };
}
