import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDecisionMultiple } from "./useDecisionMultiple";

describe("useDecisionMultiple", () => {
  it("manda una sola request con todos los pedidos y el mismo motivo", async () => {
    const postDecisionMultiple = vi.fn().mockResolvedValue({
      resultados: [
        { docEntry: 1, docNum: 100, ok: true, sapStatus: "ejecutado", activityCode: 1, error: null },
        { docEntry: 2, docNum: 200, ok: true, sapStatus: "ejecutado", activityCode: 2, error: null },
      ],
    });
    const { result } = renderHook(() => useDecisionMultiple(postDecisionMultiple));

    await act(async () => {
      await result.current.decidirVarios({
        pedidos: [
          { docEntry: 1, cardCode: "C1-1", docNum: 100 },
          { docEntry: 2, cardCode: "C1-2", docNum: 200 },
        ],
        decision: "approved",
        motivo: "Estado de cuenta",
      });
    });

    expect(postDecisionMultiple).toHaveBeenCalledTimes(1);
    expect(postDecisionMultiple).toHaveBeenCalledWith({
      decision: "approved",
      motivo: "Estado de cuenta",
      pedidos: [
        { docEntry: 1, cardCode: "C1-1", docNum: 100 },
        { docEntry: 2, cardCode: "C1-2", docNum: 200 },
      ],
    });
  });

  it("al rechazar en bloque, nunca manda motivo", async () => {
    const postDecisionMultiple = vi.fn().mockResolvedValue({
      resultados: [{ docEntry: 1, docNum: 100, ok: true, sapStatus: "ejecutado", activityCode: 1, error: null }],
    });
    const { result } = renderHook(() => useDecisionMultiple(postDecisionMultiple));

    await act(async () => {
      await result.current.decidirVarios({
        pedidos: [{ docEntry: 1, cardCode: "C1-1", docNum: 100 }],
        decision: "rejected",
      });
    });

    const [body] = postDecisionMultiple.mock.calls[0];
    expect(body.motivo).toBeUndefined();
  });

  it("reporta un pedido fallido y otro exitoso segun la respuesta del backend", async () => {
    const postDecisionMultiple = vi.fn().mockResolvedValue({
      resultados: [
        { docEntry: 1, docNum: 100, ok: true, sapStatus: "ejecutado", activityCode: 1, error: null },
        { docEntry: 2, docNum: 200, ok: false, sapStatus: null, activityCode: null, error: "Usuario no autorizado" },
      ],
    });
    const { result } = renderHook(() => useDecisionMultiple(postDecisionMultiple));

    let resultados;
    await act(async () => {
      resultados = await result.current.decidirVarios({
        pedidos: [
          { docEntry: 1, cardCode: "C1-1", docNum: 100 },
          { docEntry: 2, cardCode: "C1-2", docNum: 200 },
        ],
        decision: "approved",
        motivo: "Emitir",
      });
    });

    expect(resultados).toEqual([
      { docEntry: 1, docNum: 100, ok: true, mensaje: undefined },
      { docEntry: 2, docNum: 200, ok: false, mensaje: "Usuario no autorizado" },
    ]);
    expect(result.current.resultados).toEqual(resultados);
  });

  it("si la request entera falla, reporta todos los pedidos como fallidos", async () => {
    const postDecisionMultiple = vi.fn().mockRejectedValue(new Error("fallo de red"));
    const { result } = renderHook(() => useDecisionMultiple(postDecisionMultiple));

    let resultados;
    await act(async () => {
      resultados = await result.current.decidirVarios({
        pedidos: [
          { docEntry: 1, cardCode: "C1-1", docNum: 100 },
          { docEntry: 2, cardCode: "C1-2", docNum: 200 },
        ],
        decision: "rejected",
      });
    });

    expect(resultados).toEqual([
      { docEntry: 1, docNum: 100, ok: false, mensaje: expect.any(String) },
      { docEntry: 2, docNum: 200, ok: false, mensaje: expect.any(String) },
    ]);
  });

  it("procesando es true durante la ejecucion y false al terminar", async () => {
    let resolver: (value: unknown) => void = () => {};
    const promesaControlada = new Promise((resolve) => {
      resolver = resolve;
    });
    const postDecisionMultiple = vi.fn().mockReturnValue(promesaControlada);
    const { result } = renderHook(() => useDecisionMultiple(postDecisionMultiple));

    let promesa!: Promise<unknown>;
    act(() => {
      promesa = result.current.decidirVarios({
        pedidos: [{ docEntry: 1, cardCode: "C1-1", docNum: 100 }],
        decision: "rejected",
      });
    });

    expect(result.current.procesando).toBe(true);

    await act(async () => {
      resolver({ resultados: [{ docEntry: 1, docNum: 100, ok: true, sapStatus: "ejecutado", activityCode: 1, error: null }] });
      await promesa;
    });

    expect(result.current.procesando).toBe(false);
  });

  it("limpiarResultados vacia los resultados", async () => {
    const postDecisionMultiple = vi.fn().mockResolvedValue({
      resultados: [{ docEntry: 1, docNum: 100, ok: true, sapStatus: "ejecutado", activityCode: 1, error: null }],
    });
    const { result } = renderHook(() => useDecisionMultiple(postDecisionMultiple));

    await act(async () => {
      await result.current.decidirVarios({
        pedidos: [{ docEntry: 1, cardCode: "C1-1", docNum: 100 }],
        decision: "rejected",
      });
    });
    expect(result.current.resultados).not.toBeNull();

    act(() => {
      result.current.limpiarResultados();
    });
    expect(result.current.resultados).toBeNull();
  });
});
