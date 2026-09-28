import { useCallback, useEffect, useRef, useState } from "react";
import type { BitacoraResponse, EventoBitacora, FiltroBitacora, PaginaEventosBitacora } from "../../api/types";
import { claveEvento } from "./bitacora";

// Bitacora v2 (28/09/2026): la primera pagina viene con el GET principal
// (tareas, resumen, etc.); cambiar de filtro y "Ver anteriores" van contra
// GET .../bitacora/eventos, sin volver a traer el resto.
export interface FuentesBitacora {
  obtenerBitacora: (cardCode: string, tipo: FiltroBitacora) => Promise<BitacoraResponse>;
  obtenerEventos: (
    cardCode: string,
    opciones: { tipo: FiltroBitacora; antesDe?: string }
  ) => Promise<PaginaEventosBitacora>;
}

interface EstadoBitacora {
  // Tareas, resumen, motivos, equipo... del GET principal. Los eventos a
  // mostrar son `eventos`, no `datos.eventos` (esa es solo la primera pagina).
  datos: BitacoraResponse | null;
  loading: boolean;
  error: string | null;
  eventos: EventoBitacora[];
  hayMas: boolean;
  // Primera pagina de un filtro recien elegido.
  cargandoEventos: boolean;
  errorEventos: string | null;
  anteriores: { cargando: boolean; error: string | null; cargar: () => Promise<void> };
  recargar: () => Promise<void>;
}

interface EstadoInterno {
  // De que cliente es este estado: al cambiar de cliente nunca se muestra la
  // bitacora del anterior (mismo criterio que useIndicadoresPago).
  cardCodeEstado: string | null;
  datos: BitacoraResponse | null;
  loading: boolean;
  error: string | null;
  eventos: EventoBitacora[];
  hayMas: boolean;
  siguiente: string | null;
  // De que filtro son `eventos`: mientras llega otro, no se muestran.
  filtroEventos: FiltroBitacora | null;
  errorEventos: string | null;
  cargandoAnteriores: boolean;
  errorAnteriores: string | null;
}

const VACIO: EstadoInterno = {
  cardCodeEstado: null,
  datos: null,
  loading: false,
  error: null,
  eventos: [],
  hayMas: false,
  siguiente: null,
  filtroEventos: null,
  errorEventos: null,
  cargandoAnteriores: false,
  errorAnteriores: null,
};

const ERROR_CARGA = "No se pudo cargar la bitácora del cliente.";
const ERROR_RECARGA = "No se pudo actualizar la bitácora. Recargá la página para ver lo último.";
const ERROR_FILTRO = "No se pudo cargar el historial con este filtro.";
const ERROR_ANTERIORES = "No se pudieron cargar los anteriores. Intentá de nuevo.";

function sumarSinRepetir(cargados: EventoBitacora[], nuevos: EventoBitacora[]): EventoBitacora[] {
  const vistos = new Set(cargados.map(claveEvento));
  return [...cargados, ...nuevos.filter((e) => !vistos.has(claveEvento(e)))];
}

