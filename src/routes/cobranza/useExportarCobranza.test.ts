import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { useExportarCobranza, type ApiExportarCobranza } from "./useExportarCobranza";

const descargarPlanilla = vi.fn();
const registrarImpresion = vi.fn();
const guardarArchivo = vi.fn();
const imprimir = vi.fn();
const api: ApiExportarCobranza = {
  descargarPlanilla: (...a) => descargarPlanilla(...a),
  registrarImpresion: (...a) => registrarImpresion(...a),
};
const entorno = { guardarArchivo: (...a: unknown[]) => guardarArchivo(...a), imprimir: () => imprimir() };

function montar(fecha = "2026-10-22") {
  return renderHook(({ f }) => useExportarCobranza(api, f, entorno as never), { initialProps: { f: fecha } });
}

function pendiente<T>() {
  let resolver!: (v: T) => void;
  let rechazar!: (e: unknown) => void;
  const promesa = new Promise<T>((res, rej) => {
    resolver = res;
    rechazar = rej;
  });
  return { promesa, resolver, rechazar };
}

describe("useExportarCobranza", () => {
  beforeEach(() => {
    descargarPlanilla.mockReset().mockResolvedValue({ blob: new Blob(["x"]), nombre: "cobranza-2026-10-22.csv" });
    registrarImpresion.mockReset().mockResolvedValue({});
    guardarArchivo.mockReset();
    imprimir.mockReset();
  });

  it("no hace nada hasta que se pide", () => {
    montar();
    expect(descargarPlanilla).not.toHaveBeenCalled();
    expect(registrarImpresion).not.toHaveBeenCalled();
  });

  it("descargar pide el día y guarda el archivo con el nombre del servidor", async () => {
    const { result } = montar();
    await act(() => result.current.descargar());
    expect(descargarPlanilla).toHaveBeenCalledWith("2026-10-22");
    expect(guardarArchivo).toHaveBeenCalledWith(expect.any(Blob), "cobranza-2026-10-22.csv");
    expect(result.current.error).toBeNull();
  });

  it("sin nombre en la respuesta usa cobranza-FECHA.csv", async () => {
    descargarPlanilla.mockResolvedValue({ blob: new Blob(["x"]), nombre: null });
    const { result } = montar();
    await act(() => result.current.descargar());
    expect(guardarArchivo).toHaveBeenCalledWith(expect.any(Blob), "cobranza-2026-10-22.csv");
  });

  it("mientras descarga queda en vuelo y un segundo clic no repite el pedido", async () => {
    const p = pendiente<{ blob: Blob; nombre: string | null }>();
    descargarPlanilla.mockReturnValue(p.promesa);
    const { result } = montar();
    act(() => void result.current.descargar());
    act(() => void result.current.descargar());
    expect(result.current.descargando).toBe(true);
    expect(descargarPlanilla).toHaveBeenCalledTimes(1);
    await act(async () => p.resolver({ blob: new Blob(["x"]), nombre: null }));
    expect(result.current.descargando).toBe(false);
  });

  it("503 dice que SAP no respondió y que se reintente; no guarda nada", async () => {
    descargarPlanilla.mockRejectedValue(new ApiError(503, { error: "x" }));
    const { result } = montar();
    await act(() => result.current.descargar());
    expect(result.current.error).toMatch(/SAP no respondió/);
    expect(result.current.error).toMatch(/Intentá de nuevo/);
    expect(guardarArchivo).not.toHaveBeenCalled();
    expect(result.current.descargando).toBe(false);
  });

  it("otro error: mensaje claro por defecto", async () => {
    descargarPlanilla.mockRejectedValue(new ApiError(500, { error: "Error interno" }));
    const { result } = montar();
    await act(() => result.current.descargar());
    expect(result.current.error).toMatch(/No se pudo descargar la planilla/);
  });

  it("imprimir registra primero y recién después imprime", async () => {
    const orden: string[] = [];
    registrarImpresion.mockImplementation(async () => void orden.push("registro"));
    imprimir.mockImplementation(() => void orden.push("print"));
    const { result } = montar();
    await act(() => result.current.imprimir());
    expect(registrarImpresion).toHaveBeenCalledWith("2026-10-22");
    expect(orden).toEqual(["registro", "print"]);
  });

  it("si el registro falla, NO imprime y muestra el error", async () => {
    registrarImpresion.mockRejectedValue(new ApiError(500, { error: "Error interno" }));
    const { result } = montar();
    await act(() => result.current.imprimir());
    expect(imprimir).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/No se pudo imprimir/);
    expect(result.current.imprimiendo).toBe(false);
  });

  it("imprimir en vuelo no se repite con un doble clic", async () => {
    const p = pendiente<unknown>();
    registrarImpresion.mockReturnValue(p.promesa);
    const { result } = montar();
    act(() => void result.current.imprimir());
    act(() => void result.current.imprimir());
    expect(result.current.imprimiendo).toBe(true);
    expect(registrarImpresion).toHaveBeenCalledTimes(1);
    await act(async () => p.resolver({}));
    expect(imprimir).toHaveBeenCalledTimes(1);
  });

  it("si cambió de día mientras se registraba, no imprime el día equivocado", async () => {
    const p = pendiente<unknown>();
    registrarImpresion.mockReturnValue(p.promesa);
    const { result, rerender } = montar("2026-10-22");
    act(() => void result.current.imprimir());
    rerender({ f: "2026-10-23" });
    await act(async () => p.resolver({}));
    expect(imprimir).not.toHaveBeenCalled();
    expect(result.current.error).toBeNull();
    expect(result.current.imprimiendo).toBe(false);
  });

  it("un error de otro día no aparece en el día vigente", async () => {
    const p = pendiente<{ blob: Blob; nombre: string | null }>();
    descargarPlanilla.mockReturnValue(p.promesa);
    const { result, rerender } = montar("2026-10-22");
    act(() => void result.current.descargar());
    rerender({ f: "2026-10-23" });
    await act(async () => p.rechazar(new ApiError(503, undefined)));
    expect(result.current.error).toBeNull();
  });

  it("al cambiar de día se limpia el error", async () => {
    descargarPlanilla.mockRejectedValue(new ApiError(503, undefined));
    const { result, rerender } = montar("2026-10-22");
    await act(() => result.current.descargar());
    expect(result.current.error).not.toBeNull();
    rerender({ f: "2026-10-23" });
    await waitFor(() => expect(result.current.error).toBeNull());
  });
});

describe("guardarArchivo", () => {
  it("libera la URL recién después del clic (diferido), no en el mismo tick", async () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { guardarArchivo: guardar } = await import("./useExportarCobranza");
    guardar(new Blob(["x"]), "a.csv");
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:x");
    vi.useRealTimers();
  });
});
