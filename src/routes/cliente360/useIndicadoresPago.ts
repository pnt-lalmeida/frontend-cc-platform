import { useEffect, useState } from "react";
import type { IndicadoresPago } from "../../api/types";

export type VentanaMeses = 6 | 12;

interface EstadoIndicadoresPago {
  datos: IndicadoresPago | null;
  loading: boolean;
  error: string | null;
}

interface EstadoInterno extends EstadoIndicadoresPago {
  // De que cliente es este estado: al cambiar de cliente no se muestran los
  // datos (ni el error) del anterior, pero al cambiar solo la ventana los
  // datos quedan mientras carga (evita que el bloque "salte").
  cardCodeEstado: string | null;
}

const SIN_CLIENTE: EstadoIndicadoresPago = { datos: null, loading: false, error: null };

export function useIndicadoresPago(
  obtenerIndicadores: (cardCode: string, ventana: VentanaMeses) => Promise<IndicadoresPago>,
  cardCode: string | null,
  ventana: VentanaMeses
): EstadoIndicadoresPago {
  const [estado, setEstado] = useState<EstadoInterno>({ ...SIN_CLIENTE, cardCodeEstado: null });

  useEffect(() => {
    if (cardCode === null) return;
    let cancelado = false;
    setEstado((previo) =>
      previo.cardCodeEstado === cardCode
        ? { ...previo, loading: true, error: null }
        : { datos: null, loading: true, error: null, cardCodeEstado: cardCode }
    );
    obtenerIndicadores(cardCode, ventana)
      .then((datos) => {
        if (!cancelado) setEstado({ datos, loading: false, error: null, cardCodeEstado: cardCode });
      })
      .catch(() => {
        if (!cancelado) {
          setEstado({
            datos: null,
            loading: false,
            error: "No se pudieron cargar los indicadores de pago.",
            cardCodeEstado: cardCode,
          });
        }
      });
    return () => {
      cancelado = true;
    };
  }, [obtenerIndicadores, cardCode, ventana]);

  if (cardCode === null) return SIN_CLIENTE;
  // Primer render con un cliente nuevo, antes de que corra el efecto.
  if (estado.cardCodeEstado !== cardCode) return { datos: null, loading: true, error: null };
  return { datos: estado.datos, loading: estado.loading, error: estado.error };
}
