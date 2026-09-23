import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDecisionMultiple } from "./useDecisionMultiple";

const RESPUESTA_OK = {
  doc_entry: 1, decision: "approved" as const, sap_status: "ejecutado" as const,
  activity_code: 1, timestamp: "x", adjunto_blob_path: null,
};

describe("useDecisionMultiple", () => {
  it("procesa cada pedido en secuencia, con el mismo motivo para todos", async () => {
    const postDecision = vi.fn().mockResolvedValue(RESPUESTA_OK);
    const { result } = renderHook(() => useDecisionMultiple(postDecision));

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

    expect(postDecision).toHaveBeenCalledTimes(2);
    expect(postDecision).toHaveBeenNthCalledWith(1, 1, { cardCode: "C1-1", docNum: 100, decision: "approved", motivo: "Estado de cuenta" });
    expect(postDecision).toHaveBeenNthCalledWith(2, 2, { cardCode: "C1-2", docNum: 200, decision: "approved", motivo: "Estado de cuenta" });
  });

  it("al rechazar en bloque, nunca manda motivo", async () => {
    const postDecision = vi.fn().mockResolvedValue(RESPUESTA_OK);
    const { result } = renderHook(() => useDecisionMultiple(postDecision));

    await act(async () => {
      await result.current.decidirVarios({
        pedidos: [{ docEntry: 1, cardCode: "C1-1", docNum: 100 }],
        decision: "rejected",
      });
    });

    const [, body] = postDecision.mock.calls[0];
    expect(body).toEqual({ cardCode: "C1-1", docNum: 100, decision: "rejected" });
  });

  it("un pedido que falla no frena al resto - se reportan todos los resultados", async () => {
    const postDecision = vi.fn()
      .mockResolvedValueOnce(RESPUESTA_OK)
      .mockRejectedValueOnce(new Error("fallo de red"))
      .mockResolvedValueOnce(RESPUESTA_OK);
    const { result } = renderHook(() => useDecisionMultiple(postDecision));

    let resultados;
    await act(async () => {
      resultados = await result.current.decidirVarios({
        pedidos: [
          { docEntry: 1, cardCode: "C1-1", docNum: 100 },
          { docEntry: 2, cardCode: "C1-2", docNum: 200 },
          { docEntry: 3, cardCode: "C1-3", docNum: 300 },
        ],
        decision: "approved",
        motivo: "Emitir",
      });
    });

    expect(postDecision).toHaveBeenCalledTimes(3);
    expect(resultados).toEqual([
      { docEntry: 1, docNum: 100, ok: true },
      { docEntry: 2, docNum: 200, ok: false, mensaje: expect.any(String) },
      { docEntry: 3, docNum: 300, ok: true },
    ]);
    expect(result.current.resultados).toEqual(resultados);
  });

  it("procesando es true durante la ejecucion y false al terminar", async () => {
    let resolver: (value: unknown) => void = () => {};
    const promesaControlada = new Promise((resolve) => {
      resolver = resolve;
    });
    const postDecision = vi.fn().mockReturnValue(promesaControlada);
    const { result } = renderHook(() => useDecisionMultiple(postDecision));

    let promesa!: Promise<unknown>;
    act(() => {
      promesa = result.current.decidirVarios({
        pedidos: [{ docEntry: 1, cardCode: "C1-1", docNum: 100 }],
        decision: "rejected",
      });
    });

    expect(result.current.procesando).toBe(true);
    expect(result.current.progreso).toEqual({ actual: 1, total: 1 });

    await act(async () => {
      resolver(RESPUESTA_OK);
      await promesa;
    });

    expect(result.current.procesando).toBe(false);
    expect(result.current.progreso).toBeNull();
  });

  it("limpiarResultados vacia los resultados", async () => {
    const postDecision = vi.fn().mockResolvedValue(RESPUESTA_OK);
    const { result } = renderHook(() => useDecisionMultiple(postDecision));

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
