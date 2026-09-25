import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IndicadoresPago } from "../../api/types";
import { useIndicadoresPago } from "./useIndicadoresPago";

function indicadores(parcial: Partial<IndicadoresPago> = {}): IndicadoresPago {
  return {
    ventana_meses: 6,
    historial_suficiente: true,
    minimo_facturas: 5,
    facturas_consideradas: 42,
    dias_para_cobrar: 34.2,
    dias_atraso: 9.1,
    tendencia: "mejora",
    anterior: null,
    ...parcial,
  };
}

function promesaControlada<T>() {
  let resolver: (valor: T) => void = () => {};
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

describe("useIndicadoresPago", () => {
  it("sin cliente no hace ningun fetch", () => {
    const obtener = vi.fn();
    const { result } = renderHook(() => useIndicadoresPago(obtener, null, 6));

    expect(obtener).not.toHaveBeenCalled();
    expect(result.current).toEqual({ datos: null, loading: false, error: null });
  });

  it("trae los indicadores del cliente para la ventana pedida", async () => {
    const datos = indicadores();
    const obtener = vi.fn().mockResolvedValue(datos);
    const { result } = renderHook(() => useIndicadoresPago(obtener, "C1-90020", 6));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(obtener).toHaveBeenCalledWith("C1-90020", 6);
    expect(result.current.datos).toEqual(datos);
    expect(result.current.error).toBeNull();
  });

  it("vuelve a pedir al cambiar la ventana, conservando los datos anteriores mientras carga", async () => {
    const seis = indicadores();
    const doce = indicadores({ ventana_meses: 12, facturas_consideradas: 80 });
    const segunda = promesaControlada<IndicadoresPago>();
    const obtener = vi.fn().mockResolvedValueOnce(seis).mockReturnValueOnce(segunda.promesa);
    const { result, rerender } = renderHook(
      ({ ventana }: { ventana: 6 | 12 }) => useIndicadoresPago(obtener, "C1-90020", ventana),
      { initialProps: { ventana: 6 } }
    );
    await waitFor(() => expect(result.current.datos).toEqual(seis));

    rerender({ ventana: 12 });
    expect(obtener).toHaveBeenLastCalledWith("C1-90020", 12);
    expect(result.current.loading).toBe(true);
    expect(result.current.datos).toEqual(seis);

    segunda.resolver(doce);
    await waitFor(() => expect(result.current.datos).toEqual(doce));
  });

  it("al cambiar de cliente nunca muestra los datos del cliente anterior", async () => {
    const segunda = promesaControlada<IndicadoresPago>();
    const obtener = vi.fn().mockResolvedValueOnce(indicadores()).mockReturnValueOnce(segunda.promesa);
    const { result, rerender } = renderHook(
      ({ cardCode }: { cardCode: string }) => useIndicadoresPago(obtener, cardCode, 6),
      { initialProps: { cardCode: "C1-90020" } }
    );
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    rerender({ cardCode: "C1-90030" });
    expect(result.current.datos).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("ignora una respuesta vieja que llega despues de cambiar de cliente", async () => {
    const primera = promesaControlada<IndicadoresPago>();
    const nuevo = indicadores({ facturas_consideradas: 7 });
    const obtener = vi.fn().mockReturnValueOnce(primera.promesa).mockResolvedValueOnce(nuevo);
    const { result, rerender } = renderHook(
      ({ cardCode }: { cardCode: string }) => useIndicadoresPago(obtener, cardCode, 6),
      { initialProps: { cardCode: "C1-90020" } }
    );

    rerender({ cardCode: "C1-90030" });
    await waitFor(() => expect(result.current.datos).toEqual(nuevo));

    primera.resolver(indicadores({ facturas_consideradas: 999 }));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.datos).toEqual(nuevo);
  });

  it("si falla, expone un error y no deja datos", async () => {
    const obtener = vi.fn().mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => useIndicadoresPago(obtener, "C1-90020", 6));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("No se pudieron cargar los indicadores de pago.");
    expect(result.current.datos).toBeNull();
  });
});
