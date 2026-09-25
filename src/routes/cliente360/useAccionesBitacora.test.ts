import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { useAccionesBitacora, type ApiBitacora } from "./useAccionesBitacora";

function promesaControlada<T>() {
  let resolver: (valor: T) => void = () => {};
  const promesa = new Promise<T>((resolve) => {
    resolver = resolve;
  });
  return { promesa, resolver };
}

function apiFalsa(parcial: Partial<ApiBitacora> = {}): ApiBitacora {
  return {
    registrarGestion: vi.fn().mockResolvedValue({}),
    crearRecordatorio: vi.fn().mockResolvedValue({}),
    completarTarea: vi.fn().mockResolvedValue({}),
    ...parcial,
  };
}

describe("useAccionesBitacora", () => {
  it("registrar gestión llama a la API con el cliente y recarga la bitácora", async () => {
    const api = apiFalsa();
    const recargar = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAccionesBitacora(api, "C1-17453", recargar));

    let ok = false;
    await act(async () => {
      ok = await result.current.gestion.enviar({ resultado: "Pago coordinado", canal: "Llamada" });
    });

    expect(ok).toBe(true);
    expect(api.registrarGestion).toHaveBeenCalledWith("C1-17453", { resultado: "Pago coordinado", canal: "Llamada" });
    expect(recargar).toHaveBeenCalledTimes(1);
    expect(result.current.gestion.error).toBeNull();
  });

  it("marca 'enviando' solo en la acción en curso", async () => {
    const pendiente = promesaControlada<unknown>();
    const api = apiFalsa({ registrarGestion: vi.fn().mockReturnValue(pendiente.promesa) });
    const { result } = renderHook(() => useAccionesBitacora(api, "C1-17453", vi.fn()));

    let envio: Promise<boolean> = Promise.resolve(false);
    act(() => {
      envio = result.current.gestion.enviar({ resultado: "Llamar" });
    });
    expect(result.current.gestion.enviando).toBe(true);
    expect(result.current.recordatorio.enviando).toBe(false);
    expect(result.current.completar.completandoIds).toEqual([]);

    await act(async () => {
      pendiente.resolver({});
      await envio;
    });
    expect(result.current.gestion.enviando).toBe(false);
  });

  it("si falla, muestra el error del backend en esa acción, sin recargar", async () => {
    const api = apiFalsa({
      registrarGestion: vi.fn().mockRejectedValue(new ApiError(400, { error: "El motivo no es válido." })),
    });
    const recargar = vi.fn();
    const { result } = renderHook(() => useAccionesBitacora(api, "C1-17453", recargar));

    let ok = true;
    await act(async () => {
      ok = await result.current.gestion.enviar({ resultado: "x" });
    });

    expect(ok).toBe(false);
    expect(result.current.gestion.error).toBe("El motivo no es válido.");
    expect(result.current.recordatorio.error).toBeNull();
    expect(recargar).not.toHaveBeenCalled();
  });

  it("crear recordatorio: éxito recarga; error de red usa un mensaje por defecto", async () => {
    const crear = vi.fn().mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("red"));
    const api = apiFalsa({ crearRecordatorio: crear });
    const recargar = vi.fn();
    const { result } = renderHook(() => useAccionesBitacora(api, "C1-17453", recargar));
    const body = { descripcion: "Llamar", fecha_objetivo: "2026-09-26" };

    await act(async () => {
      await result.current.recordatorio.enviar(body);
    });
    expect(crear).toHaveBeenCalledWith("C1-17453", body);
    expect(recargar).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.recordatorio.enviar(body);
    });
    expect(result.current.recordatorio.error).toBe("No se pudo crear el recordatorio. Intentá de nuevo.");
  });

  it("un nuevo envío limpia el error anterior de esa acción", async () => {
    const api = apiFalsa({
      registrarGestion: vi.fn().mockRejectedValueOnce(new Error("red")).mockResolvedValueOnce({}),
    });
    const { result } = renderHook(() => useAccionesBitacora(api, "C1-17453", vi.fn()));

    await act(async () => {
      await result.current.gestion.enviar({ resultado: "Llamar" });
    });
    expect(result.current.gestion.error).toBe("No se pudo registrar la gestión. Intentá de nuevo.");

    await act(async () => {
      await result.current.gestion.enviar({ resultado: "Llamar" });
    });
    expect(result.current.gestion.error).toBeNull();
  });

  it("completar tarea marca solo esa tarea como en curso y recarga al terminar", async () => {
    const pendiente = promesaControlada<unknown>();
    const api = apiFalsa({ completarTarea: vi.fn().mockReturnValue(pendiente.promesa) });
    const recargar = vi.fn();
    const { result } = renderHook(() => useAccionesBitacora(api, "C1-17453", recargar));

    let envio: Promise<boolean> = Promise.resolve(false);
    act(() => {
      envio = result.current.completar.completar(12);
    });
    expect(api.completarTarea).toHaveBeenCalledWith(12);
    expect(result.current.completar.completandoIds).toEqual([12]);

    await act(async () => {
      pendiente.resolver({});
      await envio;
    });
    expect(result.current.completar.completandoIds).toEqual([]);
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("completar tarea con error expone el mensaje", async () => {
    const api = apiFalsa({
      completarTarea: vi.fn().mockRejectedValue(new ApiError(400, { error: "La tarea ya está completada." })),
    });
    const recargar = vi.fn();
    const { result } = renderHook(() => useAccionesBitacora(api, "C1-17453", recargar));

    await act(async () => {
      await result.current.completar.completar(12);
    });
    expect(result.current.completar.error).toBe("La tarea ya está completada.");
    expect(result.current.completar.completandoIds).toEqual([]);
    // Otra persona pudo haberla completado: se recarga para no dejarla pendiente.
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("al cambiar de cliente se limpian los errores", async () => {
    const api = apiFalsa({ registrarGestion: vi.fn().mockRejectedValue(new Error("red")) });
    const { result, rerender } = renderHook(
      ({ cardCode }: { cardCode: string }) => useAccionesBitacora(api, cardCode, vi.fn()),
      { initialProps: { cardCode: "C1-17453" } }
    );
    await act(async () => {
      await result.current.gestion.enviar({ resultado: "Llamar" });
    });
    expect(result.current.gestion.error).not.toBeNull();

    rerender({ cardCode: "C1-90030" });
    expect(result.current.gestion.error).toBeNull();
  });
});
