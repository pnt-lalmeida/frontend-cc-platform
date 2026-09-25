import { BadgePiloto } from "../../components/BadgePiloto";
import type { StatusTagVariant } from "../../components/StatusTag";
import { lineaBandeja } from "../cliente360/indicadoresPago";
import { useIndicadoresPago } from "../cliente360/useIndicadoresPago";
import { useObtenerIndicadores } from "../cliente360/useObtenerIndicadores";

const COLOR_TENDENCIA: Record<StatusTagVariant, string> = {
  ok: "var(--color-ok)",
  caution: "var(--color-caution)",
  risk: "var(--color-risk)",
  neutral: "var(--color-muted)",
};

// Contexto para decidir, nunca un bloqueo: si falla o no hay historial queda
// un texto gris y la decision sigue igual. Se monta solo con la funcionalidad
// "indicadores_pago" habilitada.
export function LineaIndicadoresPago({ cardCode, enPiloto }: { cardCode: string; enPiloto: boolean }) {
  const obtenerIndicadores = useObtenerIndicadores();
  const { datos, error } = useIndicadoresPago(obtenerIndicadores, cardCode, 6);

  let contenido;
  if (error) {
    contenido = <span>Comportamiento de pago no disponible</span>;
  } else if (!datos) {
    contenido = <span>Cargando comportamiento de pago...</span>;
  } else {
    const linea = lineaBandeja(datos);
    contenido = (
      <span title={datos.historial_suficiente ? `${linea.completo} (últimos 6 meses)` : undefined}>
        {linea.texto}
        {linea.tendencia && (
          <>
            {" · "}
            <span style={{ color: COLOR_TENDENCIA[linea.tendencia.variant], fontWeight: 600 }}>
              {linea.tendencia.texto}
            </span>
          </>
        )}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        fontSize: 12.5,
        color: "var(--color-muted)",
        marginTop: -8,
        marginBottom: 20,
        minHeight: 19,
      }}
    >
      {contenido}
      {enPiloto && <BadgePiloto />}
    </div>
  );
}
