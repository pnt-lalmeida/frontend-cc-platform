import { useCallback, useState } from "react";
import { mensajeDeErrorApi } from "../../routes/cliente360/bitacora";

export interface ApiAlertas {
  actualizarAlerta: (id: number, estado: "vista" | "resuelta") => Promise<unknown>;
  marcarTodasVistas: () => Promise<unknown>;
}

interface AccionPorId {
  enCursoIds: number[];
  error: string | null;
  ejecutar: (id: number) => Promise<boolean>;
}

interface AccionesAlertas {
  marcarVista: AccionPorId;
  resolver: AccionPorId;
  marcarTodas: { enviando: boolean; error: string | null; ejecutar: () => Promise<boolean> };
}

const ERROR_VISTA = "No se pudo marcar la alerta como vista. Intentá de nuevo.";
const ERROR_RESOLVER = "No se pudo resolver la alerta. Intentá de nuevo.";
const ERROR_TODAS = "No se pudieron marcar las alertas como vistas. Intentá de nuevo.";

// Cada accion con su propio estado de envio y error. Siempre se recarga al
// terminar, tambien si falla: la lista es compartida y otra persona pudo
// haberla resuelto antes (400), asi no queda mostrando algo viejo.
export function useAccionesAlertas(api: ApiAlertas, recargar: () => unknown): AccionesAlertas {
  const [vistaIds, setVistaIds] = useState<number[]>([]);
  const [errorVista, setErrorVista] = useState<string | null>(null);
  const [resolverIds, setResolverIds] = useState<number[]>([]);
  const [errorResolver, setErrorResolver] = useState<string | null>(null);
  const [enviandoTodas, setEnviandoTodas] = useState(false);
  const [errorTodas, setErrorTodas] = useState<string | null>(null);

  const { actualizarAlerta, marcarTodasVistas } = api;

  const marcarVista = useCallback(
    async (id: number) => {
      setVistaIds((ids) => [...ids, id]);
      setErrorVista(null);
      let ok = true;
      try {
        await actualizarAlerta(id, "vista");
      } catch (err) {
        ok = false;
        setErrorVista(mensajeDeErrorApi(err, ERROR_VISTA));
      }
      await recargar();
      setVistaIds((ids) => ids.filter((x) => x !== id));
      return ok;
    },
    [actualizarAlerta, recargar]
  );

  const resolver = useCallback(
    async (id: number) => {
      setResolverIds((ids) => [...ids, id]);
      setErrorResolver(null);
      let ok = true;
      try {
        await actualizarAlerta(id, "resuelta");
      } catch (err) {
        ok = false;
        setErrorResolver(mensajeDeErrorApi(err, ERROR_RESOLVER));
      }
      // Sigue "en curso" hasta que llega la lista recargada, asi la alerta no
      // parpadea de vuelta a abierta.
      await recargar();
      setResolverIds((ids) => ids.filter((x) => x !== id));
      return ok;
    },
    [actualizarAlerta, recargar]
  );

  const marcarTodas = useCallback(async () => {
    setEnviandoTodas(true);
    setErrorTodas(null);
    let ok = true;
    try {
      await marcarTodasVistas();
    } catch (err) {
      ok = false;
      setErrorTodas(mensajeDeErrorApi(err, ERROR_TODAS));
    }
    await recargar();
    setEnviandoTodas(false);
    return ok;
  }, [marcarTodasVistas, recargar]);

  return {
    marcarVista: { enCursoIds: vistaIds, error: errorVista, ejecutar: marcarVista },
    resolver: { enCursoIds: resolverIds, error: errorResolver, ejecutar: resolver },
    marcarTodas: { enviando: enviandoTodas, error: errorTodas, ejecutar: marcarTodas },
  };
}
