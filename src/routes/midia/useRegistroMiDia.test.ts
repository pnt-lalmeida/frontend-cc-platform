import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { useRegistroMiDia, type ApiRegistroMiDia } from "./useRegistroMiDia";

function controlada<T>() {
  let resolver: (valor: T) => void = () => {};
  let rechazar: (err: unknown) => void = () => {};
  const promesa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rechazar = reject;
  });
  return { promesa, resolver, rechazar };
}

function api(parcial: Partial<ApiRegistroMiDia> = {}): ApiRegistroMiDia {
  return {
    registrar: vi.fn().mockResolvedValue({}),
    obtenerResultados: vi.fn().mockResolvedValue(["Gestionado", "No contactado"]),
    ...parcial,
  };
}

describe("useRegistroMiDia: registrar", () => {
  it("registra la gestión y deja al cliente como recién hecho", async () => {
    const a = api();
    const { result } = renderHook(() => useRegistroMiDia(a));

    let ok = false;
    await act(async () => {
      ok = await result.current.registrar("C1-1", { resultado: "Gestionado", nota: "Paga el viernes" });
    });

    expect(ok).toBe(true);
    expect(a.registrar).toHaveBeenCalledWith("C1-1", { resultado: "Gestionado", nota: "Paga el viernes" });
    expect(result.current.recienHechos.has("C1-1")).toBe(true);
    expect(result.current.enviandoIds).toEqual([]);
  });

  it("'No contactado' se anota pero el cliente sigue pendiente", async () => {
    const { result } = renderHook(() => useRegistroMiDia(api()));
    await act(async () => {
      await result.current.registrar("C1-1", { resultado: "No contactado" });
    });
    expect(result.current.recienHechos.has("C1-1")).toBe(false);
    expect(result.current.anotados.has("C1-1")).toBe(true);
  });

  it("mientras está en vuelo marca el cliente como enviando, y un segundo clic no dispara otra vez", async () => {
    const c = controlada<unknown>();
    const a = api({ registrar: vi.fn().mockReturnValue(c.promesa) });
    const { result } = renderHook(() => useRegistroMiDia(a));

    let primera: Promise<boolean> = Promise.resolve(false);
    let segunda: Promise<boolean> = Promise.resolve(true);
    act(() => {
      primera = result.current.registrar("C1-1", { resultado: "Gestionado" });
      segunda = result.current.registrar("C1-1", { resultado: "Gestionado" });
    });
    expect(result.current.enviandoIds).toEqual(["C1-1"]);
    expect(a.registrar).toHaveBeenCalledTimes(1);

    await act(async () => {
      c.resolver({});
      await primera;
    });
    expect(await segunda).toBe(false);
    expect(result.current.enviandoIds).toEqual([]);
  });

  it("enviar uno no bloquea a otro cliente", async () => {
    const c = controlada<unknown>();
    const a = api({ registrar: vi.fn().mockReturnValueOnce(c.promesa).mockResolvedValue({}) });
    const { result } = renderHook(() => useRegistroMiDia(a));

    act(() => {
      void result.current.registrar("C1-1", { resultado: "Gestionado" });
    });
    await act(async () => {
      await result.current.registrar("C1-2", { resultado: "Gestionado" });
    });
    expect(result.current.recienHechos.has("C1-2")).toBe(true);
    expect(result.current.enviandoIds).toEqual(["C1-1"]);
    await act(async () => {
      c.resolver({});
      await c.promesa;
    });
  });

  it("si falla deja el error junto a ese cliente, no lo marca como hecho y se puede reintentar", async () => {
    const a = api({ registrar: vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({}) });
    const { result } = renderHook(() => useRegistroMiDia(a));

    let ok = true;
    await act(async () => {
      ok = await result.current.registrar("C1-1", { resultado: "Gestionado" });
    });
    expect(ok).toBe(false);
    expect(result.current.errores["C1-1"]).toBe("No se pudo registrar la gestión. Intentá de nuevo.");
    expect(result.current.recienHechos.has("C1-1")).toBe(false);
    expect(result.current.enviandoIds).toEqual([]);

    await act(async () => {
      await result.current.registrar("C1-1", { resultado: "Gestionado" });
    });
    expect(result.current.errores["C1-1"]).toBeUndefined();
    expect(result.current.recienHechos.has("C1-1")).toBe(true);
  });

  it("usa el mensaje que manda el backend cuando lo hay", async () => {
    const a = api({ registrar: vi.fn().mockRejectedValue(new ApiError(400, { error: "resultado invalido: 'x'" })) });
    const { result } = renderHook(() => useRegistroMiDia(a));
    await act(async () => {
      await result.current.registrar("C1-1", { resultado: "Gestionado" });
    });
    expect(result.current.errores["C1-1"]).toBe("resultado invalido: 'x'");
  });

  it("limpiarError y reiniciar", async () => {
    const a = api({ registrar: vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue({}) });
    const { result } = renderHook(() => useRegistroMiDia(a));
    await act(async () => {
      await result.current.registrar("C1-1", { resultado: "Gestionado" });
    });
    act(() => result.current.limpiarError("C1-1"));
    expect(result.current.errores["C1-1"]).toBeUndefined();

    await act(async () => {
      await result.current.registrar("C1-2", { resultado: "No contactado" });
      await result.current.registrar("C1-3", { resultado: "Gestionado" });
    });
    act(() => result.current.reiniciar());
    expect(result.current.recienHechos.size).toBe(0);
    expect(result.current.anotados.size).toBe(0);
  });
});

describe("useRegistroMiDia: lista de resultados", () => {
  it("no pide nada hasta que alguien abre un formulario", () => {
    const a = api();
    renderHook(() => useRegistroMiDia(a));
    expect(a.obtenerResultados).not.toHaveBeenCalled();
  });

  it("la pide una sola vez aunque se abran varios formularios", async () => {
    const a = api();
    const { result } = renderHook(() => useRegistroMiDia(a));

    act(() => {
      void result.current.resultados.cargar("C1-1");
      void result.current.resultados.cargar("C1-2");
    });
    await waitFor(() => expect(result.current.resultados.lista).toEqual(["Gestionado", "No contactado"]));
    await act(async () => {
      await result.current.resultados.cargar("C1-3");
    });
    expect(a.obtenerResultados).toHaveBeenCalledTimes(1);
    expect(a.obtenerResultados).toHaveBeenCalledWith("C1-1");
  });

  it("si falla deja el error y permite reintentar", async () => {
    const a = api({
      obtenerResultados: vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(["Gestionado"]),
    });
    const { result } = renderHook(() => useRegistroMiDia(a));

    await act(async () => {
      await result.current.resultados.cargar("C1-1");
    });
    expect(result.current.resultados.cargando).toBe(false);
    expect(result.current.resultados.error).toMatch(/No se pudo cargar la lista de resultados/);
    expect(result.current.resultados.lista).toBeNull();

    await act(async () => {
      await result.current.resultados.cargar("C1-1");
    });
    expect(result.current.resultados.error).toBeNull();
    expect(result.current.resultados.lista).toEqual(["Gestionado"]);
  });
});
