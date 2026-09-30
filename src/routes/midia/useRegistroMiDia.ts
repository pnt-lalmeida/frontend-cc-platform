import { useCallback, useRef, useState } from "react";
import type { RegistrarGestionRequest } from "../../api/types";
import { mensajeDeErrorApi } from "../cliente360/bitacora";
import { RESULTADO_SIN_CONTACTO } from "./miDia";

export interface ApiRegistroMiDia {
  registrar: (cardCode: string, body: RegistrarGestionRequest) => Promise<unknown>;
  // La lista de resultados viaja en la respuesta de la Bitacora (clave
  // "motivos"): es global, no depende del cliente, asi que se pide una vez.
  obtenerResultados: (cardCode: string) => Promise<string[]>;
}

interface EstadoResultados {
  lista: string[] | null;
  cargando: boolean;
  error: string | null;
  cargar: (cardCode: string) => Promise<void>;
}

interface RegistroMiDia {
  enviandoIds: string[];
  errores: Record<string, string>;
  // Gestionados en esta sesion: la fila se apaga en su lugar, no se borra.
  recienHechos: ReadonlySet<string>;
  // "No contactado": queda anotado pero el cliente sigue pendiente.
  anotados: ReadonlySet<string>;
  registrar: (cardCode: string, body: RegistrarGestionRequest) => Promise<boolean>;
  limpiarError: (cardCode: string) => void;
  reiniciar: () => void;
  resultados: EstadoResultados;
}

const ERROR_REGISTRAR = "No se pudo registrar la gestión. Intentá de nuevo.";
const ERROR_RESULTADOS = "No se pudo cargar la lista de resultados.";

function conElemento(set: ReadonlySet<string>, valor: string): Set<string> {
  return new Set(set).add(valor);
}

// Registro de gestion sin salir de Mi dia (DECISION REVERSIBLE de Liber,
// 30/09/2026). Mismo endpoint que la Bitacora. Cada cliente tiene su propio
// estado de envio y error: registrar uno no bloquea a los demas, y un segundo
// clic sobre el mismo mientras esta en vuelo no dispara otra llamada.
export function useRegistroMiDia(api: ApiRegistroMiDia): RegistroMiDia {
  const [enviandoIds, setEnviandoIds] = useState<string[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [recienHechos, setRecienHechos] = useState<ReadonlySet<string>>(new Set());
  const [anotados, setAnotados] = useState<ReadonlySet<string>>(new Set());
  const enVuelo = useRef(new Set<string>());
  const apiRef = useRef(api);
  apiRef.current = api;

  const registrar = useCallback(async (cardCode: string, body: RegistrarGestionRequest): Promise<boolean> => {
    if (enVuelo.current.has(cardCode)) return false;
    enVuelo.current.add(cardCode);
    setEnviandoIds((ids) => [...ids, cardCode]);
    setErrores(({ [cardCode]: _previo, ...resto }) => resto);
    try {
      await apiRef.current.registrar(cardCode, body);
    } catch (err) {
      enVuelo.current.delete(cardCode);
      setEnviandoIds((ids) => ids.filter((x) => x !== cardCode));
      setErrores((previos) => ({ ...previos, [cardCode]: mensajeDeErrorApi(err, ERROR_REGISTRAR) }));
      return false;
    }
    enVuelo.current.delete(cardCode);
    setEnviandoIds((ids) => ids.filter((x) => x !== cardCode));
    if (body.resultado === RESULTADO_SIN_CONTACTO) setAnotados((s) => conElemento(s, cardCode));
    else setRecienHechos((s) => conElemento(s, cardCode));
    return true;
  }, []);

  const limpiarError = useCallback((cardCode: string) => {
    setErrores(({ [cardCode]: _previo, ...resto }) => resto);
  }, []);

  const reiniciar = useCallback(() => {
    setRecienHechos(new Set());
    setAnotados(new Set());
    setErrores({});
  }, []);

  const [lista, setLista] = useState<string[] | null>(null);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const listaRef = useRef<string[] | null>(null);
  const pedidoEnVuelo = useRef<Promise<void> | null>(null);

  const cargar = useCallback((cardCode: string): Promise<void> => {
    if (listaRef.current) return Promise.resolve();
    if (pedidoEnVuelo.current) return pedidoEnVuelo.current;
    setCargandoLista(true);
    setErrorLista(null);
    const pedido = apiRef.current
      .obtenerResultados(cardCode)
      .then((resultados) => {
        listaRef.current = resultados;
        setLista(resultados);
      })
      .catch(() => setErrorLista(ERROR_RESULTADOS))
      .finally(() => {
        pedidoEnVuelo.current = null;
        setCargandoLista(false);
      });
    pedidoEnVuelo.current = pedido;
    return pedido;
  }, []);

  return {
    enviandoIds,
    errores,
    recienHechos,
    anotados,
    registrar,
    limpiarError,
    reiniciar,
    resultados: { lista, cargando: cargandoLista, error: errorLista, cargar },
  };
}
