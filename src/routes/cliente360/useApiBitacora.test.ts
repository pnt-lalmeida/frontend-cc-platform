import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useApiBitacora } from "./useApiBitacora";

const apiFetch = vi.fn();
vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
vi.mock("../../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

describe("useApiBitacora — lecturas paginadas", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({});
  });

  it("el GET principal sin filtro no manda tipo; con filtro, sí", async () => {
    const { result } = renderHook(() => useApiBitacora());

    await result.current.fuentes.obtenerBitacora("C1-17453", "todo");
    await result.current.fuentes.obtenerBitacora("C1 X/1", "gestiones");

    expect(apiFetch.mock.calls[0][0]).toBe("/api/clientes/C1-17453/bitacora");
    expect(apiFetch.mock.calls[1][0]).toBe("/api/clientes/C1%20X%2F1/bitacora?tipo=gestiones");
    expect(apiFetch.mock.calls[1][1]).toEqual({ token: "token" });
  });

  it("los eventos van con tipo y, para 'Ver anteriores', con el cursor codificado", async () => {
    const { result } = renderHook(() => useApiBitacora());

    await result.current.fuentes.obtenerEventos("C1-17453", { tipo: "autorizaciones" });
    await result.current.fuentes.obtenerEventos("C1-17453", { tipo: "todo", antesDe: "2026-09-22T11:09:00+00:00" });

    expect(apiFetch.mock.calls[0][0]).toBe("/api/clientes/C1-17453/bitacora/eventos?tipo=autorizaciones");
    expect(apiFetch.mock.calls[1][0]).toBe(
      "/api/clientes/C1-17453/bitacora/eventos?antes_de=2026-09-22T11%3A09%3A00%2B00%3A00"
    );
    expect(apiFetch.mock.calls[1][1]).toEqual({ token: "token" });
  });
});
