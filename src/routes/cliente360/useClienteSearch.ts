import { useEffect, useState } from "react";
import type { ClienteBusqueda } from "../../api/types";

export function useClienteSearch(
  buscar: (query: string) => Promise<ClienteBusqueda[]>,
  delayMs = 300
) {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ClienteBusqueda[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query) {
      setResultados([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(() => {
      buscar(query)
        .then(setResultados)
        .finally(() => setLoading(false));
    }, delayMs);

    return () => clearTimeout(timeoutId);
  }, [query, buscar, delayMs]);

  return { query, setQuery, resultados, loading };
}
