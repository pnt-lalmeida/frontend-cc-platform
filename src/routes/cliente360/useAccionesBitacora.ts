import { useCallback, useState } from "react";
import type { CrearRecordatorioRequest, RegistrarGestionRequest } from "../../api/types";
import { mensajeDeErrorApi } from "./bitacora";

export interface ApiBitacora {
  registrarGestion: (cardCode: string, body: RegistrarGestionRequest) => Promise<unknown>;
  crearRecordatorio: (cardCode: string, body: CrearRecordatorioRequest) => Promise<unknown>;
  completarTarea: (id: number) => Promise<unknown>;
}

interface EstadoEnvio<B> {
  enviando: boolean;
  error: string | null;
  enviar: (body: B) => Promise<boolean>;
}

interface EstadoCompletar {
  completandoIds: number[];
  error: string | null;
  completar: (id: number) => Promise<boolean>;
}

interface AccionesBitacora {
  gestion: EstadoEnvio<RegistrarGestionRequest>;
  recordatorio: EstadoEnvio<CrearRecordatorioRequest>;
  completar: EstadoCompletar;
}

const ERROR_GESTION = "No se pudo registrar la gestión. Intentá de nuevo.";
const ERROR_RECORDATORIO = "No se pudo crear el recordatorio. Intentá de nuevo.";
const ERROR_COMPLETAR = "No se pudo completar el recordatorio. Intentá de nuevo.";

// Cada accion tiene su propio estado de envio y error: registrar una gestion
// no bloquea completar un recordatorio ni el resto de la pestaña. Tras cada
// exito se recarga la bitacora (el backend genera eventos automaticos).
export function useAccionesBitacora(
  api: ApiBitacora,
  cardCode: string,
  recargar: () => unknown
): AccionesBitacora {
  const [enviandoGestion, setEnviandoGestion] = useState(false);
  const [errorGestion, setErrorGestion] = useState<string | null>(null);
  const [enviandoRecordatorio, setEnviandoRecordatorio] = useState(false);
  const [errorRecordatorio, setErrorRecordatorio] = useState<string | null>(null);
  const [completandoIds, setCompletandoIds] = useState<number[]>([]);
  const [errorCompletar, setErrorCompletar] = useState<string | null>(null);
  const [cardCodeErrores, setCardCodeErrores] = useState(cardCode);

  // Errores (y tareas en curso) de otro cliente no se arrastran: ajuste de
  // estado durante el render, sin efecto.
  if (cardCodeErrores !== cardCode) {
    setCardCodeErrores(cardCode);
    setErrorGestion(null);
    setErrorRecordatorio(null);
    setErrorCompletar(null);
    setCompletandoIds([]);
  }

  const { registrarGestion, crearRecordatorio, completarTarea } = api;

  const enviarGestion = useCallback(
    async (body: RegistrarGestionRequest) => {
      setEnviandoGestion(true);
      setErrorGestion(null);
      try {
        await registrarGestion(cardCode, body);
      } catch (err) {
        setEnviandoGestion(false);
        setErrorGestion(mensajeDeErrorApi(err, ERROR_GESTION));
        return false;
      }
      setEnviandoGestion(false);
      await recargar();
      return true;
    },
    [registrarGestion, cardCode, recargar]
  );

  const enviarRecordatorio = useCallback(
    async (body: CrearRecordatorioRequest) => {
      setEnviandoRecordatorio(true);
      setErrorRecordatorio(null);
      try {
        await crearRecordatorio(cardCode, body);
      } catch (err) {
        setEnviandoRecordatorio(false);
        setErrorRecordatorio(mensajeDeErrorApi(err, ERROR_RECORDATORIO));
        return false;
      }
      setEnviandoRecordatorio(false);
      await recargar();
      return true;
    },
    [crearRecordatorio, cardCode, recargar]
  );

  const completar = useCallback(
    async (id: number) => {
      setCompletandoIds((ids) => [...ids, id]);
      setErrorCompletar(null);
      try {
        await completarTarea(id);
      } catch (err) {
        setCompletandoIds((ids) => ids.filter((x) => x !== id));
        setErrorCompletar(mensajeDeErrorApi(err, ERROR_COMPLETAR));
        // Puede que otra persona ya la haya completado (400): se recarga para
        // no dejar la tarea como pendiente en pantalla.
        void recargar();
        return false;
      }
      // Se mantiene "en curso" hasta que llega la bitacora recargada, asi la
      // tarea no parpadea de vuelta a pendiente.
      await recargar();
      setCompletandoIds((ids) => ids.filter((x) => x !== id));
      return true;
    },
    [completarTarea, recargar]
  );

  return {
    gestion: { enviando: enviandoGestion, error: errorGestion, enviar: enviarGestion },
    recordatorio: { enviando: enviandoRecordatorio, error: errorRecordatorio, enviar: enviarRecordatorio },
    completar: { completandoIds, error: errorCompletar, completar },
  };
}
