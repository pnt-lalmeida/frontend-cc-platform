import { useCallback, useEffect, useRef, useState } from "react";
import type { MiDiaResponse } from "../../api/types";

interface EstadoMiDia {
  datos: MiDiaResponse | null;
  cargando: boolean;
  error: string | null;
  // true si la recarga trajo datos nuevos: quien la pide decide recien ahi
  // que descartar de lo que tenia en pantalla.
  recargar: () => Promise<boolean>;
}

const ERROR_CARGA = "No se pudo cargar Mi día.";
const ERROR_RECARGA = "No se pudo actualizar. Lo que ves puede estar desactualizado.";

// GET /api/mi-dia. `obtener` va en un ref: si quien lo pasa no lo memoiza, no
// se dispara un pedido por render. Solo vale la respuesta del ULTIMO pedido:
// una anterior que llega tarde nunca pisa lo que se esta mostrando. Un error
// nunca deja la pantalla cargando, y una recarga fallida conserva lo que ya
// se veia (no se blanquea una lista de trabajo por un corte de red).
export function useMiDia(obtener: () => Promise<MiDiaResponse>): EstadoMiDia {
  const [datos, setDatos] = useState<MiDiaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const obtenerRef = useRef(obtener);
  obtenerRef.current = obtener;
  const generacion = useRef(0);
  const datosRef = useRef<MiDiaResponse | null>(null);

  const recargar = useCallback(async (): Promise<boolean> => {
    const gen = ++generacion.current;
    setCargando(true);
    setError(null);
    try {
      const nuevos = await obtenerRef.current();
      if (gen !== generacion.current) return false;
      datosRef.current = nuevos;
      setDatos(nuevos);
      setCargando(false);
      return true;
    } catch {
      if (gen !== generacion.current) return false;
      setError(datosRef.current ? ERROR_RECARGA : ERROR_CARGA);
      setCargando(false);
      return false;
    }
  }, []);

  useEffect(() => {
    void recargar();
    // Al desmontar, cualquier respuesta en vuelo queda invalidada.
    return () => {
      generacion.current += 1;
    };
  }, [recargar]);

  return { datos, cargando, error, recargar };
}
