import { describe, expect, it } from "vitest";
import { leerClienteDeLaUrl, urlDeCliente } from "./urlCliente";

describe("leerClienteDeLaUrl", () => {
  it("devuelve el card_code cuando viene en la URL", () => {
    expect(leerClienteDeLaUrl("?cliente=C1-02928")).toBe("C1-02928");
    expect(leerClienteDeLaUrl("?otra=x&cliente=C2-07094&mas=y")).toBe("C2-07094");
  });

  it("sin el parametro devuelve null: la pagina arranca como siempre", () => {
    expect(leerClienteDeLaUrl("")).toBeNull();
    expect(leerClienteDeLaUrl("?otra=x")).toBeNull();
  });

  it("vacio o solo espacios es lo mismo que no estar", () => {
    expect(leerClienteDeLaUrl("?cliente=")).toBeNull();
    expect(leerClienteDeLaUrl("?cliente=%20%20")).toBeNull();
  });

  it("arma el link escapando el codigo", () => {
    expect(urlDeCliente("C1-02928")).toBe("/cliente-360?cliente=C1-02928");
    expect(urlDeCliente("C1 02/928")).toBe("/cliente-360?cliente=C1%2002%2F928");
  });
});
