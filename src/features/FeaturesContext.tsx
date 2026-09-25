import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { apiFetch } from "../api/client";
import { useAccessToken } from "../auth/useAccessToken";
import { CONFIG_VACIA, estaEnPiloto, estaHabilitada, type ConfigResponse, type FeatureNombre } from "./features";
import { useConfig } from "./useConfig";

interface ValorFeatures {
  habilitada: (nombre: FeatureNombre) => boolean;
  enPiloto: (nombre: FeatureNombre) => boolean;
  esSupervisor: boolean;
  cargando: boolean;
}

const FeaturesContext = createContext<ValorFeatures>({
  habilitada: (nombre) => estaHabilitada(CONFIG_VACIA, nombre),
  enPiloto: (nombre) => estaEnPiloto(CONFIG_VACIA, nombre),
  esSupervisor: false,
  cargando: true,
});

export function FeaturesProvider({ children }: { children: ReactNode }) {
  const getAccessToken = useAccessToken();
  const obtenerConfig = useCallback(async (): Promise<ConfigResponse> => {
    const token = await getAccessToken();
    return apiFetch<ConfigResponse>("/api/config", { token });
  }, [getAccessToken]);
  const { config, cargando } = useConfig(obtenerConfig);

  const valor = useMemo<ValorFeatures>(
    () => ({
      habilitada: (nombre) => estaHabilitada(config, nombre),
      enPiloto: (nombre) => estaEnPiloto(config, nombre),
      esSupervisor: config.es_supervisor,
      cargando,
    }),
    [config, cargando]
  );

  return <FeaturesContext.Provider value={valor}>{children}</FeaturesContext.Provider>;
}

export function useFeatures(): ValorFeatures {
  return useContext(FeaturesContext);
}
