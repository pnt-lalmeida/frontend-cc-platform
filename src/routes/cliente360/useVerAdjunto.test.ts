import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVerAdjunto } from "./useVerAdjunto";

function fakeVentana() {
  return { location: { href: "" }, close: vi.fn() };
}

describe("useVerAdjunto", () => {
  it("abre la ventana ANTES de pedir la url (para no ser bloqueada como popup)", async () => {
    const orden: string[] = [];
    const ventana = fakeVentana();
    const abrirVentana = vi.fn(() => {
      orden.push("abrir");
      return ventana;
    });
    const obtenerUrlAdjunto = vi.fn().mockImplementation(async () => {
      orden.push("fetch");
      return "https://fake/900011/carta.pdf?sas";
    });
    const { result } = renderHook(() => useVerAdjunto(obtenerUrlAdjunto, abrirVentana));

    await act(async () => {
      await result.current.verAdjunto(900011);
    });

    expect(orden).toEqual(["abrir", "fetch"]);
    expect(ventana.location.href).toBe("https://fake/900011/carta.pdf?sas");
  });

  it("marca cargandoDocEntry mientras espera la respuesta", async () => {
    let resolver: (value: string) => void = () => {};
    const promesaControlada = new Promise<string>((resolve) => {
      resolver = resolve;
    });
    const obtenerUrlAdjunto = vi.fn().mockReturnValue(promesaControlada);
    const { result } = renderHook(() => useVerAdjunto(obtenerUrlAdjunto, fakeVentana));

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

  it("expone un error y cierra la ventana cuando la request falla", async () => {
    const ventana = fakeVentana();
    const obtenerUrlAdjunto = vi.fn().mockRejectedValue(new Error("fallo de red"));
    const { result } = renderHook(() => useVerAdjunto(obtenerUrlAdjunto, () => ventana));

    await act(async () => {
      await result.current.verAdjunto(900011);
    });

    expect(ventana.close).toHaveBeenCalled();
    expect(result.current.error).toBe("No se pudo abrir el adjunto.");
  });

  it("si el navegador bloquea el popup, avisa en vez de fallar en silencio", async () => {
    const obtenerUrlAdjunto = vi.fn().mockResolvedValue("https://fake/900011/carta.pdf?sas");
    const { result } = renderHook(() => useVerAdjunto(obtenerUrlAdjunto, () => null));

    await act(async () => {
      await result.current.verAdjunto(900011);
    });

    expect(result.current.error).toMatch(/bloque/i);
  });
});
