import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { PromesaPago, PromesasResponse, RegistrarPromesaRequest } from "../../api/types";
import { usePromesas, type ApiPromesas } from "./usePromesas";

function promesa(parcial: Partial<PromesaPago> = {}): PromesaPago {
  return {
    id: 1,
    numero_sn: "17454",
    card_code: "C1-17453",
    fecha_prometida: "2026-10-02",
    importe: 45000,
    moneda: "UYU",
    canal: null,
    facturas: null,
    registrada_por: "rlopez@pontyn.com.uy",
    registrada_utc: "2026-09-29T14:00:00Z",
    estado: "vigente",
    estado_utc: null,
    importe_verificado: null,
    ...parcial,
  };
}

function respuesta(promesas: PromesaPago[] = []): PromesasResponse {
  return { promesas, monedas: ["UYU", "USD", "EUR"] };
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

function api(parcial: Partial<ApiPromesas> = {}): ApiPromesas {
  return {
    obtener: vi.fn().mockResolvedValue(respuesta()),
    registrar: vi.fn().mockResolvedValue(promesa()),
    ...parcial,
  };
}

const BODY: RegistrarPromesaRequest = { fecha_prometida: "2026-10-02", importe: 45000, moneda: "UYU" };

describe("usePromesas — carga", () => {
  it("sin cliente no hace ningún fetch", () => {
    const a = api();
    const { result } = renderHook(() => usePromesas(a, null));
    expect(a.obtener).not.toHaveBeenCalled();
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(false);
  });

  it("trae las promesas del cliente", async () => {
    const datos = respuesta([promesa()]);
    const a = api({ obtener: vi.fn().mockResolvedValue(datos) });
    const { result } = renderHook(() => usePromesas(a, "C1-17453"));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(a.obtener).toHaveBeenCalledWith("C1-17453");
    expect(result.current.datos).toEqual(datos);
    expect(result.current.error).toBeNull();
  });

  it("si falla la carga deja de cargar, expone el error y se puede reintentar", async () => {
    const obtener = vi.fn().mockRejectedValueOnce(new Error("500")).mockResolvedValue(respuesta([promesa()]));
    const { result } = renderHook(() => usePromesas(api({ obtener }), "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.datos).toBeNull();
    expect(result.current.error).toBeTruthy();

    await act(async () => {
      await result.current.recargar();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.datos?.promesas).toHaveLength(1);
  });

  it("al cambiar de cliente no muestra las promesas del anterior, ni siquiera un render", async () => {
    const a = api({
      obtener: vi.fn().mockImplementation(async (cc: string) => respuesta([promesa({ card_code: cc })])),
    });
    const { result, rerender } = renderHook(({ cc }) => usePromesas(a, cc), { initialProps: { cc: "C1-1" } });
    await waitFor(() => expect(result.current.datos?.promesas[0].card_code).toBe("C1-1"));

    rerender({ cc: "C1-2" });
    expect(result.current.datos).toBeNull();
    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.datos?.promesas[0].card_code).toBe("C1-2"));
  });

  it("descarta la respuesta de un cliente anterior que llega tarde", async () => {
    const primero = controlada<PromesasResponse>();
    const obtener = vi
      .fn()
      .mockReturnValueOnce(primero.promesa)
      .mockResolvedValueOnce(respuesta([promesa({ card_code: "C1-2", id: 2 })]));
    const { result, rerender } = renderHook(({ cc }) => usePromesas(api({ obtener }), cc), {
      initialProps: { cc: "C1-1" },
    });
    rerender({ cc: "C1-2" });
    await waitFor(() => expect(result.current.datos?.promesas[0].card_code).toBe("C1-2"));

    await act(async () => {
      primero.resolver(respuesta([promesa({ card_code: "C1-1", id: 1 })]));
      await primero.promesa;
    });
    expect(result.current.datos?.promesas[0].card_code).toBe("C1-2");
  });

  it("un error de un cliente anterior que llega tarde tampoco pisa al actual", async () => {
    const primero = controlada<PromesasResponse>();
    const obtener = vi.fn().mockReturnValueOnce(primero.promesa).mockResolvedValueOnce(respuesta([promesa({ id: 2 })]));
    const { result, rerender } = renderHook(({ cc }) => usePromesas(api({ obtener }), cc), {
      initialProps: { cc: "C1-1" },
    });
    rerender({ cc: "C1-2" });
    await waitFor(() => expect(result.current.datos).not.toBeNull());
    await act(async () => {
      primero.rechazar(new Error("500"));
      await primero.promesa.catch(() => {});
    });
    expect(result.current.error).toBeNull();
    expect(result.current.datos?.promesas[0].id).toBe(2);
  });

  it("recargar conserva lo que ya se mostraba mientras trae lo nuevo, y si falla no lo borra", async () => {
    const segunda = controlada<PromesasResponse>();
    const obtener = vi.fn().mockResolvedValueOnce(respuesta([promesa()])).mockReturnValueOnce(segunda.promesa);
    const { result } = renderHook(() => usePromesas(api({ obtener }), "C1-17453"));
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let recarga!: Promise<void>;
    act(() => {
      recarga = result.current.recargar();
    });
    expect(result.current.cargando).toBe(true);
    expect(result.current.datos?.promesas).toHaveLength(1);

    await act(async () => {
      segunda.rechazar(new Error("500"));
      await recarga;
    });
    expect(result.current.cargando).toBe(false);
    expect(result.current.datos?.promesas).toHaveLength(1);
    expect(result.current.error).toBeTruthy();
  });
});

describe("usePromesas — registrar", () => {
  it("manda el body, recarga la lista y devuelve true; enviando vale true durante el POST", async () => {
    const post = controlada<PromesaPago>();
    const obtener = vi.fn().mockResolvedValueOnce(respuesta()).mockResolvedValueOnce(respuesta([promesa()]));
    const a = api({ obtener, registrar: vi.fn().mockReturnValue(post.promesa) });
    const { result } = renderHook(() => usePromesas(a, "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    let resultado!: Promise<boolean>;
    act(() => {
      resultado = result.current.registrar(BODY);
    });
    expect(result.current.enviando).toBe(true);
    expect(a.registrar).toHaveBeenCalledWith("C1-17453", BODY);

    await act(async () => {
      post.resolver(promesa());
      await resultado;
    });
    expect(await resultado).toBe(true);
    expect(result.current.enviando).toBe(false);
    expect(obtener).toHaveBeenCalledTimes(2);
    expect(result.current.datos?.promesas).toHaveLength(1);
  });

  it("un doble clic no dispara dos POST", async () => {
    const post = controlada<PromesaPago>();
    const a = api({ registrar: vi.fn().mockReturnValue(post.promesa) });
    const { result } = renderHook(() => usePromesas(a, "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    let primero!: Promise<boolean>;
    let segundo!: Promise<boolean>;
    act(() => {
      primero = result.current.registrar(BODY);
      segundo = result.current.registrar(BODY);
    });
    await act(async () => {
      post.resolver(promesa());
      await primero;
    });
    expect(await segundo).toBe(false);
    expect(a.registrar).toHaveBeenCalledTimes(1);
  });

  it("si el POST falla muestra el mensaje del backend, no recarga y devuelve false", async () => {
    const a = api({
      registrar: vi.fn().mockRejectedValue(new ApiError(400, { error: "La fecha prometida no es válida." })),
    });
    const { result } = renderHook(() => usePromesas(a, "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    let ok = true;
    await act(async () => {
      ok = await result.current.registrar(BODY);
    });
    expect(ok).toBe(false);
    expect(result.current.enviando).toBe(false);
    expect(result.current.errorRegistrar).toBe("La fecha prometida no es válida.");
    expect(a.obtener).toHaveBeenCalledTimes(1);
  });

  it("sin mensaje del backend usa uno propio que dice cómo seguir", async () => {
    const a = api({ registrar: vi.fn().mockRejectedValue(new Error("red")) });
    const { result } = renderHook(() => usePromesas(a, "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    await act(async () => {
      await result.current.registrar(BODY);
    });
    expect(result.current.errorRegistrar).toBe("No se pudo registrar la promesa. Intentá de nuevo.");
  });

  it("un nuevo intento limpia el error anterior", async () => {
    const registrar = vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValue(promesa());
    const { result } = renderHook(() => usePromesas(api({ registrar }), "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    await act(async () => {
      await result.current.registrar(BODY);
    });
    expect(result.current.errorRegistrar).toBeTruthy();
    await act(async () => {
      await result.current.registrar(BODY);
    });
    expect(result.current.errorRegistrar).toBeNull();
  });

  it("si la promesa se registró pero la recarga falla, igual devuelve true y avisa que la lista no se actualizó", async () => {
    const obtener = vi.fn().mockResolvedValueOnce(respuesta()).mockRejectedValueOnce(new Error("500"));
    const { result } = renderHook(() => usePromesas(api({ obtener }), "C1-17453"));
    await waitFor(() => expect(result.current.cargando).toBe(false));
    let ok = false;
    await act(async () => {
      ok = await result.current.registrar(BODY);
    });
    expect(ok).toBe(true);
    expect(result.current.error).toBeTruthy();
  });

  it("si terminó de registrar cuando ya se cambió de cliente, no toca los datos ni errores del actual", async () => {
    const post = controlada<PromesaPago>();
    const obtener = vi.fn().mockImplementation(async (cc: string) => respuesta([promesa({ card_code: cc })]));
    const a = api({ obtener, registrar: vi.fn().mockReturnValue(post.promesa) });
    const { result, rerender } = renderHook(({ cc }) => usePromesas(a, cc), { initialProps: { cc: "C1-1" } });
    await waitFor(() => expect(result.current.datos).not.toBeNull());

    let resultado!: Promise<boolean>;
    act(() => {
      resultado = result.current.registrar(BODY);
    });
    rerender({ cc: "C1-2" });
    await waitFor(() => expect(result.current.datos?.promesas[0].card_code).toBe("C1-2"));
    expect(result.current.enviando).toBe(false);
    const llamadas = obtener.mock.calls.length;

    await act(async () => {
      post.rechazar(new ApiError(400, { error: "Error del cliente anterior" }));
      await resultado;
    });
    expect(result.current.errorRegistrar).toBeNull();
    expect(result.current.datos?.promesas[0].card_code).toBe("C1-2");
    expect(obtener.mock.calls.length).toBe(llamadas);
  });
});
