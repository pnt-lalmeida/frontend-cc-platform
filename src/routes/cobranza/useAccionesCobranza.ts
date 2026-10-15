import { useCallback, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import type { DireccionCobranza } from "../../api/types";
import { mensajeDeErrorApi } from "../cliente360/bitacora";

export interface ApiAccionesCobranza {
  guardarDireccion: (cardCode: string, direccion: string) => Promise<DireccionCobranza>;
  anular: (id: number) => Promise<unknown>;
}

interface Efectos {
  alGuardarDireccion: (cardCode: string, direccion: DireccionCobranza) => void;
  alAnular: (id: number) => void;
  alRecargar: () => void;
}

const ERROR_DIRECCION = "No se pudo guardar la dirección. Intentá de nuevo.";
const ERROR_ANULAR = "No se pudo anular. Intentá de nuevo.";
const YA_ANULADA = "Ya fue anulada o reprogramada.";

// Cada accion tiene su propio estado "en vuelo" (por cliente o por cobranza):
// guardar una direccion no bloquea anular otra cobranza ni el resto de la
// pantalla, y un doble clic nunca dispara la misma accion dos veces.
export function useAccionesCobranza(api: ApiAccionesCobranza, efectos: Efectos) {
  const [guardando, setGuardando] = useState<ReadonlySet<string>>(new Set());
  const [anulando, setAnulando] = useState<ReadonlySet<number>>(new Set());
  const [errorDireccion, setErrorDireccion] = useState<Record<string, string>>({});
  const [errorAnular, setErrorAnular] = useState<Record<number, string>>({});
  // Guardas sincronicas: el estado recien se ve en el proximo render.
  const guardandoRef = useRef(new Set<string>());
  const anulandoRef = useRef(new Set<number>());
  const apiRef = useRef(api);
  apiRef.current = api;
  const efectosRef = useRef(efectos);
  efectosRef.current = efectos;

  const limpiarError = useCallback((cardCode: string) => {
    setErrorDireccion((e) => {
      const { [cardCode]: _quitado, ...resto } = e;
      return resto;
    });
  }, []);

  const guardarDireccion = useCallback(async (cardCode: string, texto: string): Promise<boolean> => {
    if (guardandoRef.current.has(cardCode)) return false;
    guardandoRef.current.add(cardCode);
    setGuardando(new Set(guardandoRef.current));
    limpiarError(cardCode);
    try {
      const direccion = await apiRef.current.guardarDireccion(cardCode, texto);
      efectosRef.current.alGuardarDireccion(cardCode, direccion);
      return true;
    } catch (err) {
      setErrorDireccion((e) => ({ ...e, [cardCode]: mensajeDeErrorApi(err, ERROR_DIRECCION) }));
      return false;
    } finally {
      guardandoRef.current.delete(cardCode);
      setGuardando(new Set(guardandoRef.current));
    }
  }, [limpiarError]);

  const anular = useCallback(async (id: number): Promise<boolean> => {
    if (anulandoRef.current.has(id)) return false;
    anulandoRef.current.add(id);
    setAnulando(new Set(anulandoRef.current));
    setErrorAnular((e) => {
      const { [id]: _quitado, ...resto } = e;
      return resto;
    });
    try {
      await apiRef.current.anular(id);
      efectosRef.current.alAnular(id);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        // Otra persona ya la anulo o la reprogramo: se recarga para mostrar lo real.
        setErrorAnular((e) => ({ ...e, [id]: YA_ANULADA }));
        efectosRef.current.alRecargar();
      } else {
        setErrorAnular((e) => ({ ...e, [id]: ERROR_ANULAR }));
      }
      return false;
    } finally {
      anulandoRef.current.delete(id);
      setAnulando(new Set(anulandoRef.current));
    }
  }, []);

  const limpiarErrorAnular = useCallback((id: number) => {
    setErrorAnular((e) => {
      const { [id]: _quitado, ...resto } = e;
      return resto;
    });
  }, []);

  return { guardando, anulando, errorDireccion, errorAnular, guardarDireccion, limpiarErrorDireccion: limpiarError, anular, limpiarErrorAnular };
}
