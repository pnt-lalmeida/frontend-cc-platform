import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useDecision } from "./useDecision";

describe("useDecision", () => {
  it("no llama a postDecision si se aprueba sin elegir una opcion", async () => {
    const postDecision = vi.fn();
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({ docEntry: 1, cardCode: "C1-1", docNum: 1, decision: "approved" });
    });

    expect(postDecision).not.toHaveBeenCalled();
    expect(result.current.error).toBeTruthy();
  });

  it("al aprobar, manda exactamente cardCode/docNum/decision/motivo", async () => {
    const postDecision = vi.fn().mockResolvedValue({
      doc_entry: 900011, decision: "approved", sap_status: "no_ejecutado", activity_code: null, timestamp: "x",
      adjunto_blob_path: null,
    });
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({
        docEntry: 900011, cardCode: "C1-90011", docNum: 700011,
        decision: "approved", motivo: "Estado de cuenta",
      });
    });

    expect(postDecision).toHaveBeenCalledWith(900011, {
      cardCode: "C1-90011", docNum: 700011, decision: "approved", motivo: "Estado de cuenta",
    });
  });

  it("al aprobar con 'Estado de cuenta/carta' y un adjunto, lo incluye en el body", async () => {
    const postDecision = vi.fn().mockResolvedValue({
      doc_entry: 900011, decision: "approved", sap_status: "no_ejecutado", activity_code: null,
      timestamp: "x", adjunto_blob_path: "900011/x_carta.pdf",
    });
    const { result } = renderHook(() => useDecision(postDecision));
    const adjunto = { nombreArchivo: "carta.pdf", contenidoBase64: "AAAA", contentType: "application/pdf" };

    await act(async () => {
      await result.current.decidir({
        docEntry: 900011, cardCode: "C1-90011", docNum: 700011,
        decision: "approved", motivo: "Estado de cuenta/carta", adjunto,
      });
    });

    expect(postDecision).toHaveBeenCalledWith(900011, {
      cardCode: "C1-90011", docNum: 700011, decision: "approved",
      motivo: "Estado de cuenta/carta", adjunto,
    });
  });

  it("al aprobar con otro motivo, nunca manda adjunto aunque se pase uno", async () => {
    const postDecision = vi.fn().mockResolvedValue({
      doc_entry: 900011, decision: "approved", sap_status: "no_ejecutado", activity_code: null,
      timestamp: "x", adjunto_blob_path: null,
    });
    const { result } = renderHook(() => useDecision(postDecision));
    const adjunto = { nombreArchivo: "carta.pdf", contenidoBase64: "AAAA", contentType: "application/pdf" };

    await act(async () => {
      await result.current.decidir({
        docEntry: 900011, cardCode: "C1-90011", docNum: 700011,
        decision: "approved", motivo: "Estado de cuenta", adjunto,
      });
    });

    const [, body] = postDecision.mock.calls[0];
    expect(body).not.toHaveProperty("adjunto");
  });

  it("al rechazar, nunca manda motivo", async () => {
    const postDecision = vi.fn().mockResolvedValue({
      doc_entry: 900011, decision: "rejected", sap_status: "no_ejecutado", activity_code: null, timestamp: "x",
      adjunto_blob_path: null,
    });
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({ docEntry: 900011, cardCode: "C1-90011", docNum: 700011, decision: "rejected" });
    });

    const [, body] = postDecision.mock.calls[0];
    expect(body).toEqual({ cardCode: "C1-90011", docNum: 700011, decision: "rejected" });
    expect(body).not.toHaveProperty("motivo");
  });

  it("no asume exito antes de que la promesa resuelva - enviando es true durante la request", async () => {
    let resolver: (value: unknown) => void = () => {};
    const promesaControlada = new Promise((resolve) => {
      resolver = resolve;
    });
    const postDecision = vi.fn().mockReturnValue(promesaControlada);
    const { result } = renderHook(() => useDecision(postDecision));

    let promesaDecidir!: Promise<unknown>;
    act(() => {
      promesaDecidir = result.current.decidir({
        docEntry: 1, cardCode: "C1-1", docNum: 1, decision: "rejected",
      });
    });

    expect(result.current.enviando).toBe(true);

    await act(async () => {
      resolver({
        doc_entry: 1, decision: "rejected", sap_status: "no_ejecutado", activity_code: null, timestamp: "x",
        adjunto_blob_path: null,
      });
      await promesaDecidir;
    });

    expect(result.current.enviando).toBe(false);
  });

  it("si postDecision falla, expone un error y enviando vuelve a false", async () => {
    const postDecision = vi.fn().mockRejectedValue(new Error("fallo de red"));
    const { result } = renderHook(() => useDecision(postDecision));

    await act(async () => {
      await result.current.decidir({ docEntry: 1, cardCode: "C1-1", docNum: 1, decision: "rejected" });
    });

    expect(result.current.enviando).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
