import { useCallback, useMemo } from "react";
import { apiFetch } from "../../api/client";
import type {
  BitacoraResponse,
  CompletarTareaRequest,
  CrearRecordatorioRequest,
  EventoBitacora,
  FiltroBitacora,
  PaginaEventosBitacora,
  RegistrarGestionRequest,
  TareaBitacora,
} from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";
import type { ApiBitacora } from "./useAccionesBitacora";
import type { FuentesBitacora } from "./useBitacora";

function rutaBitacora(cardCode: string): string {
  return `/api/clientes/${encodeURIComponent(cardCode)}/bitacora`;
}

// "todo" es el default del backend: no se manda, la URL queda igual que antes.
function conQuery(ruta: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) if (valor) query.set(clave, valor);
  const texto = query.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

function tipoParaQuery(tipo: FiltroBitacora): string | undefined {
  return tipo === "todo" ? undefined : tipo;
}

// Llamadas reales a la API de la Bitacora (contrato Fase 3 + Bitacora v2).
// Los hooks de estado (useBitacora, useAccionesBitacora) las reciben inyectadas.
export function useApiBitacora(): { fuentes: FuentesBitacora; api: ApiBitacora } {
  const getAccessToken = useAccessToken();

  const obtenerBitacora = useCallback(
    async (cardCode: string, tipo: FiltroBitacora) => {
      const token = await getAccessToken();
      return apiFetch<BitacoraResponse>(conQuery(rutaBitacora(cardCode), { tipo: tipoParaQuery(tipo) }), { token });
    },
    [getAccessToken]
  );

  const obtenerEventos = useCallback(
    async (cardCode: string, { tipo, antesDe }: { tipo: FiltroBitacora; antesDe?: string }) => {
      const token = await getAccessToken();
      return apiFetch<PaginaEventosBitacora>(
        conQuery(`${rutaBitacora(cardCode)}/eventos`, { antes_de: antesDe, tipo: tipoParaQuery(tipo) }),
        { token }
      );
    },
    [getAccessToken]
  );

  const fuentes = useMemo<FuentesBitacora>(() => ({ obtenerBitacora, obtenerEventos }), [obtenerBitacora, obtenerEventos]);

  const api = useMemo<ApiBitacora>(
    () => ({
      registrarGestion: async (cardCode: string, body: RegistrarGestionRequest) => {
        const token = await getAccessToken();
        return apiFetch<EventoBitacora>(`${rutaBitacora(cardCode)}/eventos`, { token, method: "POST", body });
      },
      crearRecordatorio: async (cardCode: string, body: CrearRecordatorioRequest) => {
        const token = await getAccessToken();
        return apiFetch<TareaBitacora>(`${rutaBitacora(cardCode)}/tareas`, { token, method: "POST", body });
      },
      completarTarea: async (id: number) => {
        const token = await getAccessToken();
        const body: CompletarTareaRequest = { estado: "completada" };
        return apiFetch<TareaBitacora>(`/api/bitacora/tareas/${id}`, { token, method: "PATCH", body });
      },
    }),
    [getAccessToken]
  );

  return { fuentes, api };
}
