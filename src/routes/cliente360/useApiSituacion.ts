import { useMemo } from "react";
import { apiFetch } from "../../api/client";
import type { GuardarSituacionRequest, SituacionCuentaResponse } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiSituacion } from "./useSituacionCuenta";

// Llamadas reales de la Situacion de la cuenta (contrato Fase A). El hook de
// estado (useSituacionCuenta) las recibe inyectadas.
export function useApiSituacion(): ApiSituacion {
  const getAccessToken = useAccessToken();
  return useMemo<ApiSituacion>(
    () => ({
      obtener: async (cardCode) => {
        const token = await getAccessToken();
        return apiFetch<SituacionCuentaResponse>(`/api/clientes/${encodeURIComponent(cardCode)}/situacion`, { token });
      },
      guardar: async (cardCode, situacion) => {
        const token = await getAccessToken();
        const body: GuardarSituacionRequest = { situacion };
        return apiFetch<SituacionCuentaResponse>(`/api/clientes/${encodeURIComponent(cardCode)}/situacion`, {
          token,
          method: "PUT",
          body,
        });
      },
    }),
    [getAccessToken]
  );
}
