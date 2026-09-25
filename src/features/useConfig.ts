import { useEffect, useState } from "react";
import { CONFIG_VACIA, type ConfigResponse } from "./features";

interface EstadoConfig {
  config: ConfigResponse;
  cargando: boolean;
}

export function useConfig(obtenerConfig: () => Promise<ConfigResponse>): EstadoConfig {
  const [estado, setEstado] = useState<EstadoConfig>({ config: CONFIG_VACIA, cargando: true });

  useEffect(() => {
    let cancelado = false;
    obtenerConfig()
      .then((config) => {
        if (!cancelado) setEstado({ config, cargando: false });
      })
      .catch(() => {
        // Nunca romper la app por esto: sin config, lo nuevo queda oculto.
        if (!cancelado) setEstado({ config: CONFIG_VACIA, cargando: false });
      });
    return () => {
      cancelado = true;
    };
  }, [obtenerConfig]);

  return estado;
}
