import { describe, expect, it } from "vitest";
import { traducirEstadoPedido } from "./pedidos";

describe("traducirEstadoPedido", () => {
  it("traduce bost_Open a Abierto", () => {
    expect(traducirEstadoPedido("bost_Open")).toBe("Abierto");
  });

  it("traduce bost_Close a Cerrado", () => {
    expect(traducirEstadoPedido("bost_Close")).toBe("Cerrado");
  });

  it("muestra el valor crudo si no reconoce el estado (nunca inventa una traduccion)", () => {
    expect(traducirEstadoPedido("bost_Delivered")).toBe("bost_Delivered");
  });

  it("devuelve un guion largo si no hay estado", () => {
    expect(traducirEstadoPedido(null)).toBe("—");
  });
});
