import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./client";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("agrega el header Authorization con el bearer token", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    await apiFetch("/api/health", { token: "abc123" });

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer abc123");
  });

  it("arma la URL uniendo VITE_API_BASE_URL con el path", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch("/api/health", { token: "x" });

    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain("/api/health");
  });

  it("lanza ApiError con status y body cuando la respuesta no es 2xx", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: "Falta el header Authorization Bearer" }),
    });

    await expect(apiFetch("/api/clientes", { token: "x" })).rejects.toMatchObject({
      status: 401,
      body: { error: "Falta el header Authorization Bearer" },
    });
    await expect(apiFetch("/api/clientes", { token: "x" })).rejects.toBeInstanceOf(ApiError);
  });

  it("manda Content-Type y el body en JSON solo cuando se pasa un body", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch("/api/bandeja/pedidos/900011/decision", {
      token: "x",
      method: "POST",
      body: { decision: "approved" },
    });

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ decision: "approved" }));
  });

  it("un GET sin body no manda Content-Type ni body", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    await apiFetch("/api/health", { token: "x" });

    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it("nunca reintenta automaticamente ante un error", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: "Error de SAP" }),
    });

    await expect(apiFetch("/api/health", { token: "x" })).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
