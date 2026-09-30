import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MiDiaResponse } from "../../api/types";
import { useMiDia } from "./useMiDia";

function respuesta(parcial: Partial<MiDiaResponse> = {}): MiDiaResponse {
  return {
    fecha: "2026-09-30",
    dia: "MIERCOLES",
    clientes_del_dia: null,
    tareas: [],
    promesas: [],
    alertas: null,
    pedidos_bandeja: null,
    habilitadas: { promesas: true, alertas: true },
    errores: [],
    ...parcial,
  };
}

function controlada<T>() {
  let resolver: (valor: T) => void = () => {};
  let rechazar: (err: unknown) => void = () => {};
  const promesa = new Promise<T>((resolve, reject) => {
    resolver = resolve;
    rechazar = reject;
  });
  return { promesa, resolver, rechazar };
}

describe("useMiDia", () => {
  it("carga la pantalla al montar", async () => {
    const datos = respuesta();
    const obtener = vi.fn().mockResolvedValue(datos);
    const { result } = renderHook(() => useMiDia(obtener));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(result.current.datos).toEqual(datos);
    expect(result.current.error).toBeNull();
  });

  it("si la carga falla deja de cargar y ofrece reintentar, que funciona", async () => {
    const obtener = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(respuesta());
    const { result } = renderHook(() => useMiDia(obtener));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.datos).toBeNull();
    expect(result.current.error).toMatch(/No se pudo cargar Mi día/);

    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.datos).not.toBeNull();
  });

  it("recargar devuelve si salió bien, y si falla conserva lo que ya se veía", async () => {
    const primera = respuesta({ fecha: "2026-09-30" });
    const obtener = vi.fn().mockResolvedValueOnce(primera).mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useMiDia(obtener));
    await waitFor(() => expect(result.current.datos).toEqual(primera));

    let ok = true;
    await act(async () => {
      ok = await result.current.recargar();
    });
    expect(ok).toBe(false);
    expect(result.current.datos).toEqual(primera);
    expect(result.current.error).toMatch(/No se pudo actualizar/);
    expect(result.current.cargando).toBe(false);
  });

  it("una respuesta vieja que llega después de una recarga más nueva se descarta", async () => {
    const lenta = controlada<MiDiaResponse>();
    const rapida = controlada<MiDiaResponse>();
    const obtener = vi.fn().mockReturnValueOnce(lenta.promesa).mockReturnValueOnce(rapida.promesa);
    const { result } = renderHook(() => useMiDia(obtener));

    let segunda: Promise<boolean> = Promise.resolve(false);
    act(() => {
      segunda = result.current.recargar();
    });
    const nueva = respuesta({ fecha: "2026-10-01" });
    await act(async () => {
      rapida.resolver(nueva);
      await segunda;
    });
    await act(async () => {
      lenta.resolver(respuesta({ fecha: "2026-09-29" }));
      await lenta.promesa;
    });

    expect(result.current.datos).toEqual(nueva);
    expect(result.current.cargando).toBe(false);
  });
});
