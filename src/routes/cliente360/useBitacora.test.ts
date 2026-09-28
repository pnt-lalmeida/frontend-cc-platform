import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BitacoraResponse, EventoBitacora, FiltroBitacora, PaginaEventosBitacora } from "../../api/types";
import { useBitacora, type FuentesBitacora } from "./useBitacora";

function ev(id: number, parcial: Partial<EventoBitacora> = {}): EventoBitacora {
  return {
    id,
    tipo: "manual",
    canal: null,
    resultado: "Pago coordinado",
    nota: null,
    origen: "rlopez@pontyn.com.uy",
    fecha_utc: `2026-09-${String(10 + (id % 18)).padStart(2, "0")}T12:00:00+00:00`,
    referencia: null,
    card_code: "C1-17453",
    ...parcial,
  };
}

function bitacora(parcial: Partial<BitacoraResponse> = {}): BitacoraResponse {
  return {
    cliente: { numero_sn: "17454" },
    motivos: ["Pago coordinado"],
    canales: ["Llamada"],
    equipo: [],
    tareas: [],
    eventos: [],
    hay_mas: false,
    siguiente: null,
    resumen: { ultima_gestion: null, tareas_pendientes: 0, tareas_vencidas: 0 },
    ...parcial,
  };
}

function pagina(eventos: EventoBitacora[], siguiente: string | null = null): PaginaEventosBitacora {
  return { eventos, hay_mas: siguiente !== null, siguiente };
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

function fuentes(parcial: Partial<FuentesBitacora> = {}): FuentesBitacora {
  return {
    obtenerBitacora: vi.fn().mockResolvedValue(bitacora()),
    obtenerEventos: vi.fn().mockResolvedValue(pagina([])),
    ...parcial,
  };
}

interface Props {
  cardCode: string | null;
  filtro?: FiltroBitacora;
}

function montar(f: FuentesBitacora, inicial: Props) {
  return renderHook(({ cardCode, filtro }: Props) => useBitacora(f, cardCode, filtro ?? "todo"), {
    initialProps: inicial,
  });
}

describe("useBitacora — carga inicial y recarga", () => {
  it("sin cliente no hace ningún fetch", () => {
    const f = fuentes();
    const { result } = montar(f, { cardCode: null });

    expect(f.obtenerBitacora).not.toHaveBeenCalled();
    expect(result.current.datos).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("trae la primera página del filtro vigente con el resto de la bitácora", async () => {
    const datos = bitacora({ eventos: [ev(1)], hay_mas: true, siguiente: "2026-09-11T12:00:00+00:00" });
    const f = fuentes({ obtenerBitacora: vi.fn().mockResolvedValue(datos) });
    const { result } = montar(f, { cardCode: "C1-17453", filtro: "gestiones" });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(f.obtenerBitacora).toHaveBeenCalledWith("C1-17453", "gestiones");
    expect(result.current.datos).toEqual(datos);
    expect(result.current.eventos).toEqual([ev(1)]);
    expect(result.current.hayMas).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("recargar vuelve a pedir y conserva los datos mientras carga", async () => {
    const primera = bitacora({ eventos: [ev(1)] });
    const segunda = bitacora({ eventos: [ev(2), ev(1)] });
    const pendiente = promesaControlada<BitacoraResponse>();
    const f = fuentes({ obtenerBitacora: vi.fn().mockResolvedValueOnce(primera).mockReturnValueOnce(pendiente.promesa) });
    const { result } = montar(f, { cardCode: "C1-17453" });
    await waitFor(() => expect(result.current.datos).toEqual(primera));

    let recarga: Promise<void> = Promise.resolve();
    act(() => {
      recarga = result.current.recargar();
    });
    expect(f.obtenerBitacora).toHaveBeenCalledTimes(2);
    expect(result.current.eventos).toEqual([ev(1)]);

    await act(async () => {
      pendiente.resolver(segunda);
      await recarga;
    });
    expect(result.current.eventos).toEqual([ev(2), ev(1)]);
  });

  it("si falla una recarga, conserva los datos anteriores y avisa", async () => {
    const primera = bitacora({ eventos: [ev(1)] });
    const f = fuentes({ obtenerBitacora: vi.fn().mockResolvedValueOnce(primera).mockRejectedValueOnce(new Error("500")) });
    const { result } = montar(f, { cardCode: "C1-17453" });
    await waitFor(() => expect(result.current.datos).toEqual(primera));

    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.datos).toEqual(primera);
    expect(result.current.eventos).toEqual([ev(1)]);
    expect(result.current.error).toBe("No se pudo actualizar la bitácora. Recargá la página para ver lo último.");
  });

  it("si falla la primera carga, expone un error y no deja datos", async () => {
    const f = fuentes({ obtenerBitacora: vi.fn().mockRejectedValue(new Error("500")) });
    const { result } = montar(f, { cardCode: "C1-17453" });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("No se pudo cargar la bitácora del cliente.");
    expect(result.current.datos).toBeNull();
  });

  it("no vuelve a pedir si solo cambia la identidad de las funciones de fetch", async () => {
    const llamadas = vi.fn().mockResolvedValue(bitacora());
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) =>
        useBitacora(
          { obtenerBitacora: (c, t) => llamadas(c, t, n), obtenerEventos: vi.fn() },
          "C1-17453",
          "todo"
        ),
      { initialProps: { n: 1 } }
    );
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    rerender({ n: 2 });
    await new Promise((r) => setTimeout(r, 0));
    expect(llamadas).toHaveBeenCalledTimes(1);
    expect(result.current.loading).toBe(false);
  });

  it("recargar después de paginar descarta lo paginado y trae la primera página del filtro vigente", async () => {
    const f = fuentes({
      obtenerBitacora: vi
        .fn()
        .mockResolvedValueOnce(bitacora({ eventos: [ev(3)], hay_mas: true, siguiente: "S1" }))
        .mockResolvedValueOnce(bitacora({ eventos: [ev(9), ev(3)], hay_mas: true, siguiente: "S2" })),
      obtenerEventos: vi.fn().mockResolvedValue(pagina([ev(2)])),
    });
    const { result } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    await act(async () => {
      await result.current.anteriores.cargar();
    });
    expect(result.current.eventos).toEqual([ev(3), ev(2)]);

    await act(async () => {
      await result.current.recargar();
    });
    expect(f.obtenerBitacora).toHaveBeenLastCalledWith("C1-17453", "todo");
    expect(result.current.eventos).toEqual([ev(9), ev(3)]);
    expect(result.current.hayMas).toBe(true);
  });
});

describe("useBitacora — cliente vigente", () => {
  it("al cambiar de cliente nunca muestra la bitácora del anterior", async () => {
    const pendiente = promesaControlada<BitacoraResponse>();
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValueOnce(bitacora({ eventos: [ev(1)] })).mockReturnValueOnce(pendiente.promesa),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-17453" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    rerender({ cardCode: "C1-90030" });
    expect(result.current.datos).toBeNull();
    expect(result.current.eventos).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it("ignora una respuesta vieja que llega después de cambiar de cliente", async () => {
    const vieja = promesaControlada<BitacoraResponse>();
    const nueva = bitacora({ motivos: ["Nuevo"] });
    const f = fuentes({ obtenerBitacora: vi.fn().mockReturnValueOnce(vieja.promesa).mockResolvedValueOnce(nueva) });
    const { result, rerender } = montar(f, { cardCode: "C1-17453" });

    rerender({ cardCode: "C1-90030" });
    await waitFor(() => expect(result.current.datos).toEqual(nueva));

    vieja.resolver(bitacora({ motivos: ["Viejo"] }));
    await new Promise((r) => setTimeout(r, 0));
    expect(result.current.datos).toEqual(nueva);
  });

  it("una recarga pedida para el cliente anterior no pisa la carga del actual", async () => {
    const deC1 = bitacora({ cliente: { numero_sn: "1" } });
    const deC2 = bitacora({ cliente: { numero_sn: "2" } });
    const pendienteC2 = promesaControlada<BitacoraResponse>();
    const f = fuentes({
      obtenerBitacora: vi.fn((codigo: string) => (codigo === "C1-X" ? Promise.resolve(deC1) : pendienteC2.promesa)),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-X" });
    await waitFor(() => expect(result.current.datos).toEqual(deC1));
    // La accion (ej. registrar gestion) captura el recargar de C1...
    const recargarDeC1 = result.current.recargar;

    // ...el usuario cambia a C2 mientras el POST esta en vuelo...
    rerender({ cardCode: "C2-X" });
    // ...y el POST termina: el recargar viejo no debe pedir C1 de nuevo.
    await act(async () => {
      await recargarDeC1();
    });
    expect(f.obtenerBitacora).toHaveBeenCalledTimes(2);

    await act(async () => {
      pendienteC2.resolver(deC2);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.datos).toEqual(deC2);
  });

  it("al volver a un cliente ya visto (después de que otro falló), pide todo de nuevo", async () => {
    const deC1 = bitacora({ cliente: { numero_sn: "1" } });
    const f = fuentes({
      obtenerBitacora: vi
        .fn()
        .mockResolvedValueOnce(deC1)
        .mockRejectedValueOnce(new Error("500"))
        .mockResolvedValueOnce(deC1),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-X" });
    await waitFor(() => expect(result.current.datos).toEqual(deC1));
    rerender({ cardCode: "C2-X" });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    rerender({ cardCode: "C1-X", filtro: "gestiones" });
    await waitFor(() => expect(result.current.datos).toEqual(deC1));
    expect(f.obtenerBitacora).toHaveBeenLastCalledWith("C1-X", "gestiones");
    expect(f.obtenerEventos).not.toHaveBeenCalled();
  });

  it("descarta una página de 'Ver anteriores' que llega después de cambiar de cliente", async () => {
    const vieja = promesaControlada<PaginaEventosBitacora>();
    const f = fuentes({
      obtenerBitacora: vi
        .fn()
        .mockResolvedValueOnce(bitacora({ eventos: [ev(1)], hay_mas: true, siguiente: "S1" }))
        .mockResolvedValueOnce(bitacora({ eventos: [ev(7)] })),
      obtenerEventos: vi.fn().mockReturnValueOnce(vieja.promesa),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-X" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let carga: Promise<void> = Promise.resolve();
    act(() => {
      carga = result.current.anteriores.cargar();
    });
    rerender({ cardCode: "C2-X" });
    await waitFor(() => expect(result.current.eventos).toEqual([ev(7)]));

    await act(async () => {
      vieja.resolver(pagina([ev(2)]));
      await carga;
    });
    expect(result.current.eventos).toEqual([ev(7)]);
  });
});

describe("useBitacora — filtros", () => {
  it("cambiar de filtro pide solo la primera página de eventos, sin volver a traer el resto", async () => {
    const base = bitacora({ eventos: [ev(1), ev(2)], motivos: ["Base"] });
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(base),
      obtenerEventos: vi.fn().mockResolvedValue(pagina([ev(2)], "S9")),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    rerender({ cardCode: "C1-17453", filtro: "gestiones" });
    // Mientras llega, no se muestran los eventos del filtro anterior.
    expect(result.current.eventos).toEqual([]);
    expect(result.current.cargandoEventos).toBe(true);
    expect(result.current.datos?.motivos).toEqual(["Base"]);

    await waitFor(() => expect(result.current.cargandoEventos).toBe(false));
    expect(f.obtenerEventos).toHaveBeenCalledWith("C1-17453", { tipo: "gestiones" });
    expect(f.obtenerBitacora).toHaveBeenCalledTimes(1);
    expect(result.current.eventos).toEqual([ev(2)]);
    expect(result.current.hayMas).toBe(true);
  });

  it("descarta la respuesta de un filtro superado por otro", async () => {
    const lenta = promesaControlada<PaginaEventosBitacora>();
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(bitacora()),
      obtenerEventos: vi.fn((_c: string, { tipo }: { tipo: FiltroBitacora }) =>
        tipo === "gestiones" ? lenta.promesa : Promise.resolve(pagina([ev(5, { tipo: "automatico" })]))
      ),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    rerender({ cardCode: "C1-17453", filtro: "gestiones" });
    rerender({ cardCode: "C1-17453", filtro: "autorizaciones" });
    await waitFor(() => expect(result.current.eventos).toHaveLength(1));

    await act(async () => {
      lenta.resolver(pagina([ev(1)]));
    });
    expect(result.current.eventos).toEqual([ev(5, { tipo: "automatico" })]);
  });

  it("descarta una página de 'Ver anteriores' que llega después de cambiar de filtro", async () => {
    const vieja = promesaControlada<PaginaEventosBitacora>();
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(bitacora({ eventos: [ev(1)], hay_mas: true, siguiente: "S1" })),
      obtenerEventos: vi
        .fn()
        .mockReturnValueOnce(vieja.promesa)
        .mockResolvedValueOnce(pagina([ev(4)])),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let carga: Promise<void> = Promise.resolve();
    act(() => {
      carga = result.current.anteriores.cargar();
    });
    rerender({ cardCode: "C1-17453", filtro: "gestiones" });
    await waitFor(() => expect(result.current.eventos).toEqual([ev(4)]));

    await act(async () => {
      vieja.resolver(pagina([ev(2)]));
      await carga;
    });
    expect(result.current.eventos).toEqual([ev(4)]);
    expect(result.current.anteriores.cargando).toBe(false);
  });

  it("si falla el filtro, avisa sin mostrar eventos de otro filtro y recargar lo reintenta", async () => {
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(bitacora({ eventos: [ev(1)] })),
      obtenerEventos: vi.fn().mockRejectedValue(new Error("500")),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    rerender({ cardCode: "C1-17453", filtro: "situacion" });
    await waitFor(() => expect(result.current.errorEventos).not.toBeNull());
    expect(result.current.eventos).toEqual([]);
    expect(result.current.cargandoEventos).toBe(false);

    await act(async () => {
      await result.current.recargar();
    });
    expect(f.obtenerBitacora).toHaveBeenLastCalledWith("C1-17453", "situacion");
    expect(result.current.errorEventos).toBeNull();
  });

  it("si cambia el filtro con una recarga completa en vuelo, pide todo de nuevo (no pierde tareas ni resumen)", async () => {
    const recarga = promesaControlada<BitacoraResponse>();
    const actualizada = bitacora({ motivos: ["Actualizada"] });
    const f = fuentes({
      obtenerBitacora: vi
        .fn()
        .mockResolvedValueOnce(bitacora())
        .mockReturnValueOnce(recarga.promesa)
        .mockResolvedValueOnce(actualizada),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    act(() => {
      void result.current.recargar();
    });
    rerender({ cardCode: "C1-17453", filtro: "gestiones" });
    await waitFor(() => expect(result.current.datos).toEqual(actualizada));
    expect(f.obtenerBitacora).toHaveBeenLastCalledWith("C1-17453", "gestiones");
    expect(f.obtenerEventos).not.toHaveBeenCalled();
  });
});

describe("useBitacora — recarga completa con otro filtro que falla", () => {
  it("no queda 'cargando' para siempre: muestra el error del filtro y recargar lo reintenta", async () => {
    const recarga = promesaControlada<BitacoraResponse>();
    const f = fuentes({
      obtenerBitacora: vi
        .fn()
        .mockResolvedValueOnce(bitacora({ eventos: [ev(1)] }))
        .mockReturnValueOnce(recarga.promesa)
        .mockRejectedValueOnce(new Error("500"))
        .mockResolvedValueOnce(bitacora({ eventos: [ev(2)] })),
    });
    const { result, rerender } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    act(() => {
      void result.current.recargar();
    });
    rerender({ cardCode: "C1-17453", filtro: "gestiones" });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cargandoEventos).toBe(false);
    expect(result.current.errorEventos).toBe("No se pudo cargar el historial con este filtro.");
    expect(result.current.eventos).toEqual([]);
    expect(result.current.hayMas).toBe(false);

    await act(async () => {
      await result.current.recargar();
    });
    expect(f.obtenerBitacora).toHaveBeenLastCalledWith("C1-17453", "gestiones");
    expect(result.current.errorEventos).toBeNull();
    expect(result.current.eventos).toEqual([ev(2)]);
  });

  it("si la recarga falla con el mismo filtro, conserva los eventos (solo avisa)", async () => {
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValueOnce(bitacora({ eventos: [ev(1)] })).mockRejectedValueOnce(new Error("500")),
    });
    const { result } = montar(f, { cardCode: "C1-17453", filtro: "todo" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.eventos).toEqual([ev(1)]);
    expect(result.current.errorEventos).toBeNull();
    expect(result.current.cargandoEventos).toBe(false);
  });
});

describe("useBitacora — Ver anteriores", () => {
  it("agrega la página siguiente del filtro vigente, con el cursor", async () => {
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(bitacora({ eventos: [ev(3)], hay_mas: true, siguiente: "S1" })),
      obtenerEventos: vi.fn().mockResolvedValue(pagina([ev(2), ev(1)], "S2")),
    });
    const { result } = montar(f, { cardCode: "C1-17453", filtro: "autorizaciones" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let carga: Promise<void> = Promise.resolve();
    act(() => {
      carga = result.current.anteriores.cargar();
    });
    expect(result.current.anteriores.cargando).toBe(true);
    await act(async () => {
      await carga;
    });

    expect(f.obtenerEventos).toHaveBeenCalledWith("C1-17453", { tipo: "autorizaciones", antesDe: "S1" });
    expect(result.current.eventos).toEqual([ev(3), ev(2), ev(1)]);
    expect(result.current.hayMas).toBe(true);
    expect(result.current.anteriores.cargando).toBe(false);
  });

  it("sin más páginas no pide nada", async () => {
    const f = fuentes({ obtenerBitacora: vi.fn().mockResolvedValue(bitacora({ eventos: [ev(3)] })) });
    const { result } = montar(f, { cardCode: "C1-17453" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    await act(async () => {
      await result.current.anteriores.cargar();
    });
    expect(f.obtenerEventos).not.toHaveBeenCalled();
  });

  it("no dispara dos pedidos de la misma página a la vez", async () => {
    const pendiente = promesaControlada<PaginaEventosBitacora>();
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(bitacora({ eventos: [ev(3)], hay_mas: true, siguiente: "S1" })),
      obtenerEventos: vi.fn().mockReturnValue(pendiente.promesa),
    });
    const { result } = montar(f, { cardCode: "C1-17453" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    act(() => {
      void result.current.anteriores.cargar();
      void result.current.anteriores.cargar();
    });
    expect(f.obtenerEventos).toHaveBeenCalledTimes(1);
    await act(async () => {
      pendiente.resolver(pagina([ev(2)]));
    });
  });

  it("si falla, conserva lo ya cargado y deja reintentar", async () => {
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(bitacora({ eventos: [ev(3)], hay_mas: true, siguiente: "S1" })),
      obtenerEventos: vi.fn().mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(pagina([ev(2)])),
    });
    const { result } = montar(f, { cardCode: "C1-17453" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    await act(async () => {
      await result.current.anteriores.cargar();
    });
    expect(result.current.anteriores.error).toBe("No se pudieron cargar los anteriores. Intentá de nuevo.");
    expect(result.current.eventos).toEqual([ev(3)]);
    expect(result.current.hayMas).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      await result.current.anteriores.cargar();
    });
    expect(result.current.anteriores.error).toBeNull();
    expect(result.current.eventos).toEqual([ev(3), ev(2)]);
    expect(result.current.hayMas).toBe(false);
  });

  it("no duplica un evento que ya estaba cargado", async () => {
    const f = fuentes({
      obtenerBitacora: vi.fn().mockResolvedValue(bitacora({ eventos: [ev(3)], hay_mas: true, siguiente: "S1" })),
      obtenerEventos: vi.fn().mockResolvedValue(pagina([ev(3), ev(2)])),
    });
    const { result } = montar(f, { cardCode: "C1-17453" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    await act(async () => {
      await result.current.anteriores.cargar();
    });
    expect(result.current.eventos).toEqual([ev(3), ev(2)]);
  });
});
