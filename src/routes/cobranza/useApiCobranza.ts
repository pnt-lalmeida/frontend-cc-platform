import { useCallback, useMemo } from "react";
import { apiFetch, apiFetchArchivo } from "../../api/client";
import type { CobranzaProgramadaResponse, DireccionCobranza } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiAccionesCobranza } from "./useAccionesCobranza";
import type { ApiExportarCobranza } from "./useExportarCobranza";

// Llamadas reales de Cobranza programada (Entrega 2). Los hooks de estado
// (useCobranzaDia, useAccionesCobranza) las reciben inyectadas. Nada de lo
// que viaja por aca (direcciones, horarios) se guarda en el navegador.
export function useApiCobranza(): {
  obtener: (fecha: string) => Promise<CobranzaProgramadaResponse>;
  acciones: ApiAccionesCobranza;
  exportar: ApiExportarCobranza;
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

  // Descargar planilla / registrar impresion (flag cobranza_exportar). Solo se
  // llaman al hacer clic: montar la pantalla no pide nada de esto.
  const exportar = useMemo<ApiExportarCobranza>(
    () => ({
      descargarPlanilla: async (fecha) => {
        const token = await getAccessToken();
        return apiFetchArchivo(`/api/cobranza-programada/exportar?fecha=${encodeURIComponent(fecha)}`, { token });
      },
      registrarImpresion: async (fecha) => {
        const token = await getAccessToken();
        return apiFetch<unknown>("/api/cobranza-programada/exportaciones", {
          token,
          method: "POST",
          body: { fecha, formato: "impresion" },
        });
      },
    }),
    [getAccessToken]
  );

  return useMemo(() => ({ obtener, acciones, exportar }), [obtener, acciones, exportar]);
}
