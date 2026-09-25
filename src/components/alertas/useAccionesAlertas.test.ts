import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { useAccionesAlertas, type ApiAlertas } from "./useAccionesAlertas";

function promesaControlada<T>() {
  let resolver: (valor: T) => void = () => {};
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

function api(parcial: Partial<ApiAlertas> = {}): ApiAlertas {
  return {
    actualizarAlerta: vi.fn().mockResolvedValue({}),
    marcarTodasVistas: vi.fn().mockResolvedValue({ marcadas: 2 }),
    ...parcial,
  };
}

describe("useAccionesAlertas", () => {
  it("marcar vista: PATCH con 'vista', recarga y devuelve true", async () => {
    const a = api();
    const recargar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccionesAlertas(a, recargar));

    let ok = false;
    await act(async () => {
      ok = await result.current.marcarVista.ejecutar(7);
    });
    expect(ok).toBe(true);
    expect(a.actualizarAlerta).toHaveBeenCalledWith(7, "vista");
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(result.current.marcarVista.enCursoIds).toEqual([]);
    expect(result.current.marcarVista.error).toBeNull();
  });

  it("resolver: queda en curso hasta que termina la recarga", async () => {
    const a = api();
    const recarga = promesaControlada<void>();
    const recargar = vi.fn().mockReturnValue(recarga.promesa);
    const { result } = renderHook(() => useAccionesAlertas(a, recargar));

    let envio: Promise<boolean> = Promise.resolve(false);
    act(() => {
      envio = result.current.resolver.ejecutar(7);
    });
    expect(result.current.resolver.enCursoIds).toEqual([7]);
    expect(result.current.marcarVista.enCursoIds).toEqual([]);

    await act(async () => {
      await Promise.resolve();
    });
    expect(a.actualizarAlerta).toHaveBeenCalledWith(7, "resuelta");
    expect(result.current.resolver.enCursoIds).toEqual([7]);

    await act(async () => {
      recarga.resolver();
      await envio;
    });
    expect(result.current.resolver.enCursoIds).toEqual([]);
  });

  it("si falla, muestra el error del backend y recarga igual (otra persona pudo resolverla)", async () => {
    const a = api({
      actualizarAlerta: vi.fn().mockRejectedValue(new ApiError(400, { error: "La alerta ya está resuelta." })),
    });
    const recargar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccionesAlertas(a, recargar));

    let ok = true;
    await act(async () => {
      ok = await result.current.resolver.ejecutar(7);
    });
    expect(ok).toBe(false);
    expect(result.current.resolver.error).toBe("La alerta ya está resuelta.");
    expect(result.current.marcarVista.error).toBeNull();
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(result.current.resolver.enCursoIds).toEqual([]);
  });

  it("error genérico si el backend no manda mensaje", async () => {
    const a = api({ actualizarAlerta: vi.fn().mockRejectedValue(new Error("red")) });
    const { result } = renderHook(() => useAccionesAlertas(a, vi.fn()));
    await act(async () => {
      await result.current.marcarVista.ejecutar(3);
    });
    expect(result.current.marcarVista.error).toMatch(/marcar la alerta como vista/);
  });

  it("marcar todas: POST, estado de envío propio y recarga", async () => {
    const pendiente = promesaControlada<unknown>();
    const a = api({ marcarTodasVistas: vi.fn().mockReturnValue(pendiente.promesa) });
    const recargar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccionesAlertas(a, recargar));

    let envio: Promise<boolean> = Promise.resolve(false);
    act(() => {
      envio = result.current.marcarTodas.ejecutar();
    });
    expect(result.current.marcarTodas.enviando).toBe(true);

    await act(async () => {
      pendiente.resolver({ marcadas: 2 });
      await envio;
    });
    expect(result.current.marcarTodas.enviando).toBe(false);
    expect(result.current.marcarTodas.error).toBeNull();
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("marcar todas con error: avisa y recarga", async () => {
    const a = api({ marcarTodasVistas: vi.fn().mockRejectedValue(new Error("500")) });
    const recargar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccionesAlertas(a, recargar));

    let ok = true;
    await act(async () => {
      ok = await result.current.marcarTodas.ejecutar();
    });
    expect(ok).toBe(false);
    expect(result.current.marcarTodas.error).toMatch(/marcar las alertas/);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("un nuevo intento limpia el error anterior de esa acción", async () => {
    const actualizar = vi.fn().mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce({});
    const { result } = renderHook(() => useAccionesAlertas(api({ actualizarAlerta: actualizar }), vi.fn()));
    await act(async () => {
      await result.current.resolver.ejecutar(1);
    });
    expect(result.current.resolver.error).not.toBeNull();
    await act(async () => {
      await result.current.resolver.ejecutar(1);
    });
    expect(result.current.resolver.error).toBeNull();
  });
});
