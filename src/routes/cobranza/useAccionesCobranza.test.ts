import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { DireccionCobranza } from "../../api/types";
import { useAccionesCobranza } from "./useAccionesCobranza";

const DIRECCION: DireccionCobranza = {
  texto: "Nueva 1",
  origen: "plataforma",
  editada_por: "rlopez@pontyn.com.uy",
  editada_utc: "2026-10-15T10:00:00Z",
};

function montar(api: Partial<Parameters<typeof useAccionesCobranza>[0]> = {}) {
  const alGuardarDireccion = vi.fn();
  const alAnular = vi.fn();
  const alRecargar = vi.fn();
  const completa = {
    guardarDireccion: vi.fn().mockResolvedValue(DIRECCION),
    anular: vi.fn().mockResolvedValue({}),
    ...api,
  };
  const hook = renderHook(() => useAccionesCobranza(completa, { alGuardarDireccion, alAnular, alRecargar }));
  return { ...hook, completa, alGuardarDireccion, alAnular, alRecargar };
}

function controlada<T>() {
  let resolver!: (v: T) => void;
  const promesa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promesa, resolver };
}

describe("useAccionesCobranza: dirección", () => {
  it("guarda, avisa con la dirección devuelta y devuelve true", async () => {
    const { result, completa, alGuardarDireccion } = montar();
    let ok = false;
    await act(async () => {
      ok = await result.current.guardarDireccion("C1-A", "Nueva 1");
    });
    expect(ok).toBe(true);
    expect(completa.guardarDireccion).toHaveBeenCalledWith("C1-A", "Nueva 1");
    expect(alGuardarDireccion).toHaveBeenCalledWith("C1-A", DIRECCION);
    expect(result.current.guardando.has("C1-A")).toBe(false);
  });

  it("mientras guarda marca al cliente y un segundo guardado no pega dos veces", async () => {
    const c = controlada<DireccionCobranza>();
    const { result, completa } = montar({ guardarDireccion: vi.fn().mockReturnValue(c.promesa) });
    let primero!: Promise<boolean>;
    act(() => {
      primero = result.current.guardarDireccion("C1-A", "Nueva 1");
    });
    expect(result.current.guardando.has("C1-A")).toBe(true);
    let segundo = true;
    await act(async () => {
      segundo = await result.current.guardarDireccion("C1-A", "Nueva 1");
    });
    expect(segundo).toBe(false);
    expect(completa.guardarDireccion).toHaveBeenCalledTimes(1);
    await act(async () => {
      c.resolver(DIRECCION);
      await primero;
    });
    expect(result.current.guardando.size).toBe(0);
  });

  it("el error queda por cliente, con el mensaje del backend si lo hay", async () => {
    const { result } = montar({
      guardarDireccion: vi.fn().mockRejectedValue(new ApiError(400, { error: "La dirección es demasiado larga." })),
    });
    await act(async () => {
      await result.current.guardarDireccion("C1-A", "x");
    });
    expect(result.current.errorDireccion["C1-A"]).toBe("La dirección es demasiado larga.");
    act(() => result.current.limpiarErrorDireccion("C1-A"));
    expect(result.current.errorDireccion["C1-A"]).toBeUndefined();
  });

  it("error sin mensaje: texto por defecto", async () => {
    const { result } = montar({ guardarDireccion: vi.fn().mockRejectedValue(new Error("red")) });
    await act(async () => {
      await result.current.guardarDireccion("C1-A", "x");
    });
    expect(result.current.errorDireccion["C1-A"]).toBe("No se pudo guardar la dirección. Intentá de nuevo.");
  });
});

describe("useAccionesCobranza: anular", () => {
  it("anula, quita de la lista y devuelve true", async () => {
    const { result, completa, alAnular } = montar();
    let ok = false;
    await act(async () => {
      ok = await result.current.anular(7);
    });
    expect(ok).toBe(true);
    expect(completa.anular).toHaveBeenCalledWith(7);
    expect(alAnular).toHaveBeenCalledWith(7);
    expect(result.current.anulando.has(7)).toBe(false);
  });

  it("doble clic: una sola llamada", async () => {
    const c = controlada<unknown>();
    const { result, completa } = montar({ anular: vi.fn().mockReturnValue(c.promesa) });
    let primero!: Promise<boolean>;
    act(() => {
      primero = result.current.anular(7);
    });
    expect(result.current.anulando.has(7)).toBe(true);
    await act(async () => {
      await result.current.anular(7);
    });
    expect(completa.anular).toHaveBeenCalledTimes(1);
    await act(async () => {
      c.resolver({});
      await primero;
    });
  });

  it("409: avisa que ya no estaba programada y recarga", async () => {
    const { result, alRecargar, alAnular } = montar({ anular: vi.fn().mockRejectedValue(new ApiError(409, {})) });
    await act(async () => {
      await result.current.anular(7);
    });
    expect(result.current.errorAnular[7]).toBe("Ya fue anulada o reprogramada.");
    expect(alRecargar).toHaveBeenCalled();
    expect(alAnular).not.toHaveBeenCalled();
  });

  it("otro error: mensaje reintentable y la cobranza sigue en la lista", async () => {
    const { result, alAnular } = montar({ anular: vi.fn().mockRejectedValue(new Error("red")) });
    await act(async () => {
      await result.current.anular(7);
    });
    expect(result.current.errorAnular[7]).toBe("No se pudo anular. Intentá de nuevo.");
    expect(alAnular).not.toHaveBeenCalled();
    expect(result.current.anulando.has(7)).toBe(false);
  });
});
