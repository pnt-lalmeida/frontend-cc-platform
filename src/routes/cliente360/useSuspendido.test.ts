import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSuspendido } from "./useSuspendido";

describe("useSuspendido", () => {
  it("llama a patchSuspendido con el nuevo valor", async () => {
    const patchSuspendido = vi.fn().mockResolvedValue({ card_code: "C1-90020", suspendido: true });
    const { result } = renderHook(() => useSuspendido(patchSuspendido));

    await act(async () => {
      await result.current.actualizar(true);
    });

    expect(patchSuspendido).toHaveBeenCalledWith(true);
  });

  it("no asume exito antes de que la promesa resuelva - enviando es true durante la request", async () => {
    let resolver: (value: unknown) => void = () => {};
    const promesaControlada = new Promise((resolve) => {
      resolver = resolve;
    });
    const patchSuspendido = vi.fn().mockReturnValue(promesaControlada);
    const { result } = renderHook(() => useSuspendido(patchSuspendido));

    let promesaActualizar!: Promise<unknown>;
    act(() => {
      promesaActualizar = result.current.actualizar(true);
    });

    expect(result.current.enviando).toBe(true);

    await act(async () => {
      resolver({ card_code: "C1-90020", suspendido: true });
      await promesaActualizar;
    });

    expect(result.current.enviando).toBe(false);
  });

  it("si patchSuspendido falla (ej. flag apagado), expone un error y enviando vuelve a false", async () => {
    const patchSuspendido = vi.fn().mockRejectedValue(new Error("fallo de red"));
    const { result } = renderHook(() => useSuspendido(patchSuspendido));

    await act(async () => {
      await result.current.actualizar(true);
    });

    expect(result.current.enviando).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
