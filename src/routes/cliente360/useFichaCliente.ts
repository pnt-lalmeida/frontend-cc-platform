import { useEffect, useState } from "react";
import { apiFetch } from "../../api/client";
import type { FacturasResponse, Factura, FichaCliente, Pedido, PedidosResponse } from "../../api/types";
import { useAccessToken } from "../../auth/useAccessToken";

interface EstadoFicha {
  ficha: FichaCliente | null;
  facturas: Factura[];
  pedidos: Pedido[];
  loading: boolean;
  error: string | null;
}

const ESTADO_VACIO: EstadoFicha = {
  ficha: null,
  facturas: [],
  pedidos: [],
  loading: false,
  error: null,
};

export function useFichaCliente(cardCode: string | null): EstadoFicha {
  const getAccessToken = useAccessToken();
  const [estado, setEstado] = useState<EstadoFicha>(ESTADO_VACIO);

  useEffect(() => {
    if (!cardCode) {
      setEstado(ESTADO_VACIO);
      return;
    }

    let cancelado = false;
    setEstado((previo) => ({ ...previo, loading: true, error: null }));

    async function cargar() {
      try {
        const token = await getAccessToken();
        const [ficha, facturasResponse, pedidosResponse] = await Promise.all([
          apiFetch<FichaCliente>(`/api/clientes/${cardCode}`, { token }),
          apiFetch<FacturasResponse>(`/api/clientes/${cardCode}/facturas`, { token }),
          apiFetch<PedidosResponse>(`/api/clientes/${cardCode}/pedidos`, { token }),
        ]);
        if (cancelado) return;
        setEstado({
          ficha,
          facturas: facturasResponse.facturas,
          pedidos: pedidosResponse.pedidos,
          loading: false,
          error: null,
        });
      } catch {
        if (cancelado) return;
        setEstado({
          ficha: null,
          facturas: [],
          pedidos: [],
          loading: false,
          error: "No se pudo cargar la información del cliente.",
        });
      }
    }

    cargar();

    return () => {
      cancelado = true;
    };
  }, [cardCode, getAccessToken]);

  return estado;
}
