import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVerAdjunto } from "./useVerAdjunto";

describe("useVerAdjunto", () => {
  it("pide la url y la abre", async () => {
    const obtenerUrlAdjunto = vi.fn().mockResolvedValue("https://fake/900011/carta.pdf?sas");
    const abrir = vi.fn();
    const { result } = renderHook(() => useVerAdjunto(obtenerUrlAdjunto, abrir));

    await act(async () => {
      await result.current.verAdjunto(900011);
    });

    expect(obtenerUrlAdjunto).toHaveBeenCalledWith(900011);
    expect(abrir).toHaveBeenCalledWith("https://fake/900011/carta.pdf?sas");
    expect(result.current.error).toBeNull();
    expect(result.current.cargandoDocEntry).toBeNull();
  });

  it("marca cargandoDocEntry mientras espera la respuesta", async () => {
    let resolver: (value: string) => void = () => {};
    const promesaControlada = new Promise<string>((resolve) => {
      resolver = resolve;
    });
    const obtenerUrlAdjunto = vi.fn().mockReturnValue(promesaControlada);
    const abrir = vi.fn();
    const { result } = renderHook(() => useVerAdjunto(obtenerUrlAdjunto, abrir));

    let promesa!: Promise<void>;
    act(() => {
      promesa = result.current.verAdjunto(900011);
    });
    expect(result.current.cargandoDocEntry).toBe(900011);

    await act(async () => {
      resolver("https://fake/900011/carta.pdf?sas");
      await promesa;
    });
    expect(result.current.cargandoDocEntry).toBeNull();
  });

  it("expone un error cuando la request falla, sin abrir nada", async () => {
    const obtenerUrlAdjunto = vi.fn().mockRejectedValue(new Error("fallo de red"));
    const abrir = vi.fn();
    const { result } = renderHook(() => useVerAdjunto(obtenerUrlAdjunto, abrir));

    await act(async () => {
      await result.current.verAdjunto(900011);
    });

    expect(abrir).not.toHaveBeenCalled();
    expect(result.current.error).toBe("No se pudo abrir el adjunto.");
  });
});
