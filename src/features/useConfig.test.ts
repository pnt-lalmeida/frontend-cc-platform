import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CONFIG_VACIA, type ConfigResponse } from "./features";
import { useConfig } from "./useConfig";

describe("useConfig", () => {
  it("arranca oculto y cargando, despues trae la config del backend", async () => {
    const config: ConfigResponse = {
      es_supervisor: true,
      features: { bitacora: { habilitada: true, etapa: "piloto" } },
    };
    const obtener = vi.fn().mockResolvedValue(config);
    const { result } = renderHook(() => useConfig(obtener));

    expect(result.current).toEqual({ config: CONFIG_VACIA, cargando: true });
    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.config).toEqual(config);
  });

  it("si falla, deja todo oculto sin romper", async () => {
    const obtener = vi.fn().mockRejectedValue(new Error("500"));
    const { result } = renderHook(() => useConfig(obtener));

    await waitFor(() => expect(result.current.cargando).toBe(false));
    expect(result.current.config).toEqual(CONFIG_VACIA);
  });
});
