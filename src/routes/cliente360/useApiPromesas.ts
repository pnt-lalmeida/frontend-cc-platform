import { useMemo } from "react";
import { apiFetch } from "../../api/client";
import type { PromesaPago, PromesasResponse, RegistrarPromesaRequest } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiPromesas } from "./usePromesas";

function rutaPromesas(cardCode: string): string {
  return `/api/clientes/${encodeURIComponent(cardCode)}/promesas`;
}

// Llamadas reales de las promesas de pago (contrato Fase 4). El hook de
// estado (usePromesas) las recibe inyectadas.
export function useApiPromesas(): ApiPromesas {
  const getAccessToken = useAccessToken();
  return useMemo<ApiPromesas>(
    () => ({
      obtener: async (cardCode) => {
        const token = await getAccessToken();
        return apiFetch<PromesasResponse>(rutaPromesas(cardCode), { token });
      },
      registrar: async (cardCode, body: RegistrarPromesaRequest) => {
        const token = await getAccessToken();
        return apiFetch<PromesaPago>(rutaPromesas(cardCode), { token, method: "POST", body });
      },
    }),
    [getAccessToken]
  );
}
