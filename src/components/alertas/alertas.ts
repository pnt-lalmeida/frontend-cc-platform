import type { Alerta, MiembroEquipo, TipoAlerta } from "../../api/types";

// Logica pura del Centro de alertas (Fase 2 CRM).

const ETIQUETAS: Record<TipoAlerta, string> = {
  pedido_bloqueado: "Pedido bloqueado",
  pedido_reabierto: "Pedido reautorizado",
  riesgo_bloqueo: "Riesgo de bloqueo",
  promesa_incumplida: "Promesa incumplida",
};

export function etiquetaTipoAlerta(tipo: TipoAlerta): string {
  return ETIQUETAS[tipo] ?? "Alerta";
}

const MINUTO = 60_000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;

export function haceCuanto(fechaIso: string | null | undefined, ahora: Date): string {
  if (!fechaIso) return "";
  const fecha = new Date(fechaIso);
  if (Number.isNaN(fecha.getTime())) return "";
  const diferencia = ahora.getTime() - fecha.getTime();
  if (diferencia < MINUTO) return "recién";
  if (diferencia < HORA) return `hace ${Math.floor(diferencia / MINUTO)} min`;
  if (diferencia < DIA) return `hace ${Math.floor(diferencia / HORA)} h`;
  const dias = Math.floor(diferencia / DIA);
  return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

export function docEntryDePedido(entidadRef: string | null | undefined): number | null {
  const coincidencia = /^pedido:(\d+)$/.exec(entidadRef ?? "");
  return coincidencia ? Number(coincidencia[1]) : null;
}

// Adonde lleva "Ver". null = la alerta no tiene pantalla asociada todavia.
export function destinoDeAlerta(alerta: Alerta): string | null {
  if (alerta.tipo === "pedido_bloqueado" || alerta.tipo === "pedido_reabierto") {
    const docEntry = docEntryDePedido(alerta.entidad_ref);
    return docEntry === null ? "/bandeja" : `/bandeja?pedido=${docEntry}`;
  }
  return null;
}

export function textoBadge(noVistas: number): string | null {
  if (noVistas <= 0) return null;
  return noVistas > 99 ? "99+" : String(noVistas);
}

// "Resuelta por <nombre>": el nombre sale del equipo (GET /api/alertas lo
// trae); si el UPN no esta, la parte antes de la @.
export function quienResolvio(alerta: Alerta, equipo: MiembroEquipo[]): string {
  const upn = alerta.resuelta_por;
  if (!upn) return "Resuelta";
  if (upn === "sistema") {
    return alerta.tipo === "pedido_bloqueado" ? "El pedido ya no está bloqueado" : "Resuelta automáticamente";
  }
  const clave = upn.toLowerCase();
  const miembro = equipo.find((m) => m.upn.toLowerCase() === clave);
  return `Resuelta por ${miembro?.nombre ?? upn.split("@")[0]}`;
}
