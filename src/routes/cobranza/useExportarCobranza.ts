import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { mensajeDeErrorApi } from "../cliente360/bitacora";

export interface ApiExportarCobranza {
  descargarPlanilla: (fecha: string) => Promise<{ blob: Blob; nombre: string | null }>;
  registrarImpresion: (fecha: string) => Promise<unknown>;
}

export interface EntornoExportar {
  guardarArchivo: (blob: Blob, nombre: string) => void;
  imprimir: () => void;
}

// Baja el Blob con un enlace temporal y libera la URL al terminar. Nada queda
// guardado en el navegador (son datos personales).
export function guardarArchivo(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.style.display = "none";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Diferido: revocar en el mismo tick puede cancelar la descarga en Safari/Firefox viejos.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const ENTORNO: EntornoExportar = { guardarArchivo, imprimir: () => window.print() };

const ERROR_SAP = "SAP no respondió y la planilla no pudo armarse con las direcciones. Intentá de nuevo en unos minutos.";
const ERROR_DESCARGA = "No se pudo descargar la planilla. Intentá de nuevo.";
const ERROR_IMPRESION = "No se pudo imprimir: no se registró la impresión. Intentá de nuevo.";

// Descargar la planilla e imprimir, para el dia vigente. Cada accion tiene su
// propio "en vuelo" (un doble clic no la repite). Imprimir registra primero:
// si el registro falla, no se imprime. Si el usuario cambia de dia mientras
// tanto, el resultado no se aplica (ni error ni window.print del dia equivocado).
export function useExportarCobranza(api: ApiExportarCobranza | undefined, fecha: string, entorno: EntornoExportar = ENTORNO) {
  const [descargando, setDescargando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fechaRef = useRef(fecha);
  const descargandoRef = useRef(false);
  const imprimiendoRef = useRef(false);
  const apiRef = useRef(api);
  apiRef.current = api;
  const entornoRef = useRef(entorno);
  entornoRef.current = entorno;

  useEffect(() => {
    fechaRef.current = fecha;
    setError(null);
  }, [fecha]);

  const descargar = useCallback(async () => {
    if (descargandoRef.current || !apiRef.current) return;
    const pedida = fechaRef.current;
    descargandoRef.current = true;
    setDescargando(true);
    setError(null);
    try {
      const { blob, nombre } = await apiRef.current.descargarPlanilla(pedida);
      entornoRef.current.guardarArchivo(blob, nombre ?? `cobranza-${pedida}.csv`);
    } catch (err) {
      if (fechaRef.current === pedida) {
        setError(mensajeDescarga(err));
      }
    } finally {
      descargandoRef.current = false;
      setDescargando(false);
    }
  }, []);

  const imprimir = useCallback(async () => {
    if (imprimiendoRef.current || !apiRef.current) return;
    const pedida = fechaRef.current;
    imprimiendoRef.current = true;
    setImprimiendo(true);
    setError(null);
    try {
      await apiRef.current.registrarImpresion(pedida);
      if (fechaRef.current === pedida) entornoRef.current.imprimir();
    } catch (err) {
      if (fechaRef.current === pedida) setError(mensajePropio(err, ERROR_IMPRESION));
    } finally {
      imprimiendoRef.current = false;
      setImprimiendo(false);
    }
  }, []);

  return { descargando, imprimiendo, error, descargar, imprimir };
}

// Un 5xx trae el texto interno del backend ("Error interno"): no le sirve a
// quien usa la pantalla. Se usa el mensaje propio; el de 4xx (que si habla
// del pedido) se conserva.
function mensajePropio(err: unknown, porDefecto: string): string {
  if (err instanceof ApiError && err.status >= 500) return porDefecto;
  return mensajeDeErrorApi(err, porDefecto);
}

function mensajeDescarga(err: unknown): string {
  if (err instanceof ApiError && err.status === 503) return ERROR_SAP;
  return mensajePropio(err, ERROR_DESCARGA);
}
