import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { SituacionCuentaResponse } from "../../api/types";
import { useSituacionCuenta, type ApiSituacion } from "./useSituacionCuenta";

const OPCIONES = ["Gestión CC", "Acuerdo CC", "Abogados", "Incobrable"];

function respuesta(parcial: Partial<SituacionCuentaResponse> = {}): SituacionCuentaResponse {
  return {
    situacion: null,
    actualizada_por: null,
    actualizada_por_nombre: null,
    actualizada_utc: null,
    opciones: OPCIONES,
    pagador_central: null,
    ...parcial,
  };
}

function promesaControlada<T>() {
  let resolver: (valor: T) => void = () => {};
  let rechazar: (err: unknown) => void = () => {};
  const promesa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rechazar = reject;
  });
  return { promesa, resolver, rechazar };
}

function api(parcial: Partial<ApiSituacion> = {}): ApiSituacion {
  return {
    obtener: vi.fn().mockResolvedValue(respuesta()),
    guardar: vi.fn().mockResolvedValue(respuesta()),
    ...parcial,
  };
}

describe("useSituacionCuenta", () => {
  it("sin cliente no hace ningún fetch", () => {
    const a = api();
    const { result } = renderHook(() => useSituacionCuenta(a, null));
    expect(a.obtener).not.toHaveBeenCalled();
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(false);
  });

  it("trae la situación del cliente", async () => {
    const datos = respuesta({ situacion: "Abogados", actualizada_por: "rlopez@pontyn.com.uy" });
    const a = api({ obtener: vi.fn().mockResolvedValue(datos) });
    const { result } = renderHook(() => useSituacionCuenta(a, "C1-17453"));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(a.obtener).toHaveBeenCalledWith("C1-17453");
    expect(result.current.datos).toEqual(datos);
    expect(result.current.error).toBeNull();
  });

  it("si falla la carga expone un error", async () => {
    const a = api({ obtener: vi.fn().mockRejectedValue(new Error("500")) });
    const { result } = renderHook(() => useSituacionCuenta(a, "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.datos).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it("al cambiar de cliente no muestra la situación del anterior", async () => {
    const segundo = promesaControlada<SituacionCuentaResponse>();
    const obtener = vi
      .fn()
      .mockResolvedValueOnce(respuesta({ situacion: "Abogados" }))
      .mockReturnValueOnce(segundo.promesa);
    const a = api({ obtener });
    const { result, rerender } = renderHook(({ cc }) => useSituacionCuenta(a, cc), {
      initialProps: { cc: "C1-1" },
    });
    await waitFor(() => expect(result.current.datos?.situacion).toBe("Abogados"));

    rerender({ cc: "C1-2" });
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(true);

    await act(async () => {
      segundo.resolver(respuesta({ situacion: null }));
    });
    expect(result.current.datos?.situacion).toBeNull();
    expect(result.current.cargando).toBe(false);
  });

  it("una respuesta tardía del cliente anterior se descarta", async () => {
    const primero = promesaControlada<SituacionCuentaResponse>();
    const obtener = vi
      .fn()
      .mockReturnValueOnce(primero.promesa)
      .mockResolvedValueOnce(respuesta({ situacion: "Canje" }));
    const a = api({ obtener });
    const { result, rerender } = renderHook(({ cc }) => useSituacionCuenta(a, cc), {
      initialProps: { cc: "C1-1" },
    });
    rerender({ cc: "C1-2" });
    await waitFor(() => expect(result.current.datos?.situacion).toBe("Canje"));

    await act(async () => {
      primero.resolver(respuesta({ situacion: "Abogados" }));
    });
    expect(result.current.datos?.situacion).toBe("Canje");
  });

  it("guardar envía el valor, marca enviando y adopta la respuesta", async () => {
    const pendiente = promesaControlada<SituacionCuentaResponse>();
    const a = api({ guardar: vi.fn().mockReturnValue(pendiente.promesa) });
    const { result } = renderHook(() => useSituacionCuenta(a, "C1-17453"));
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let guardado: Promise<boolean> = Promise.resolve(false);
    act(() => {
      guardado = result.current.guardar("Abogados");
    });
    expect(a.guardar).toHaveBeenCalledWith("C1-17453", "Abogados");
    expect(result.current.enviando).toBe(true);
    expect(result.current.datos?.situacion).toBeNull();

    let ok = false;
    await act(async () => {
      pendiente.resolver(respuesta({ situacion: "Abogados", actualizada_por: "rlopez@pontyn.com.uy" }));
      ok = await guardado;
    });
    expect(ok).toBe(true);
    expect(result.current.enviando).toBe(false);
    expect(result.current.datos?.situacion).toBe("Abogados");
    expect(result.current.errorGuardar).toBeNull();
  });

  it("guardar null (sin situación especial) se envía tal cual", async () => {
    const a = api({ obtener: vi.fn().mockResolvedValue(respuesta({ situacion: "Canje" })) });
    const { result } = renderHook(() => useSituacionCuenta(a, "C1-17453"));
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    await act(async () => {
      await result.current.guardar(null);
    });
    expect(a.guardar).toHaveBeenCalledWith("C1-17453", null);
    expect(result.current.datos?.situacion).toBeNull();
  });

  it("si guardar falla muestra el mensaje de la API y conserva el valor vigente", async () => {
    const a = api({
      obtener: vi.fn().mockResolvedValue(respuesta({ situacion: "Canje" })),
      guardar: vi.fn().mockRejectedValue(new ApiError(400, { error: "Situación inválida." })),
    });
    const { result } = renderHook(() => useSituacionCuenta(a, "C1-17453"));
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let ok = true;
    await act(async () => {
      ok = await result.current.guardar("Abogados");
    });
    expect(ok).toBe(false);
    expect(result.current.enviando).toBe(false);
    expect(result.current.errorGuardar).toBe("Situación inválida.");
    expect(result.current.datos?.situacion).toBe("Canje");
  });

  it("un guardado que termina después de cambiar de cliente no pisa al actual", async () => {
    const pendiente = promesaControlada<SituacionCuentaResponse>();
    const obtener = vi
      .fn()
      .mockResolvedValueOnce(respuesta())
      .mockResolvedValueOnce(respuesta({ situacion: "Clearing" }));
    const a = api({ obtener, guardar: vi.fn().mockReturnValue(pendiente.promesa) });
    const { result, rerender } = renderHook(({ cc }) => useSituacionCuenta(a, cc), {
      initialProps: { cc: "C1-1" },
    });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let guardado: Promise<boolean> = Promise.resolve(false);
    act(() => {
      guardado = result.current.guardar("Abogados");
    });
    rerender({ cc: "C1-2" });
    expect(result.current.enviando).toBe(false);
    await waitFor(() => expect(result.current.datos?.situacion).toBe("Clearing"));

    await act(async () => {
      pendiente.resolver(respuesta({ situacion: "Abogados" }));
      await guardado;
    });
    expect(result.current.datos?.situacion).toBe("Clearing");
    expect(result.current.enviando).toBe(false);
  });

  it("A→B→A: un guardado de A que termina estando en B no deja A trabado en 'enviando'", async () => {
    const pendiente = promesaControlada<SituacionCuentaResponse>();
    const a = api({ guardar: vi.fn().mockReturnValue(pendiente.promesa) });
    const { result, rerender } = renderHook(({ cc }) => useSituacionCuenta(a, cc), {
      initialProps: { cc: "C1-A" },
    });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let guardado: Promise<boolean> = Promise.resolve(false);
    act(() => {
      guardado = result.current.guardar("Canje");
    });
    rerender({ cc: "C2-A" });
    await act(async () => {
      pendiente.resolver(respuesta({ situacion: "Canje" }));
      await guardado;
    });

    rerender({ cc: "C1-A" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    expect(result.current.enviando).toBe(false);
  });

  it("A→B→A también cuando el guardado de A falla", async () => {
    const pendiente = promesaControlada<SituacionCuentaResponse>();
    const a = api({ guardar: vi.fn().mockReturnValue(pendiente.promesa) });
    const { result, rerender } = renderHook(({ cc }) => useSituacionCuenta(a, cc), {
      initialProps: { cc: "C1-A" },
    });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let guardado: Promise<boolean> = Promise.resolve(false);
    act(() => {
      guardado = result.current.guardar("Canje");
    });
    rerender({ cc: "C2-A" });
    await act(async () => {
      pendiente.rechazar(new Error("red"));
      await guardado;
    });

    rerender({ cc: "C1-A" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    expect(result.current.enviando).toBe(false);
    expect(result.current.errorGuardar).toBeNull();
  });

  it("el error de guardado no se arrastra a otro cliente", async () => {
    const a = api({ guardar: vi.fn().mockRejectedValue(new Error("red")) });
    const { result, rerender } = renderHook(({ cc }) => useSituacionCuenta(a, cc), {
      initialProps: { cc: "C1-1" },
    });
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    await act(async () => {
      await result.current.guardar("Canje");
    });
    expect(result.current.errorGuardar).toBeTruthy();

    rerender({ cc: "C1-2" });
    expect(result.current.errorGuardar).toBeNull();
  });
});
