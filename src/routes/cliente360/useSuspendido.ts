import { useState } from "react";
import { ApiError } from "../../api/client";
import type { SuspendidoResponse } from "../../api/types";

interface EstadoSuspendido {
  enviando: boolean;
  error: string | null;
  actualizar: (suspendido: boolean) => Promise<SuspendidoResponse | null>;
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
  return "No se pudo actualizar el estado del cliente. Intentá de nuevo.";
}

export function useSuspendido(
  patchSuspendido: (suspendido: boolean) => Promise<SuspendidoResponse>
): EstadoSuspendido {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function actualizar(suspendido: boolean): Promise<SuspendidoResponse | null> {
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await patchSuspendido(suspendido);
      setEnviando(false);
      return respuesta;
    } catch (err) {
      setEnviando(false);
      setError(mensajeDeError(err));
      return null;
    }
  }

  return { enviando, error, actualizar };
}
