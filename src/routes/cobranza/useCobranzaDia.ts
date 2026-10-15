import { useCallback, useEffect, useRef, useState } from "react";
import type { CobranzaProgramadaResponse, DireccionCobranza } from "../../api/types";

export interface EstadoCobranzaDia {
  // null mientras carga el dia elegido o si fallo la primera carga.
  datos: CobranzaProgramadaResponse | null;
  cargando: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  // Cambios locales tras una accion confirmada por el backend.
  quitar: (id: number) => void;
  reemplazarDireccion: (cardCode: string, direccion: DireccionCobranza) => void;
}

interface Estado {
  // De que dia es este estado: al cambiar de dia nunca se muestra la lista del anterior.
  fecha: string;
  datos: CobranzaProgramadaResponse | null;
  cargando: boolean;
  error: string | null;
}

const ERROR_CARGA = "No se pudieron cargar las cobranzas.";
const ERROR_RECARGA = "No se pudo actualizar. Lo que ves puede estar desactualizado.";

// GET /api/cobranza-programada?fecha=. Solo vale la respuesta del dia vigente
// y del ultimo pedido: una que llega despues de cambiar de dia se descarta,
// nunca pisa lo que se muestra. Un error nunca deja la pantalla cargando, y
// una recarga fallida conserva la lista (no se blanquea la agenda del cobrador
// por un corte de red).
export function useCobranzaDia(obtener: (fecha: string) => Promise<CobranzaProgramadaResponse>, fecha: string): EstadoCobranzaDia {
  const [estado, setEstado] = useState<Estado>({ fecha, datos: null, cargando: true, error: null });
  const obtenerRef = useRef(obtener);
  obtenerRef.current = obtener;
  const fechaVigente = useRef(fecha);
  fechaVigente.current = fecha;
  const generacion = useRef(0);

  const cargar = useCallback(async (dia: string): Promise<void> => {
    const gen = ++generacion.current;
    setEstado((previo) =>
      previo.fecha === dia ? { ...previo, cargando: true, error: null } : { fecha: dia, datos: null, cargando: true, error: null }
    );
    try {
      const datos = await obtenerRef.current(dia);
      if (gen !== generacion.current || dia !== fechaVigente.current) return;
      setEstado({ fecha: dia, datos, cargando: false, error: null });
    } catch {
      if (gen !== generacion.current || dia !== fechaVigente.current) return;
      setEstado((previo) => ({
        fecha: dia,
        datos: previo.fecha === dia ? previo.datos : null,
        cargando: false,
        error: previo.fecha === dia && previo.datos ? ERROR_RECARGA : ERROR_CARGA,
      }));
    }
  }, []);

  useEffect(() => {
    void cargar(fecha);
    // Al desmontar o cambiar de dia, lo que este en vuelo queda invalidado.
    return () => {
      generacion.current += 1;
    };
  }, [cargar, fecha]);

  const recargar = useCallback(() => cargar(fechaVigente.current), [cargar]);

  const quitar = useCallback((id: number) => {
    setEstado((previo) =>
      previo.datos ? { ...previo, datos: { ...previo.datos, cobranzas: previo.datos.cobranzas.filter((c) => c.id !== id) } } : previo
    );
  }, []);

  const reemplazarDireccion = useCallback((cardCode: string, direccion: DireccionCobranza) => {
    setEstado((previo) =>
      previo.datos
        ? {
            ...previo,
            datos: {
              ...previo.datos,
              cobranzas: previo.datos.cobranzas.map((c) => (c.card_code === cardCode ? { ...c, direccion } : c)),
            },
          }
        : previo
    );
  }, []);

  // Primer render con un dia nuevo, antes de que corra el efecto.
  if (estado.fecha !== fecha) {
    return { datos: null, cargando: true, error: null, recargar, quitar, reemplazarDireccion };
  }
  return { datos: estado.datos, cargando: estado.cargando, error: estado.error, recargar, quitar, reemplazarDireccion };
}
