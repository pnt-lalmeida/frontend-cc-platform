import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "./useMediaQuery";

type Listener = (e: { matches: boolean }) => void;

function simularMatchMedia(inicial: boolean) {
  const listeners = new Set<Listener>();
  const mql = {
    matches: inicial,
    addEventListener: vi.fn((_: string, l: Listener) => listeners.add(l)),
    removeEventListener: vi.fn((_: string, l: Listener) => listeners.delete(l)),
  };
  const original = window.matchMedia;
  window.matchMedia = vi.fn(() => mql) as unknown as typeof window.matchMedia;
  return {
    mql,
    listeners,
    cambiar(matches: boolean) {
      mql.matches = matches;
      listeners.forEach((l) => l({ matches }));
    },
    restaurar() {
      window.matchMedia = original;
    },
  };
}

describe("useMediaQuery", () => {
  let restaurar = () => {};
  afterEach(() => restaurar());

  it("sin matchMedia (entornos viejos o tests) devuelve false", () => {
    const original = window.matchMedia;
    // @ts-expect-error se simula un navegador sin matchMedia
    delete window.matchMedia;
    const { result } = renderHook(() => useMediaQuery("(max-width: 720px)"));
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });

  it("devuelve el estado inicial y reacciona al cambio", () => {
    const mm = simularMatchMedia(false);
    restaurar = mm.restaurar;
    const { result } = renderHook(() => useMediaQuery("(max-width: 720px)"));
    expect(result.current).toBe(false);
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 720px)");

    act(() => mm.cambiar(true));
    expect(result.current).toBe(true);
    act(() => mm.cambiar(false));
    expect(result.current).toBe(false);
  });

  it("limpia el listener al desmontar", () => {
    const mm = simularMatchMedia(true);
    restaurar = mm.restaurar;
    const { result, unmount } = renderHook(() => useMediaQuery("(max-width: 720px)"));
    expect(result.current).toBe(true);
    expect(mm.listeners.size).toBe(1);
    unmount();
    expect(mm.listeners.size).toBe(0);
  });
});
