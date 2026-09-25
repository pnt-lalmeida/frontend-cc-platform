import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { EstadoCuentaFila, EstadoCuentaResponse, PagadorCentral } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";

interface EstadoDeCuenta {
  filas: EstadoCuentaFila[];
  pagadorCentral: PagadorCentral | null;
  loading: boolean;
  error: string | null;
}

const ESTADO_VACIO: EstadoDeCuenta = {
  filas: [],
  pagadorCentral: null,
  loading: false,
  error: null,
};

export function useEstadoCuenta(cardCode: string | null): EstadoDeCuenta {
  const getAccessToken = useAccessToken();
  const [estado, setEstado] = useState<EstadoDeCuenta>(ESTADO_VACIO);

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
        const respuesta = await apiFetch<EstadoCuentaResponse>(
          `/api/clientes/${cardCodeCodificado}/estado-cuenta`,
          { token }
        );
        if (cancelado) return;
        setEstado({
          filas: respuesta.estado_cuenta,
          pagadorCentral: respuesta.pagador_central ?? null,
          loading: false,
          error: null,
        });
      } catch {
        if (cancelado) return;
        setEstado({ filas: [], pagadorCentral: null, loading: false, error: "No se pudo cargar el estado de cuenta." });
      }
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [cardCode, getAccessToken]);

  return estado;
}
