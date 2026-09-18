import type { FichaCliente } from "../../api/types";
import type { StatusTagVariant } from "../../components/StatusTag";

export interface RiesgoTag {
  key: string;
  label: string;
  variant: StatusTagVariant;
}

export function construirResumenRiesgo(ficha: FichaCliente): RiesgoTag[] {
  const tags: RiesgoTag[] = [];

  if (ficha.payment_block) {
    tags.push({ key: "payment_block", label: "Bloqueado", variant: "risk" });
  }
  if (ficha.frozen) {
    tags.push({ key: "frozen", label: "Congelado", variant: "risk" });
  }

  if (ficha.sin_limite) {
    tags.push({ key: "sin_limite", label: "Sin límite", variant: "ok" });
  } else if (ficha.credit_limit !== null) {
    const saldoTotal = (ficha.current_account_balance ?? 0) + (ficha.open_orders_balance ?? 0);
    if (saldoTotal > ficha.credit_limit) {
      tags.push({ key: "sobre_limite", label: "Sobre límite de crédito", variant: "risk" });
    }
  }

  if (ficha.clasificacion_cc) {
    tags.push({
      key: "clasificacion",
      label: `Clasificación ${ficha.clasificacion_cc}`,
      variant: "neutral",
    });
  }

  return tags;
}
