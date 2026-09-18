import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});
