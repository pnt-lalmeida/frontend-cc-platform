import { describe, expect, it } from "vitest";
import { CONFIG_VACIA, estaEnPiloto, estaHabilitada, type ConfigResponse } from "./features";

const config: ConfigResponse = {
  es_supervisor: true,
  features: {
    bitacora: { habilitada: true, etapa: "piloto" },
    alertas: { habilitada: true, etapa: "todos" },
    promesas: { habilitada: false, etapa: "off" },
  },
};

describe("features", () => {
  it("habilitada solo si el backend dice habilitada", () => {
    expect(estaHabilitada(config, "bitacora")).toBe(true);
    expect(estaHabilitada(config, "promesas")).toBe(false);
  });

  it("una funcionalidad que el backend no menciona queda oculta", () => {
    expect(estaHabilitada(config, "mi_dia")).toBe(false);
  });

  it("la config vacia oculta todo", () => {
    expect(estaHabilitada(CONFIG_VACIA, "bitacora")).toBe(false);
  });

  it("en piloto solo si esta habilitada y en etapa piloto", () => {
    expect(estaEnPiloto(config, "bitacora")).toBe(true);
    expect(estaEnPiloto(config, "alertas")).toBe(false);
    expect(estaEnPiloto(config, "promesas")).toBe(false);
  });
});
