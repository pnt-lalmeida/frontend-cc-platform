import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BitacoraResponse } from "../../api/types";
import { useBitacora } from "./useBitacora";

function bitacora(parcial: Partial<BitacoraResponse> = {}): BitacoraResponse {
  return {
    cliente: { numero_sn: "17454" },
    motivos: ["Pago coordinado"],
    canales: ["Llamada"],
    equipo: [],
    tareas: [],
    eventos: [],
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

describe("useBitacora", () => {
  it("sin cliente no hace ningún fetch", () => {
    const obtener = vi.fn();
    const { result } = renderHook(() => useBitacora(obtener, null));

    expect(obtener).not.toHaveBeenCalled();
    expect(result.current.datos).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("trae la bitácora del cliente", async () => {
    const datos = bitacora();
    const obtener = vi.fn().mockResolvedValue(datos);
    const { result } = renderHook(() => useBitacora(obtener, "C1-17453"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(obtener).toHaveBeenCalledWith("C1-17453");
    expect(result.current.datos).toEqual(datos);
    expect(result.current.error).toBeNull();
  });

  it("recargar vuelve a pedir y conserva los datos mientras carga", async () => {
    const primera = bitacora();
    const segunda = bitacora({ motivos: ["Llamar"] });
    const pendiente = promesaControlada<BitacoraResponse>();
    const obtener = vi.fn().mockResolvedValueOnce(primera).mockReturnValueOnce(pendiente.promesa);
    const { result } = renderHook(() => useBitacora(obtener, "C1-17453"));
    await waitFor(() => expect(result.current.datos).toEqual(primera));

    let recarga: Promise<void> = Promise.resolve();
    act(() => {
      recarga = result.current.recargar();
    });
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(result.current.datos).toEqual(primera);

    await act(async () => {
      pendiente.resolver(segunda);
      await recarga;
    });
    expect(result.current.datos).toEqual(segunda);
  });

  it("si falla una recarga, conserva los datos anteriores y avisa", async () => {
    const primera = bitacora();
    const obtener = vi.fn().mockResolvedValueOnce(primera).mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => useBitacora(obtener, "C1-17453"));
    await waitFor(() => expect(result.current.datos).toEqual(primera));

    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.datos).toEqual(primera);
    expect(result.current.error).toBe("No se pudo actualizar la bitácora. Recargá la página para ver lo último.");
  });

  it("al cambiar de cliente nunca muestra la bitácora del anterior", async () => {
    const pendiente = promesaControlada<BitacoraResponse>();
    const obtener = vi.fn().mockResolvedValueOnce(bitacora()).mockReturnValueOnce(pendiente.promesa);
    const { result, rerender } = renderHook(({ cardCode }: { cardCode: string }) => useBitacora(obtener, cardCode), {
      initialProps: { cardCode: "C1-17453" },
    });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    rerender({ cardCode: "C1-90030" });
    expect(result.current.datos).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("ignora una respuesta vieja que llega después de cambiar de cliente", async () => {
    const vieja = promesaControlada<BitacoraResponse>();
    const nueva = bitacora({ motivos: ["Nuevo"] });
    const obtener = vi.fn().mockReturnValueOnce(vieja.promesa).mockResolvedValueOnce(nueva);
    const { result, rerender } = renderHook(({ cardCode }: { cardCode: string }) => useBitacora(obtener, cardCode), {
      initialProps: { cardCode: "C1-17453" },
    });

    rerender({ cardCode: "C1-90030" });
    await waitFor(() => expect(result.current.datos).toEqual(nueva));

    vieja.resolver(bitacora({ motivos: ["Viejo"] }));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.datos).toEqual(nueva);
  });

  it("no vuelve a pedir si solo cambia la identidad de la función de fetch", async () => {
    const datos = bitacora();
    const llamadas = vi.fn().mockResolvedValue(datos);
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useBitacora((cardCode) => llamadas(cardCode, n), "C1-17453"),
      { initialProps: { n: 1 } }
    );
    await waitFor(() => expect(result.current.datos).toEqual(datos));

    rerender({ n: 2 });
    await new Promise((r) => setTimeout(r, 0));
    expect(llamadas).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  it("si falla la primera carga, expone un error y no deja datos", async () => {
    const obtener = vi.fn().mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => useBitacora(obtener, "C1-17453"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("No se pudo cargar la bitácora del cliente.");
    expect(result.current.datos).toBeNull();
  });
});

describe("useBitacora — recarga de un cliente anterior", () => {
  it("una recarga pedida para el cliente anterior no pisa la carga del actual", async () => {
    const deC1 = bitacora({ cliente: { numero_sn: "1" } });
    const deC2 = bitacora({ cliente: { numero_sn: "2" } });
    const pendienteC2 = promesaControlada<BitacoraResponse>();
    const obtener = vi.fn((codigo: string) => (codigo === "C1-X" ? Promise.resolve(deC1) : pendienteC2.promesa));
    const { result, rerender } = renderHook(({ cardCode }: { cardCode: string }) => useBitacora(obtener, cardCode), {
      initialProps: { cardCode: "C1-X" },
    });
    await waitFor(() => expect(result.current.datos).toEqual(deC1));
    // La accion (ej. registrar gestion) captura el recargar de C1...
    const recargarDeC1 = result.current.recargar;

    // ...el usuario cambia a C2 mientras el POST esta en vuelo...
    rerender({ cardCode: "C2-X" });
    // ...y el POST termina: el recargar viejo no debe pedir C1 de nuevo.
    await act(async () => {
      await recargarDeC1();
    });
    expect(obtener).toHaveBeenCalledTimes(2);

    await act(async () => {
      pendienteC2.resolver(deC2);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.datos).toEqual(deC2);
  });
});
