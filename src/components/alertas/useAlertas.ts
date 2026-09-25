import { useCallback, useEffect, useRef, useState } from "react";
import type { AlertasResponse } from "../../api/types";

export const INTERVALO_ALERTAS_MS = 5 * 60_000;

interface EstadoAlertas {
  datos: AlertasResponse | null;
  cargando: boolean;
  error: string | null;
  // Recarga explicita (tras una accion): si hay un pedido en vuelo, se
  // encadena uno nuevo al terminar, asi lo que se ve incluye la accion.
  recargar: () => Promise<void>;
}

const ERROR_CARGA = "No se pudieron cargar las alertas.";
const ERROR_RECARGA = "No se pudieron actualizar las alertas. Lo que ves puede no estar al día.";

function pestanaVisible(): boolean {
  return typeof document === "undefined" || document.visibilityState === "visible";
}

// Carga la lista compartida de alertas: al montar, cada 5 minutos solo con la
// pestaña visible, y al volver el foco. Nunca hay dos pedidos superpuestos, y
// un error de actualizacion no borra lo que ya se ve.
export function useAlertas(
  obtenerAlertas: () => Promise<AlertasResponse>,
  intervaloMs: number = INTERVALO_ALERTAS_MS
): EstadoAlertas {
  const [datos, setDatos] = useState<AlertasResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // La funcion de fetch va en un ref: si no viene memoizada, igual no se
  // dispara un pedido por render.
  const obtenerRef = useRef(obtenerAlertas);
  obtenerRef.current = obtenerAlertas;
  const enVuelo = useRef<Promise<void> | null>(null);
  const hayDatos = useRef(false);
  const montado = useRef(true);

  const pedir = useCallback((): Promise<void> => {
    const promesa = (async () => {
      setCargando(true);
      try {
        const respuesta = await obtenerRef.current();
        if (!montado.current) return;
        hayDatos.current = true;
        setDatos(respuesta);
        setError(null);
      } catch {
        if (!montado.current) return;
        setError(hayDatos.current ? ERROR_RECARGA : ERROR_CARGA);
      } finally {
        if (montado.current) setCargando(false);
        enVuelo.current = null;
      }
    })();
    enVuelo.current = promesa;
    return promesa;
  }, []);

  // Polling, foco y visibilidad: si ya hay un pedido en vuelo, no hacen nada.
  const actualizarSiLibre = useCallback(() => {
    if (enVuelo.current) return;
    void pedir();
  }, [pedir]);

  const recargar = useCallback(async () => {
    const actual = enVuelo.current;
    if (actual) {
      // Ese pedido pudo salir antes de la accion: se espera y se pide de nuevo
      // (salvo que otro llamado ya haya encadenado uno).
      await actual;
      if (enVuelo.current) return enVuelo.current;
    }
    await pedir();
  }, [pedir]);

  useEffect(() => {
    montado.current = true;
    void pedir();

    const intervalo = setInterval(() => {
      if (pestanaVisible()) actualizarSiLibre();
    }, intervaloMs);
    const alCambiarVisibilidad = () => {
      if (pestanaVisible()) actualizarSiLibre();
    };
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("focus", actualizarSiLibre);

    return () => {
      montado.current = false;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("focus", actualizarSiLibre);
    };
  }, [pedir, actualizarSiLibre, intervaloMs]);

  return { datos, cargando, error, recargar };
}
