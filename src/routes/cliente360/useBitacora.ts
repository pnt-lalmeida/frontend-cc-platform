import { useCallback, useEffect, useRef, useState } from "react";
import type { BitacoraResponse } from "../../api/types";

interface EstadoBitacora {
  datos: BitacoraResponse | null;
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
}

interface EstadoInterno {
  datos: BitacoraResponse | null;
  loading: boolean;
  error: string | null;
  // De que cliente es este estado: al cambiar de cliente nunca se muestra la
  // bitacora del anterior (mismo criterio que useIndicadoresPago).
  cardCodeEstado: string | null;
}

const ERROR_CARGA = "No se pudo cargar la bitácora del cliente.";
const ERROR_RECARGA = "No se pudo actualizar la bitácora. Recargá la página para ver lo último.";

export function useBitacora(
  obtenerBitacora: (cardCode: string) => Promise<BitacoraResponse>,
  cardCode: string | null
): EstadoBitacora {
  const [estado, setEstado] = useState<EstadoInterno>({ datos: null, loading: false, error: null, cardCodeEstado: null });
  // Numero de pedido vigente: una respuesta de un pedido anterior (otro
  // cliente, o una recarga superada) se descarta.
  const pedidoVigente = useRef(0);
  // La funcion de fetch va en un ref: si quien la pasa no la memoiza, igual
  // no se dispara un pedido por render (evita un loop de recargas).
  const obtenerRef = useRef(obtenerBitacora);
  obtenerRef.current = obtenerBitacora;
  // Cliente vigente: una recarga disparada por una accion de un cliente
  // anterior (ej. termina un POST despues de cambiar de cuenta) no hace nada,
  // asi no pisa la carga del cliente actual.
  const cardCodeActual = useRef(cardCode);
  cardCodeActual.current = cardCode;

  const cargar = useCallback(
    async (codigo: string): Promise<void> => {
      if (codigo !== cardCodeActual.current) return;
      const pedido = ++pedidoVigente.current;
      setEstado((previo) =>
        previo.cardCodeEstado === codigo
          ? { ...previo, loading: true, error: null }
          : { datos: null, loading: true, error: null, cardCodeEstado: codigo }
      );
      try {
        const datos = await obtenerRef.current(codigo);
        if (pedido === pedidoVigente.current) {
          setEstado({ datos, loading: false, error: null, cardCodeEstado: codigo });
        }
      } catch {
        if (pedido === pedidoVigente.current) {
          setEstado((previo) => ({
            datos: previo.datos,
            loading: false,
            error: previo.datos ? ERROR_RECARGA : ERROR_CARGA,
            cardCodeEstado: codigo,
          }));
        }
      }
    },
    []
  );

  useEffect(() => {
    if (cardCode === null) return;
    void cargar(cardCode);
    return () => {
      // Invalida lo que este en vuelo al desmontar o cambiar de cliente.
      pedidoVigente.current++;
    };
  }, [cargar, cardCode]);

  const recargar = useCallback(async () => {
    if (cardCode !== null) await cargar(cardCode);
  }, [cargar, cardCode]);

  if (cardCode === null) return { datos: null, loading: false, error: null, recargar };
  // Primer render con un cliente nuevo, antes de que corra el efecto.
  if (estado.cardCodeEstado !== cardCode) return { datos: null, loading: true, error: null, recargar };
  return { datos: estado.datos, loading: estado.loading, error: estado.error, recargar };
}
