// Lee "?cliente=C1-02928" de la URL. Lo usa Cliente 360 para abrirse directo
// en un cliente cuando se llega desde Mi dia (Liber, 30/09/2026).
//
// Devuelve null si el parametro no esta, viene vacio o el entorno no tiene
// window (tests de logica pura): en todos esos casos la pagina arranca como
// siempre, sin cliente elegido.
export const PARAM_CLIENTE = "cliente";

export function leerClienteDeLaUrl(busqueda?: string): string | null {
  const raw = busqueda ?? (typeof window === "undefined" ? "" : window.location.search);
  const valor = new URLSearchParams(raw).get(PARAM_CLIENTE);
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

export function urlDeCliente(cardCode: string): string {
  return `/cliente-360?${PARAM_CLIENTE}=${encodeURIComponent(cardCode)}`;
}
