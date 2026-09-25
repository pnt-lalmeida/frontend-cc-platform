// Liberacion por etapas (25/09/2026): el backend resuelve que ve cada usuario
// (GET /api/config, shared/features.py). El frontend solo obedece - nunca
// decide por su cuenta si algo se muestra.

export type FeatureNombre =
  | "indicadores_pago"
  | "alertas"
  | "bitacora"
  | "promesas"
  | "mi_dia"
  | "riesgo_bloqueo";

export type EtapaFeature = "off" | "piloto" | "todos";

export interface EstadoFeature {
  habilitada: boolean;
  etapa: EtapaFeature;
}

export interface ConfigResponse {
  es_supervisor: boolean;
  features: Partial<Record<FeatureNombre, EstadoFeature>>;
}

// Si /api/config falla o todavia no cargo: todo lo nuevo oculto, nunca roto.
export const CONFIG_VACIA: ConfigResponse = { es_supervisor: false, features: {} };

export function estaHabilitada(config: ConfigResponse, nombre: FeatureNombre): boolean {
  return config.features[nombre]?.habilitada === true;
}

export function estaEnPiloto(config: ConfigResponse, nombre: FeatureNombre): boolean {
  const estado = config.features[nombre];
  return estado?.habilitada === true && estado.etapa === "piloto";
}
