import { useEffect, useRef, useState } from "react";
import type { ClienteBusqueda } from "../../api/types";

export function useClienteSearch(
  buscar: (query: string) => Promise<ClienteBusqueda[]>,
  delayMs = 300
) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ClienteBusqueda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ultimaConsultaRef = useRef<string | null>(null);

  useEffect(() => {
    if (!query) {
      ultimaConsultaRef.current = null;
      setResultados([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    const timeoutId = setTimeout(() => {
      ultimaConsultaRef.current = query;
      buscar(query)
        .then((datos) => {
          if (ultimaConsultaRef.current === query) {
            setResultados(datos);
          }
        })
        .catch(() => {
          if (ultimaConsultaRef.current === query) {
            setResultados([]);
            setError("No se pudo buscar clientes.");
          }
        })
        .finally(() => {
          if (ultimaConsultaRef.current === query) {
            setLoading(false);
          }
        });
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [query, buscar, delayMs]);

  return { query, setQuery, resultados, loading, error };
}
