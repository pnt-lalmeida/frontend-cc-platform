import { useState } from "react";
import type { DecisionRequest, DecisionResponse } from "../../api/types";

export const OPCIONES_APROBAR = ["Emitir estado de cuenta", "Estado de cuenta", "Carta"] as const;

interface ParametrosDecision {
  docEntry: number;
  cardCode: string;
  docNum: number;
  decision: "approved" | "rejected";
  motivo?: string;
}

interface EstadoDecision {
  enviando: boolean;
  error: string | null;
  decidir: (params: ParametrosDecision) => Promise<DecisionResponse | null>;
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
        ? { cardCode: params.cardCode, docNum: params.docNum, decision: params.decision, motivo: params.motivo }
        : { cardCode: params.cardCode, docNum: params.docNum, decision: params.decision };

    setEnviando(true);
    setError(null);
    try {
      const respuesta = await postDecision(params.docEntry, body);
      setEnviando(false);
      return respuesta;
    } catch {
      setEnviando(false);
      setError("No se pudo registrar la decisión. Intentá de nuevo.");
      return null;
    }
  }

  return { enviando, error, decidir };
}
