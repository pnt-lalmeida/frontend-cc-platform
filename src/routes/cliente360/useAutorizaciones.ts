import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { Autorizacion, AutorizacionesResponse } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";

interface EstadoAutorizaciones {
  autorizaciones: Autorizacion[];
  loading: boolean;
  error: string | null;
}

const ESTADO_VACIO: EstadoAutorizaciones = {
  autorizaciones: [],
  loading: false,
  error: null,
};

export function useAutorizaciones(cardCode: string | null): EstadoAutorizaciones {
  const getAccessToken = useAccessToken();
  const [estado, setEstado] = useState<EstadoAutorizaciones>(ESTADO_VACIO);

  useEffect(() => {
    if (!cardCode) {
      setEstado(ESTADO_VACIO);
      return;
    }

    let cancelado = false;
    setEstado((previo) => ({ ...previo, loading: true, error: null }));
    const cardCodeCodificado = encodeURIComponent(cardCode);

    async function cargar() {
      try {
        const token = await getAccessToken();
        const respuesta = await apiFetch<AutorizacionesResponse>(
          `/api/clientes/${cardCodeCodificado}/autorizaciones`,
          { token }
        );
        if (cancelado) return;
        setEstado({ autorizaciones: respuesta.autorizaciones, loading: false, error: null });
      } catch {
        if (cancelado) return;
        setEstado({ autorizaciones: [], loading: false, error: "No se pudo cargar el historial de autorizaciones." });
      }
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [cardCode, getAccessToken]);

  return estado;
}
