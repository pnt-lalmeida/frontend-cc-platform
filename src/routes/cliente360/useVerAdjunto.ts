import { useState } from "react";
import { abrirEnNuevaPestana } from "../../utils/abrirEnNuevaPestana";

interface EstadoVerAdjunto {
  verAdjunto: (docEntry: number) => Promise<void>;
  cargandoDocEntry: number | null;
  error: string | null;
}

export function useVerAdjunto(
  obtenerUrlAdjunto: (docEntry: number) => Promise<string>,
  abrir: (url: string) => void = abrirEnNuevaPestana
): EstadoVerAdjunto {
  const [cargandoDocEntry, setCargandoDocEntry] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verAdjunto(docEntry: number) {
    setCargandoDocEntry(docEntry);
    setError(null);
    try {
      const url = await obtenerUrlAdjunto(docEntry);
      abrir(url);
    } catch {
      setError("No se pudo abrir el adjunto.");
    } finally {
      setCargandoDocEntry(null);
    }
  }

  return { verAdjunto, cargandoDocEntry, error };
}
