import { useState } from "react";

interface VentanaAbrible {
  location: { href: string };
  close: () => void;
}

interface EstadoVerAdjunto {
  verAdjunto: (docEntry: number) => Promise<void>;
  cargandoDocEntry: number | null;
  error: string | null;
}

export function useVerAdjunto(
  obtenerUrlAdjunto: (docEntry: number) => Promise<string>,
  abrirVentana: () => VentanaAbrible | null = () =>
    window.open("", "_blank", "noopener,noreferrer") as VentanaAbrible | null
): EstadoVerAdjunto {
  const [cargandoDocEntry, setCargandoDocEntry] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verAdjunto(docEntry: number) {
    // La ventana se abre ANTES del await a proposito: si se abre despues de
    // un fetch, el navegador ya no lo considera resultado directo del click
    // del usuario y bloquea el popup - confirmado real (23/09/2026): el link
    // abria una pestaña que nunca navegaba a nada, aunque la URL SAS
    // funcionaba perfecto pegada a mano en otra pestaña.
    const ventana = abrirVentana();
    setCargandoDocEntry(docEntry);
    setError(null);
    try {
      const url = await obtenerUrlAdjunto(docEntry);
      if (ventana) {
        ventana.location.href = url;
      } else {
        setError("El navegador bloqueó la ventana nueva. Habilitá los popups para este sitio e intentá de nuevo.");
      }
    } catch {
      ventana?.close();
      setError("No se pudo abrir el adjunto.");
    } finally {
      setCargandoDocEntry(null);
    }
  }

  return { verAdjunto, cargandoDocEntry, error };
}
