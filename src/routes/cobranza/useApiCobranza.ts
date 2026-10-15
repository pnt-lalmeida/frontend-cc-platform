import { useCallback, useMemo } from "react";
import { apiFetch } from "../../api/client";
import type { CobranzaProgramadaResponse, DireccionCobranza } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiAccionesCobranza } from "./useAccionesCobranza";

// Llamadas reales de Cobranza programada (Entrega 2). Los hooks de estado
// (useCobranzaDia, useAccionesCobranza) las reciben inyectadas. Nada de lo
// que viaja por aca (direcciones, horarios) se guarda en el navegador.
export function useApiCobranza(): {
  obtener: (fecha: string) => Promise<CobranzaProgramadaResponse>;
  acciones: ApiAccionesCobranza;
} {
  const getAccessToken = useAccessToken();

  const obtener = useCallback(
    async (fecha: string) => {
      const token = await getAccessToken();
      return apiFetch<CobranzaProgramadaResponse>(`/api/cobranza-programada?fecha=${encodeURIComponent(fecha)}`, { token });
    },
    [getAccessToken]
  );

  const acciones = useMemo<ApiAccionesCobranza>(
    () => ({
      guardarDireccion: async (cardCode, direccion) => {
        const token = await getAccessToken();
        return apiFetch<DireccionCobranza>(`/api/clientes/${encodeURIComponent(cardCode)}/direccion-cobranza`, {
          token,
          method: "PUT",
          body: { direccion },
        });
      },
      anular: async (id) => {
        const token = await getAccessToken();
        return apiFetch<unknown>(`/api/cobranza-programada/${id}`, { token, method: "PATCH", body: { estado: "anulada" } });
      },
    }),
    [getAccessToken]
  );

  return useMemo(() => ({ obtener, acciones }), [obtener, acciones]);
}
