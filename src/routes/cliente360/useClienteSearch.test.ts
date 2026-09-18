import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteBusqueda } from "../../api/types";
import { useClienteSearch } from "./useClienteSearch";

describe("useClienteSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no dispara la busqueda antes de que pase el debounce", () => {
    const buscar = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useClienteSearch(buscar));

    act(() => {
      result.current.setQuery("mer");
    });
    expect(buscar).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(buscar).not.toHaveBeenCalled();
  });

  it("dispara la busqueda una sola vez tras varios cambios rapidos de texto", async () => {
    const buscar = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useClienteSearch(buscar));

    act(() => {
      result.current.setQuery("m");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setQuery("me");
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => {
      result.current.setQuery("mer");
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith("mer");
  });

  it("vacia los resultados y no busca cuando el texto queda vacio", () => {
    const buscar = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useClienteSearch(buscar));

    act(() => {
      result.current.setQuery("");
    });

    expect(buscar).not.toHaveBeenCalled();
    expect(result.current.resultados).toEqual([]);
  });

  it("descarta respuesta obsoleta si una busqueda mas reciente resuelve primero", async () => {
    // Crear promesas controlables para simular latencias diferentes
    let resolve1: (value: ClienteBusqueda[]) => void;
    let resolve2: (value: ClienteBusqueda[]) => void;

    const promise1 = new Promise<ClienteBusqueda[]>((r) => {
      resolve1 = r;
    });
    const promise2 = new Promise<ClienteBusqueda[]>((r) => {
      resolve2 = r;
    });

    const buscar = vi.fn();
    buscar.mockReturnValueOnce(promise1); // Primera busqueda: "me"
    buscar.mockReturnValueOnce(promise2); // Segunda busqueda: "mercado"

    const { result } = renderHook(() => useClienteSearch(buscar));

    // Primera busqueda: "me"
    act(() => {
      result.current.setQuery("me");
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(buscar).toHaveBeenCalledWith("me");
    expect(result.current.loading).toBe(true);

    // Segunda busqueda: "mercado" antes de que resuelva la primera
    act(() => {
      result.current.setQuery("mercado");
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(buscar).toHaveBeenCalledWith("mercado");

    // Resolver la SEGUNDA busqueda primero (más reciente)
    const datosRecientes: ClienteBusqueda[] = [
      { card_code: "C002", card_name: "Mercado S.A.", numero_sn: "2", moneda: "UYU" },
    ];
    await act(async () => {
      resolve2!(datosRecientes);
      await Promise.resolve();
    });
    expect(result.current.resultados).toEqual(datosRecientes);

    // Resolver la PRIMERA busqueda después (obsoleta)
    const datosAntiguos: ClienteBusqueda[] = [
      { card_code: "C001", card_name: "Me Shop", numero_sn: "1", moneda: "UYU" },
    ];
    await act(async () => {
      resolve1!(datosAntiguos);
      await Promise.resolve();
    });

    // Verificar que resultados NO fue sobrescrito con los datos antiguos
    expect(result.current.resultados).toEqual(datosRecientes);
    expect(result.current.loading).toBe(false);
  });

  it("expone un error cuando buscar rechaza, sin lanzar una excepcion no manejada", async () => {
    const buscar = vi.fn().mockRejectedValue(new Error("fallo de red"));
    const { result } = renderHook(() => useClienteSearch(buscar));

    act(() => {
      result.current.setQuery("mer");
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.error).toBe("No se pudo buscar clientes.");
    expect(result.current.resultados).toEqual([]);
  });
});
