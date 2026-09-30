import { useCallback, useMemo } from "react";
import { apiFetch } from "../../api/client";
import type { BitacoraResponse, EventoBitacora, MiDiaResponse, RegistrarGestionRequest } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiRegistroMiDia } from "./useRegistroMiDia";

// Llamadas reales de Mi dia (contrato Fase 6). Los hooks de estado
// (useMiDia, useRegistroMiDia) las reciben inyectadas.
export function useApiMiDia(): { obtener: () => Promise<MiDiaResponse>; registro: ApiRegistroMiDia } {
  const getAccessToken = useAccessToken();

  const obtener = useCallback(async () => {
    const token = await getAccessToken();
    return apiFetch<MiDiaResponse>("/api/mi-dia", { token });
  }, [getAccessToken]);

  const registro = useMemo<ApiRegistroMiDia>(
    () => ({
      // Mismo endpoint que la Bitacora: el evento queda en la ficha del cliente.
      registrar: async (cardCode: string, body: RegistrarGestionRequest) => {
        const token = await getAccessToken();
        return apiFetch<EventoBitacora>(`/api/clientes/${encodeURIComponent(cardCode)}/bitacora/eventos`, {
          token,
          method: "POST",
          body,
        });
      },
      // La lista de resultados ya viaja en la Bitacora ("motivos"): se reusa
      // en vez de duplicarla en el frontend.
      obtenerResultados: async (cardCode: string) => {
        const token = await getAccessToken();
        const bitacora = await apiFetch<BitacoraResponse>(`/api/clientes/${encodeURIComponent(cardCode)}/bitacora`, {
          token,
        });
        return bitacora.motivos;
      },
    }),
    [getAccessToken]
  );

  return useMemo(() => ({ obtener, registro }), [obtener, registro]);
}
