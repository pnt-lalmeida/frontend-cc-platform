import { describe, expect, it } from "vitest";
import type { FichaCliente } from "../../api/types";
import { construirResumenRiesgo } from "./riesgo";

function fichaBase(overrides: Partial<FichaCliente> = {}): FichaCliente {
  return {
    card_code: "C1-11391",
    card_name: "Cliente de prueba",
    moneda: "UYU",
    credit_limit: 100000,
    sin_limite: false,
    current_account_balance: 0,
    open_orders_balance: 0,
    valid: true,
    frozen: false,
    block_dunning: false,
    payment_block: false,
    numero_sn: "11391",
    email_cc: null,
    whatsapp_cc: null,
    clasificacion_cc: null,
    dias_tolerancia_cc: null,
    cheques_pendientes: null,
    condicion_pago: null,
    suspendido: false,
    cuentas_relacionadas: [],
    ...overrides,
  };
}

describe("construirResumenRiesgo", () => {
  it("marca bloqueado cuando payment_block es true", () => {
    const tags = construirResumenRiesgo(fichaBase({ payment_block: true }));
    expect(tags).toContainEqual({ key: "payment_block", label: "Bloqueado", variant: "risk" });
  });

  it("marca congelado cuando frozen es true", () => {
    const tags = construirResumenRiesgo(fichaBase({ frozen: true }));
    expect(tags).toContainEqual({ key: "frozen", label: "Congelado", variant: "risk" });
  });

  it("marca sobre limite cuando el saldo total supera el credit_limit", () => {
    const tags = construirResumenRiesgo(
      fichaBase({ credit_limit: 1000, current_account_balance: 800, open_orders_balance: 500 })
    );
    expect(tags).toContainEqual({ key: "sobre_limite", label: "Sobre límite de crédito", variant: "risk" });
  });

  it("no marca sobre limite cuando el saldo total esta dentro del limite", () => {
    const tags = construirResumenRiesgo(
      fichaBase({ credit_limit: 1000, current_account_balance: 200, open_orders_balance: 100 })
    );
    expect(tags.find((t) => t.key === "sobre_limite")).toBeUndefined();
  });

  it("marca sin limite cuando sin_limite es true, sin evaluar el saldo", () => {
    const tags = construirResumenRiesgo(fichaBase({ sin_limite: true, credit_limit: null }));
    expect(tags).toContainEqual({ key: "sin_limite", label: "Sin límite", variant: "ok" });
    expect(tags.find((t) => t.key === "sobre_limite")).toBeUndefined();
  });

  it("la clasificacion siempre es variante neutral, nunca ok o risk", () => {
    const tags = construirResumenRiesgo(fichaBase({ clasificacion_cc: "A" }));
    expect(tags).toContainEqual({ key: "clasificacion", label: "Clasificación A", variant: "neutral" });
  });

  it("no agrega tag de clasificacion cuando no hay clasificacion_cc", () => {
    const tags = construirResumenRiesgo(fichaBase({ clasificacion_cc: null }));
    expect(tags.find((t) => t.key === "clasificacion")).toBeUndefined();
  });
});
