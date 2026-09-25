import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertasResponse } from "../../api/types";
import { INTERVALO_ALERTAS_MS, useAlertas } from "./useAlertas";

function respuesta(noVistas = 0): AlertasResponse {
  return { no_vistas: noVistas, abiertas: [], resueltas_recientes: [], equipo: [] };
}

function promesaControlada<T>() {
  let resolver: (valor: T) => void = () => {};
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

function simularVisibilidad(estado: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => estado });
}

async function avanzar(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useAlertas", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    simularVisibilidad("visible");
  });
  afterEach(() => {
    vi.useRealTimers();
    simularVisibilidad("visible");
  });

  it("carga al montar", async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta(3));
    const { result } = renderHook(() => useAlertas(obtener));

    expect(result.current.cargando).toBe(true);
    await avanzar(0);
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(result.current.datos?.no_vistas).toBe(3);
    expect(result.current.cargando).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("vuelve a pedir cada 5 minutos con la pestaña visible", async () => {
    const obtener = vi.fn().mockResolvedValueOnce(respuesta(1)).mockResolvedValueOnce(respuesta(2));
    const { result } = renderHook(() => useAlertas(obtener));
    await avanzar(0);

    await avanzar(INTERVALO_ALERTAS_MS - 1);
    expect(obtener).toHaveBeenCalledTimes(1);

    await avanzar(1);
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(result.current.datos?.no_vistas).toBe(2);
  });

  it("con la pestaña oculta no hace polling", async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta());
    renderHook(() => useAlertas(obtener));
    await avanzar(0);

    simularVisibilidad("hidden");
    await avanzar(INTERVALO_ALERTAS_MS * 3);
    expect(obtener).toHaveBeenCalledTimes(1);
  });

  it("al volver a la pestaña o al foco, actualiza", async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta());
    renderHook(() => useAlertas(obtener));
    await avanzar(0);

    simularVisibilidad("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(obtener).toHaveBeenCalledTimes(1);

    simularVisibilidad("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await avanzar(0);
    expect(obtener).toHaveBeenCalledTimes(2);

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await avanzar(0);
    expect(obtener).toHaveBeenCalledTimes(3);
  });

  it("no superpone pedidos: foco, visibilidad y polling con uno en vuelo no disparan otro", async () => {
    const pendiente = promesaControlada<AlertasResponse>();
    const obtener = vi.fn().mockReturnValueOnce(pendiente.promesa).mockResolvedValue(respuesta());
    renderHook(() => useAlertas(obtener));

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await avanzar(INTERVALO_ALERTAS_MS);
    expect(obtener).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendiente.resolver(respuesta());
    });
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await avanzar(0);
    expect(obtener).toHaveBeenCalledTimes(2);
  });

  it("un error de polling no borra la lista que ya se ve", async () => {
    const obtener = vi.fn().mockResolvedValueOnce(respuesta(4)).mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => useAlertas(obtener));
    await avanzar(0);

    await avanzar(INTERVALO_ALERTAS_MS);
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(result.current.datos?.no_vistas).toBe(4);
    expect(result.current.error).toMatch(/actualizar/);
  });

  it("si falla la primera carga, avisa sin datos", async () => {
    const obtener = vi.fn().mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => useAlertas(obtener));
    await avanzar(0);
    expect(result.current.datos).toBeNull();
    expect(result.current.error).toMatch(/cargar/);
  });

  it("una carga exitosa limpia el error anterior", async () => {
    const obtener = vi
      .fn()
      .mockResolvedValueOnce(respuesta(1))
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce(respuesta(2));
    const { result } = renderHook(() => useAlertas(obtener));
    await avanzar(0);
    await avanzar(INTERVALO_ALERTAS_MS);
    expect(result.current.error).not.toBeNull();

    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.datos?.no_vistas).toBe(2);
  });

  it("recargar con un pedido en vuelo espera y pide de nuevo (no se queda con datos viejos)", async () => {
    const pendiente = promesaControlada<AlertasResponse>();
    const obtener = vi.fn().mockReturnValueOnce(pendiente.promesa).mockResolvedValueOnce(respuesta(9));
    const { result } = renderHook(() => useAlertas(obtener));

    let recarga: Promise<void> = Promise.resolve();
    act(() => {
      recarga = result.current.recargar();
    });
    expect(obtener).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendiente.resolver(respuesta(1));
      await recarga;
    });
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(result.current.datos?.no_vistas).toBe(9);
  });

  it("al desmontar deja de actualizar", async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta());
    const { unmount } = renderHook(() => useAlertas(obtener));
    await avanzar(0);
    unmount();

    await avanzar(INTERVALO_ALERTAS_MS * 2);
    window.dispatchEvent(new Event("focus"));
    expect(obtener).toHaveBeenCalledTimes(1);
  });
});
