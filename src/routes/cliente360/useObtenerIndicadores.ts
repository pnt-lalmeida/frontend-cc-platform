import { useCallback } from "react";
import { apiFetch } from "../../api/client";
import type { IndicadoresPago } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { VentanaMeses } from "./useIndicadoresPago";

export function useObtenerIndicadores() {
  const getAccessToken = useAccessToken();
  return useCallback(
    async (cardCode: string, ventana: VentanaMeses): Promise<IndicadoresPago> => {
      const token = await getAccessToken();
      return apiFetch<IndicadoresPago>(
        `/api/clientes/${encodeURIComponent(cardCode)}/indicadores?ventana=${ventana}`,
        { token }
      );
    },
    [getAccessToken]
  );
}
