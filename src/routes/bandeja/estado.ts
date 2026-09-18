import type { StatusTagVariant } from "../../components/StatusTag";

export function variantParaEstadoBandeja(statusAprobacion: string | null): StatusTagVariant {
  switch (statusAprobacion) {
    case "Pendiente":
      return "caution";
    case "Rechazado":
      return "risk";
    default:
      return "neutral";
  }
}
