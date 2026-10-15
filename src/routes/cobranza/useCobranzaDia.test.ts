import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CobranzaProgramada, CobranzaProgramadaResponse } from "../../api/types";
import { useCobranzaDia } from "./useCobranzaDia";

function cobranza(id: number, parcial: Partial<CobranzaProgramada> = {}): CobranzaProgramada {
  return {
    id,
    numero_sn: `0${id}`,
    card_code: `C1-0${id}`,
    cliente_nombre: `Cliente ${id}`,
    direccion: { texto: "Rivera 2020", origen: "sap", editada_por: null, editada_utc: null },
    fecha_cobranza: "2026-10-15",
    horario: null,
    importe: null,
    moneda: null,
    registrada_por: "rlopez@pontyn.com.uy",
    registrada_utc: "2026-10-14T12:00:00Z",
    ...parcial,
  };
}

function respuesta(fecha: string, cobranzas: CobranzaProgramada[], errores: string[] = []): CobranzaProgramadaResponse {
  return { fecha, cobranzas, errores };
}

function controlada<T>() {
  let resolver!: (v: T) => void;
  const promesa = new Promise<T>((res) => {
    resolver = res;
  });
  return { promesa, resolver };
}

describe("useCobranzaDia", () => {
  it("carga el día pedido", async () => {
    const obtener = vi.fn().mockResolvedValue(respuesta("2026-10-15", [cobranza(1)]));
    const { result } = renderHook(() => useCobranzaDia(obtener, "2026-10-15"));
    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.datos?.cobranzas).toHaveLength(1));
    expect(obtener).toHaveBeenCalledWith("2026-10-15");
    expect(result.current.cargando).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("al cambiar de día no muestra la lista del día anterior mientras carga", async () => {
    const obtener = vi
      .fn()
      .mockResolvedValueOnce(respuesta("2026-10-15", [cobranza(1)]))
      .mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = renderHook(({ f }) => useCobranzaDia(obtener, f), { initialProps: { f: "2026-10-15" } });
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    rerender({ f: "2026-10-16" });
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(true);
  });

  it("descarta la respuesta de un día que ya no es el elegido", async () => {
    const lento = controlada<CobranzaProgramadaResponse>();
    const obtener = vi
      .fn()
      .mockReturnValueOnce(lento.promesa)
      .mockResolvedValueOnce(respuesta("2026-10-16", [cobranza(2)]));
    const { result, rerender } = renderHook(({ f }) => useCobranzaDia(obtener, f), { initialProps: { f: "2026-10-15" } });
    rerender({ f: "2026-10-16" });
    await waitFor(() => expect(result.current.datos?.fecha).toBe("2026-10-16"));
    await act(async () => {
      lento.resolver(respuesta("2026-10-15", [cobranza(1)]));
      await lento.promesa;
    });
    expect(result.current.datos?.fecha).toBe("2026-10-16");
    expect(result.current.datos?.cobranzas.map((c) => c.id)).toEqual([2]);
  });

  it("un error nunca deja cargando y se puede reintentar", async () => {
    const obtener = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(respuesta("2026-10-15", [cobranza(1)]));
    const { result } = renderHook(() => useCobranzaDia(obtener, "2026-10-15"));
    await waitFor(() => expect(result.current.error).toBe("No se pudieron cargar las cobranzas."));
    expect(result.current.cargando).toBe(false);
    expect(result.current.datos).toBeNull();
    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.datos?.cobranzas).toHaveLength(1);
  });

  it("una recarga fallida conserva la lista que ya se veía", async () => {
    const obtener = vi
      .fn()
      .mockResolvedValueOnce(respuesta("2026-10-15", [cobranza(1)]))
      .mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useCobranzaDia(obtener, "2026-10-15"));
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.datos?.cobranzas).toHaveLength(1);
    expect(result.current.error).toBe("No se pudo actualizar. Lo que ves puede estar desactualizado.");
    expect(result.current.cargando).toBe(false);
  });

  it("quitar saca una cobranza y reemplazarDireccion actualiza todas las del cliente", async () => {
    const obtener = vi
      .fn()
      .mockResolvedValue(
        respuesta("2026-10-15", [cobranza(1, { card_code: "C1-A" }), cobranza(2, { card_code: "C1-A" }), cobranza(3, { card_code: "C1-B" })])
      );
    const { result } = renderHook(() => useCobranzaDia(obtener, "2026-10-15"));
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    act(() =>
      result.current.reemplazarDireccion("C1-A", {
        texto: "Nueva 1",
        origen: "plataforma",
        editada_por: "x@y",
        editada_utc: "2026-10-15T10:00:00Z",
      })
    );
    expect(result.current.datos?.cobranzas.map((c) => c.direccion.texto)).toEqual(["Nueva 1", "Nueva 1", "Rivera 2020"]);
    act(() => result.current.quitar(2));
    expect(result.current.datos?.cobranzas.map((c) => c.id)).toEqual([1, 3]);
  });
});
