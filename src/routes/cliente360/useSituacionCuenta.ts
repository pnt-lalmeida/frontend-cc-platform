import { useCallback, useEffect, useRef, useState } from "react";
import type { SituacionCuentaResponse } from "../../api/types";
import { mensajeDeErrorApi } from "./bitacora";

export interface ApiSituacion {
  obtener: (cardCode: string) => Promise<SituacionCuentaResponse>;
  guardar: (cardCode: string, situacion: string | null) => Promise<SituacionCuentaResponse>;
}

interface EstadoSituacion {
  datos: SituacionCuentaResponse | null;
  cargando: boolean;
  error: string | null;
  enviando: boolean;
  errorGuardar: string | null;
  guardar: (situacion: string | null) => Promise<boolean>;
}

interface EstadoCarga {
  datos: SituacionCuentaResponse | null;
  cargando: boolean;
  error: string | null;
  // De que cliente es este estado: al cambiar de cliente nunca se muestra la
  // situacion del anterior (mismo criterio que useBitacora).
  cardCodeEstado: string | null;
}

interface EstadoGuardado {
  enviandoPara: string | null;
  error: string | null;
  cardCodeError: string | null;
}

const ERROR_CARGA = "No se pudo cargar la situación de la cuenta.";
const ERROR_GUARDAR = "No se pudo guardar la situación. Intentá de nuevo.";

// Situacion de la cuenta (Fase A): carga y guardado. El guardado adopta la
// respuesta del PUT (mismo formato que el GET), sin recargar.
export function useSituacionCuenta(api: ApiSituacion, cardCode: string | null): EstadoSituacion {
  const [carga, setCarga] = useState<EstadoCarga>({ datos: null, cargando: false, error: null, cardCodeEstado: null });
  const [guardado, setGuardado] = useState<EstadoGuardado>({ enviandoPara: null, error: null, cardCodeError: null });
  const pedidoVigente = useRef(0);
  const apiRef = useRef(api);
  apiRef.current = api;
  // Cliente vigente: un PUT que termina despues de cambiar de cuenta no pisa
  // la situacion del cliente actual.
  const cardCodeActual = useRef(cardCode);
  cardCodeActual.current = cardCode;

  useEffect(() => {
    if (cardCode === null) return;
    const pedido = ++pedidoVigente.current;
    setCarga({ datos: null, cargando: true, error: null, cardCodeEstado: cardCode });
    apiRef.current.obtener(cardCode).then(
      (datos) => {
        if (pedido === pedidoVigente.current) setCarga({ datos, cargando: false, error: null, cardCodeEstado: cardCode });
      },
      () => {
        if (pedido === pedidoVigente.current)
          setCarga({ datos: null, cargando: false, error: ERROR_CARGA, cardCodeEstado: cardCode });
      }
    );
    return () => {
      pedidoVigente.current++;
    };
  }, [cardCode]);

  const guardar = useCallback(
    async (situacion: string | null): Promise<boolean> => {
      const codigo = cardCodeActual.current;
      if (codigo === null) return false;
      setGuardado({ enviandoPara: codigo, error: null, cardCodeError: null });
      // Si el usuario cambio de cliente mientras tanto, igual se libera el
      // "enviando" de este codigo (si no, al volver quedaria todo trabado),
      // pero sin tocar datos ni errores del cliente actual.
      const liberarSiSeFue = (): boolean => {
        if (codigo === cardCodeActual.current) return false;
        setGuardado((previo) => (previo.enviandoPara === codigo ? { ...previo, enviandoPara: null } : previo));
        return true;
      };
      try {
        const datos = await apiRef.current.guardar(codigo, situacion);
        if (liberarSiSeFue()) return false;
        setCarga({ datos, cargando: false, error: null, cardCodeEstado: codigo });
        setGuardado({ enviandoPara: null, error: null, cardCodeError: null });
        return true;
      } catch (err) {
        if (liberarSiSeFue()) return false;
        setGuardado({ enviandoPara: null, error: mensajeDeErrorApi(err, ERROR_GUARDAR), cardCodeError: codigo });
        return false;
      }
    },
    []
  );

  const enviando = cardCode !== null && guardado.enviandoPara === cardCode;
  const errorGuardar = guardado.cardCodeError === cardCode ? guardado.error : null;

  if (cardCode === null) return { datos: null, cargando: false, error: null, enviando: false, errorGuardar: null, guardar };
  // Primer render con un cliente nuevo, antes de que corra el efecto.
  if (carga.cardCodeEstado !== cardCode)
    return { datos: null, cargando: true, error: null, enviando, errorGuardar, guardar };
  return { datos: carga.datos, cargando: carga.cargando, error: carga.error, enviando, errorGuardar, guardar };
}
