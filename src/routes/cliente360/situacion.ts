import type { StatusTagVariant } from "../../components/StatusTag";
import { formatDate } from "../../design/format";
import { hoyUruguay } from "../../utils/fechas";

export const SIN_SITUACION = "Sin situación especial";

// Criterio de diseño (contrato Fase A): estas tres indican que la cuenta ya
// salió de la gestión normal; el resto se muestra neutro.
const EN_RIESGO = new Set(["Abogados", "Incobrable", "Clearing"]);

export function varianteSituacion(situacion: string): StatusTagVariant {
  return EN_RIESGO.has(situacion) ? "risk" : "neutral";
}

// Usa el nombre si el backend lo manda; si no, la parte del UPN antes de la @.
export function textoActualizada(
  nombrePor: string | null | undefined,
  upnPor: string | null,
  utc: string | null
): string | null {
  const fecha = utc && !Number.isNaN(new Date(utc).getTime()) ? formatDate(hoyUruguay(new Date(utc))) : null;
  const nombre = nombrePor?.trim() || (upnPor ? upnPor.split("@")[0] : null);
  if (!nombre && !fecha) return null;
  return ["Actualizada", nombre ? `por ${nombre}` : null, fecha ? `el ${fecha}` : null].filter(Boolean).join(" ");
}
