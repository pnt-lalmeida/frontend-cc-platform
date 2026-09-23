import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirEnNuevaPestana } from "./abrirEnNuevaPestana";

describe("abrirEnNuevaPestana", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("crea un link target=_blank, lo clickea, y lo saca del DOM", () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    abrirEnNuevaPestana("https://fake/900011/carta.pdf?sas");

    expect(clickSpy).toHaveBeenCalledTimes(1);
    const link = clickSpy.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(link.href).toBe("https://fake/900011/carta.pdf?sas");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
    expect(document.body.contains(link)).toBe(false);
  });
});
