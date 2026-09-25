import { useCallback, useMemo } from "react";
import { apiFetch } from "../../api/client";
import type { ActualizarAlertaRequest, Alerta, AlertasResponse, MarcarVistasResponse } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiAlertas } from "./useAccionesAlertas";

// Llamadas reales a la API del Centro de alertas (contrato Fase 2). Los hooks
// de estado (useAlertas, useAccionesAlertas) las reciben inyectadas.
export function useApiAlertas(): { obtenerAlertas: () => Promise<AlertasResponse>; api: ApiAlertas } {
  const getAccessToken = useAccessToken();

  const obtenerAlertas = useCallback(async () => {
    const token = await getAccessToken();
    return apiFetch<AlertasResponse>("/api/alertas", { token });
  }, [getAccessToken]);

  const api = useMemo<ApiAlertas>(
    () => ({
      actualizarAlerta: async (id: number, estado: ActualizarAlertaRequest["estado"]) => {
        const token = await getAccessToken();
        const body: ActualizarAlertaRequest = { estado };
        return apiFetch<Alerta>(`/api/alertas/${id}`, { token, method: "PATCH", body });
      },
      marcarTodasVistas: async () => {
        const token = await getAccessToken();
        return apiFetch<MarcarVistasResponse>("/api/alertas/marcar-vistas", { token, method: "POST" });
      },
    }),
    [getAccessToken]
  );

  return { obtenerAlertas, api };
}
