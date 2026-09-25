import { useEffect, useState } from "react";

function coincide(query: string): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

// Si la media query coincide, reaccionando a los cambios (rotar el celular,
// achicar la ventana). Sin matchMedia devuelve false.
export function useMediaQuery(query: string): boolean {
  const [coincideAhora, setCoincideAhora] = useState(() => coincide(query));

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    setCoincideAhora(mql.matches);
    const alCambiar = (e: { matches: boolean }) => setCoincideAhora(e.matches);
    mql.addEventListener("change", alCambiar);
    return () => mql.removeEventListener("change", alCambiar);
  }, [query]);

  return coincideAhora;
}