export function useBitacora(
  fuentes: FuentesBitacora,
  cardCode: string | null,
  filtro: FiltroBitacora = "todo"
): EstadoBitacora {
  const [estado, setEstado] = useState<EstadoInterno>(VACIO);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  // Generacion vigente: cada primera pagina (cliente nuevo, filtro nuevo,
  // recarga) la incrementa. Cualquier respuesta de una generacion anterior
  // -incluida una pagina de "Ver anteriores"- se descarta.
  const generacion = useRef(0);
  // Generacion de un "Ver anteriores" en vuelo (evita pedir dos veces).
  const anterioresEnVuelo = useRef<number | null>(null);
  // Hay una carga completa sin terminar: un cambio de filtro en ese momento
  // pide todo de nuevo, asi no se pierden las tareas/resumen actualizados.
  const completaPendiente = useRef(false);
  // Cliente del que hay datos base (tareas, resumen) cargados.
  const clienteConBase = useRef<string | null>(null);
  // Las funciones de fetch van en un ref: si quien las pasa no las memoiza,
  // igual no se dispara un pedido por render (evita un loop de recargas).
  const fuentesRef = useRef(fuentes);
  fuentesRef.current = fuentes;
  // Cliente y filtro vigentes: una recarga disparada por una accion de un
  // cliente anterior (ej. termina un POST despues de cambiar de cuenta) no
  // hace nada, asi no pisa la carga del cliente actual.
  const cardCodeActual = useRef(cardCode);
  cardCodeActual.current = cardCode;
  const filtroActual = useRef(filtro);
  filtroActual.current = filtro;

  const cargarCompleta = useCallback(async (codigo: string): Promise<void> => {
    if (codigo !== cardCodeActual.current) return;
    const gen = ++generacion.current;
    const tipo = filtroActual.current;
    completaPendiente.current = true;
    setEstado((previo) =>
      previo.cardCodeEstado === codigo
        ? { ...previo, loading: true, error: null, cargandoAnteriores: false, errorAnteriores: null }
        : { ...VACIO, loading: true, cardCodeEstado: codigo }
    );
    try {
      const datos = await fuentesRef.current.obtenerBitacora(codigo, tipo);
      if (gen !== generacion.current) return;
      completaPendiente.current = false;
      clienteConBase.current = codigo;
      setEstado({
        ...VACIO,
        cardCodeEstado: codigo,
        datos,
        eventos: datos.eventos,
        hayMas: datos.hay_mas,
        siguiente: datos.siguiente,
        filtroEventos: tipo,
      });
    } catch {
      if (gen !== generacion.current) return;
      completaPendiente.current = false;
      setEstado((previo) => ({
        ...previo,
        loading: false,
        error: previo.datos ? ERROR_RECARGA : ERROR_CARGA,
        cardCodeEstado: codigo,
        // La carga era de otro filtro (se cambio con una recarga en vuelo):
        // los eventos en estado son del filtro anterior. Sin esto quedaria
        // "Cargando historial…" para siempre; asi aparece Reintentar.
        ...(previo.filtroEventos !== tipo
          ? { filtroEventos: tipo, eventos: [], hayMas: false, siguiente: null, errorEventos: ERROR_FILTRO }
          : {}),
      }));
    }
  }, []);

  const cargarFiltro = useCallback(async (codigo: string, tipo: FiltroBitacora): Promise<void> => {
    const gen = ++generacion.current;
    setEstado((previo) => ({ ...previo, errorEventos: null, cargandoAnteriores: false, errorAnteriores: null }));
    try {
      const p = await fuentesRef.current.obtenerEventos(codigo, { tipo });
      if (gen !== generacion.current) return;
      setEstado((previo) => ({
        ...previo,
        eventos: p.eventos,
        hayMas: p.hay_mas,
        siguiente: p.siguiente,
        filtroEventos: tipo,
        errorEventos: null,
      }));
    } catch {
      if (gen !== generacion.current) return;
      setEstado((previo) => ({
        ...previo,
        eventos: [],
        hayMas: false,
        siguiente: null,
        filtroEventos: tipo,
        errorEventos: ERROR_FILTRO,
      }));
    }
  }, []);

  useEffect(() => {
    if (cardCode === null) return;
    // Solo eventos si lo que esta en pantalla ya es de este cliente con su
    // base cargada; si no (cliente nuevo, o se vuelve a uno ya visto), todo.
    const soloEventos =
      clienteConBase.current === cardCode &&
      estadoRef.current.cardCodeEstado === cardCode &&
      !completaPendiente.current;
    if (soloEventos) void cargarFiltro(cardCode, filtro);
    else void cargarCompleta(cardCode);
    return () => {
      // Invalida lo que este en vuelo al desmontar o cambiar de cliente/filtro.
      generacion.current++;
    };
  }, [cargarCompleta, cargarFiltro, cardCode, filtro]);

  const recargar = useCallback(async () => {
    if (cardCode !== null) await cargarCompleta(cardCode);
  }, [cargarCompleta, cardCode]);

  const cargarAnteriores = useCallback(async (): Promise<void> => {
    const actual = estadoRef.current;
    const codigo = cardCodeActual.current;
    const gen = generacion.current;
    if (
      codigo === null ||
      actual.cardCodeEstado !== codigo ||
      actual.filtroEventos !== filtroActual.current ||
      !actual.hayMas ||
      !actual.siguiente ||
      anterioresEnVuelo.current === gen
    ) {
      return;
    }
    anterioresEnVuelo.current = gen;
    const tipo = actual.filtroEventos;
    setEstado((previo) => ({ ...previo, cargandoAnteriores: true, errorAnteriores: null }));
    try {
      const p = await fuentesRef.current.obtenerEventos(codigo, { tipo, antesDe: actual.siguiente });
      if (gen !== generacion.current) return;
      setEstado((previo) => ({
        ...previo,
        eventos: sumarSinRepetir(previo.eventos, p.eventos),
        hayMas: p.hay_mas,
        siguiente: p.siguiente,
        cargandoAnteriores: false,
      }));
    } catch {
      if (gen !== generacion.current) return;
      // Lo ya cargado queda: solo se avisa en el pie del historial.
      setEstado((previo) => ({ ...previo, cargandoAnteriores: false, errorAnteriores: ERROR_ANTERIORES }));
    } finally {
      if (anterioresEnVuelo.current === gen) anterioresEnVuelo.current = null;
    }
  }, []);

  const base = { recargar, anteriores: { cargando: false, error: null, cargar: cargarAnteriores } };
  if (cardCode === null) {
    return { ...base, datos: null, loading: false, error: null, eventos: [], hayMas: false, cargandoEventos: false, errorEventos: null };
  }
  // Primer render con un cliente nuevo, antes de que corra el efecto.
  if (estado.cardCodeEstado !== cardCode) {
    return { ...base, datos: null, loading: true, error: null, eventos: [], hayMas: false, cargandoEventos: false, errorEventos: null };
  }
  const eventosDelFiltro = estado.filtroEventos === filtro;
  return {
    recargar,
    datos: estado.datos,
    loading: estado.loading,
    error: estado.error,
    eventos: eventosDelFiltro ? estado.eventos : [],
    hayMas: eventosDelFiltro && estado.hayMas,
    cargandoEventos: estado.datos !== null && !eventosDelFiltro,
    errorEventos: eventosDelFiltro ? estado.errorEventos : null,
    anteriores: {
      cargando: eventosDelFiltro && estado.cargandoAnteriores,
      error: eventosDelFiltro ? estado.errorAnteriores : null,
      cargar: cargarAnteriores,
    },
  };
}
