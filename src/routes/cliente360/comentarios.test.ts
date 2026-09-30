import { describe, expect, it } from "vitest";
import { recortarComentarios } from "./comentarios";

const renglones = (n: number) => Array.from({ length: n }, (_, i) => `Dato ${i + 1}`).join("\n");

describe("recortarComentarios", () => {
  it("no recorta un texto corto", () => {
    const r = recortarComentarios("Paga a 30 dias\nLlamar por la tarde");
    expect(r).toEqual({ visible: "Paga a 30 dias\nLlamar por la tarde", recortado: false, renglonesOcultos: 0 });
  });

  it("no recorta un texto justo en el limite de renglones", () => {
    expect(recortarComentarios(renglones(4)).recortado).toBe(false);
  });

  it("recorta por renglones y cuenta los ocultos", () => {
    const r = recortarComentarios(renglones(10));
    expect(r.visible).toBe(renglones(4) + "…");
    expect(r.recortado).toBe(true);
    expect(r.renglonesOcultos).toBe(6);
  });

  it("recorta por caracteres cuando hay pocos renglones muy largos, cortando en palabra", () => {
    const largo = "palabra ".repeat(100).trim(); // 799 caracteres, un solo renglon
    const r = recortarComentarios(largo);
    expect(r.recortado).toBe(true);
    expect(r.visible.length).toBeLessThanOrEqual(301);
    expect(r.visible.endsWith("palabra…")).toBe(true);
    expect(r.renglonesOcultos).toBe(0);
  });

  it("cuando no hay espacios cerca corta duro en el maximo", () => {
    const r = recortarComentarios("x".repeat(500));
    expect(r.visible).toBe("x".repeat(300) + "…");
  });

  it("soporta el peor caso real (64 renglones) sin romperse", () => {
    const r = recortarComentarios(renglones(64));
    expect(r.recortado).toBe(true);
    expect(r.renglonesOcultos).toBe(60);
  });

  it("respeta limites personalizados", () => {
    const r = recortarComentarios(renglones(5), { maxRenglones: 2, maxCaracteres: 300 });
    expect(r.visible).toBe("Dato 1\nDato 2…");
  });
});
