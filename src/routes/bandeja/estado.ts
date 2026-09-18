import type { StatusTagVariant } from "../../components/StatusTag";

const ESTADOS_BANDEJA: Record<string, StatusTagVariant> = {
  Pendiente: "caution",
  Rechazado: "risk",
};

export function variantParaEstadoBandeja(statusAprobacion: string | null): StatusTagVariant {
  if (!statusAprobacion) {
    return "neutral";
  }
  return ESTADOS_BANDEJA[statusAprobacion] ?? "neutral";
}
