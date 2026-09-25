import { useCallback, useMemo } from "react";
import { apiFetch } from "../../api/client";
import type {
  BitacoraResponse,
  CompletarTareaRequest,
  CrearRecordatorioRequest,
  EventoBitacora,
  RegistrarGestionRequest,
  TareaBitacora,
} from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiBitacora } from "./useAccionesBitacora";

// Llamadas reales a la API de la Bitacora (contrato Fase 3). Los hooks de
// estado (useBitacora, useAccionesBitacora) las reciben inyectadas.
export function useApiBitacora(): { obtenerBitacora: (cardCode: string) => Promise<BitacoraResponse>; api: ApiBitacora } {
  const getAccessToken = useAccessToken();

  const obtenerBitacora = useCallback(
    async (cardCode: string) => {
      const token = await getAccessToken();
      return apiFetch<BitacoraResponse>(`/api/clientes/${encodeURIComponent(cardCode)}/bitacora`, { token });
    },
    [getAccessToken]
  );

  const api = useMemo<ApiBitacora>(
    () => ({
      registrarGestion: async (cardCode: string, body: RegistrarGestionRequest) => {
        const token = await getAccessToken();
        return apiFetch<EventoBitacora>(`/api/clientes/${encodeURIComponent(cardCode)}/bitacora/eventos`, {
          token,
          method: "POST",
          body,
        });
      },
      crearRecordatorio: async (cardCode: string, body: CrearRecordatorioRequest) => {
        const token = await getAccessToken();
        return apiFetch<TareaBitacora>(`/api/clientes/${encodeURIComponent(cardCode)}/bitacora/tareas`, {
          token,
          method: "POST",
          body,
        });
      },
      completarTarea: async (id: number) => {
        const token = await getAccessToken();
        const body: CompletarTareaRequest = { estado: "completada" };
        return apiFetch<TareaBitacora>(`/api/bitacora/tareas/${id}`, { token, method: "PATCH", body });
      },
    }),
    [getAccessToken]
  );

  return { obtenerBitacora, api };
}
