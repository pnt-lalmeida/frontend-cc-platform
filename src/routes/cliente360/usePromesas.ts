import { useCallback, useEffect, useRef, useState } from "react";
import type { PromesaPago, PromesasResponse, RegistrarPromesaRequest } from "../../api/types";
import { mensajeDeErrorApi } from "./bitacora";

export interface ApiPromesas {
  obtener: (cardCode: string) => Promise<PromesasResponse>;
  registrar: (cardCode: string, body: RegistrarPromesaRequest) => Promise<PromesaPago>;
}

export interface EstadoPromesas {
  datos: PromesasResponse | null;
  cargando: boolean;
  // Error de la ultima carga. Puede haber `datos` de antes: quien lo muestra
  // decide si ofrece reintentar sobre lo viejo o en lugar de la lista.
  error: string | null;
  recargar: () => Promise<void>;
  enviando: boolean;
  errorRegistrar: string | null;
  registrar: (body: RegistrarPromesaRequest) => Promise<boolean>;
}

interface EstadoCarga {
  datos: PromesasResponse | null;
  cargando: boolean;
  error: string | null;
  // De que cliente es este estado: al cambiar de cliente nunca se muestran
  // las promesas del anterior (mismo criterio que useSituacionCuenta).
  cardCodeEstado: string | null;
}

interface EstadoRegistro {
  enviandoPara: string | null;
  error: string | null;
  cardCodeError: string | null;
}

const ERROR_CARGA = "No se pudieron cargar las promesas de pago.";
const ERROR_REGISTRAR = "No se pudo registrar la promesa. Intentá de nuevo.";

// Promesas de pago (Fase 4): carga y alta. Tras registrar se recarga la lista
// en vez de armarla a mano: el backend es quien decide el estado inicial.
export function usePromesas(api: ApiPromesas, cardCode: string | null): EstadoPromesas {
  const [carga, setCarga] = useState<EstadoCarga>({ datos: null, cargando: false, error: null, cardCodeEstado: null });
  const [registro, setRegistro] = useState<EstadoRegistro>({ enviandoPara: null, error: null, cardCodeError: null });
  const pedidoVigente = useRef(0);
  const apiRef = useRef(api);
  apiRef.current = api;
  // Cliente vigente: una respuesta que llega despues de cambiar de cuenta se
  // descarta, nunca pisa lo que se esta mostrando.
  const cardCodeActual = useRef(cardCode);
  cardCodeActual.current = cardCode;
  // Guarda sincronica contra el doble clic: el estado `enviando` recien se
  // ve en el proximo render, la referencia se ve al instante.
  const enviandoRef = useRef(false);

  const cargar = useCallback(async (codigo: string, conservar: boolean): Promise<void> => {
    const pedido = ++pedidoVigente.current;
    setCarga((previo) =>
      conservar && previo.cardCodeEstado === codigo
        ? { ...previo, cargando: true, error: null }
        : { datos: null, cargando: true, error: null, cardCodeEstado: codigo }
    );
    try {
      const datos = await apiRef.current.obtener(codigo);
      if (pedido === pedidoVigente.current) setCarga({ datos, cargando: false, error: null, cardCodeEstado: codigo });
    } catch {
      // Un error nunca deja la pantalla "cargando": se conserva lo que habia.
      if (pedido === pedidoVigente.current)
        setCarga((previo) => ({
          datos: previo.cardCodeEstado === codigo ? previo.datos : null,
          cargando: false,
          error: ERROR_CARGA,
          cardCodeEstado: codigo,
        }));
    }
  }, []);

  useEffect(() => {
    if (cardCode === null) return;
    void cargar(cardCode, false);
    return () => {
      pedidoVigente.current++;
    };
  }, [cardCode, cargar]);

  const recargar = useCallback(async (): Promise<void> => {
    const codigo = cardCodeActual.current;
    if (codigo === null) return;
    await cargar(codigo, true);
  }, [cargar]);

  const registrar = useCallback(
    async (body: RegistrarPromesaRequest): Promise<boolean> => {
      const codigo = cardCodeActual.current;
      if (codigo === null || enviandoRef.current) return false;
      enviandoRef.current = true;
      setRegistro({ enviandoPara: codigo, error: null, cardCodeError: null });
      try {
        await apiRef.current.registrar(codigo, body);
      } catch (err) {
        enviandoRef.current = false;
        // Si ya se cambio de cliente, se libera el "enviando" pero el error
        // no se le muestra al cliente actual.
        if (codigo !== cardCodeActual.current) {
          setRegistro((previo) => (previo.enviandoPara === codigo ? { ...previo, enviandoPara: null } : previo));
        } else {
          setRegistro({ enviandoPara: null, error: mensajeDeErrorApi(err, ERROR_REGISTRAR), cardCodeError: codigo });
        }
        return false;
      }
      enviandoRef.current = false;
      setRegistro((previo) => (previo.enviandoPara === codigo ? { enviandoPara: null, error: null, cardCodeError: null } : previo));
      // Ya esta registrada: si la recarga falla, `error` lo avisa, pero la
      // accion salio bien y el formulario se limpia.
      if (codigo === cardCodeActual.current) await cargar(codigo, true);
      return true;
    },
    [cargar]
  );

  const enviando = cardCode !== null && registro.enviandoPara === cardCode;
  const errorRegistrar = registro.cardCodeError === cardCode ? registro.error : null;

  if (cardCode === null)
    return { datos: null, cargando: false, error: null, recargar, enviando: false, errorRegistrar: null, registrar };
  // Primer render con un cliente nuevo, antes de que corra el efecto.
  if (carga.cardCodeEstado !== cardCode)
    return { datos: null, cargando: true, error: null, recargar, enviando, errorRegistrar, registrar };
  return { datos: carga.datos, cargando: carga.cargando, error: carga.error, recargar, enviando, errorRegistrar, registrar };
}
