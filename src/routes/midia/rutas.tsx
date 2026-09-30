import { Navigate } from "react-router-dom";
import { useFeatures } from "../../features/FeaturesContext";
import { MiDiaPage } from "./MiDiaPage";

// Gating de Mi dia. La configuracion de funcionalidades llega despues del
// primer render: mientras carga no se decide nada (ni se monta la pantalla ni
// se redirige), para no mostrar un salto de pantalla ni disparar un fetch que
// la persona no puede usar.

// Ruta por defecto: Mi dia solo con el flag prendido; sin el, como siempre.
export function RutaInicial() {
  const { habilitada, cargando } = useFeatures();
  if (cargando) return null;
  return <Navigate to={habilitada("mi_dia") ? "/mi-dia" : "/cliente-360"} replace />;
}

export function RutaMiDia() {
  const { habilitada, cargando } = useFeatures();
  if (cargando) return null;
  if (!habilitada("mi_dia")) return <Navigate to="/cliente-360" replace />;
  return <MiDiaPage />;
}
