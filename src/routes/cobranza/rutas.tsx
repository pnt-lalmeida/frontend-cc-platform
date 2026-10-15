import { Navigate } from "react-router-dom";
import { useFeatures } from "../../features/FeaturesContext";
import { CobranzaPage } from "./CobranzaPage";

// Gating de Cobranza programada: sin la funcionalidad la pantalla ni se monta
// (no hay ningun fetch) y se vuelve a donde se iba siempre. Mientras carga la
// configuracion no se decide nada, para no redirigir a quien si la tiene.
export function RutaCobranza() {
  const { habilitada, cargando } = useFeatures();
  if (cargando) return null;
  if (!habilitada("cobranza_programada")) return <Navigate to="/cliente-360" replace />;
  return <CobranzaPage />;
}
