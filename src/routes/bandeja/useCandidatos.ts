import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { CandidatoBandeja, CandidatosResponse } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";

interface EstadoCandidatos {
  candidatos: CandidatoBandeja[];
  loading: boolean;
  error: string | null;
  recargar: () => void;
}

export function useCandidatos(): EstadoCandidatos {
  const getAccessToken = useAccessToken();
  const [candidatos, setCandidatos] = useState<CandidatoBandeja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const respuesta = await apiFetch<CandidatosResponse>("/api/bandeja/candidatos", { token });
        if (cancelado) return;
        setCandidatos(respuesta.candidatos);
        setLoading(false);
      } catch {
        if (cancelado) return;
        setCandidatos([]);
        setError("No se pudo cargar la lista de pedidos.");
        setLoading(false);
      }
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [getAccessToken, version]);

  return { candidatos, loading, error, recargar };
}
