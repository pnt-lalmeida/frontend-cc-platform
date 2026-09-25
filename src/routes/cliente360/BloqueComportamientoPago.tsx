import { useState, type ReactNode } from "react";
import { BadgePiloto } from "../../components/BadgePiloto";
import { StatusTag } from "../../components/StatusTag";
import {
  describirAtraso,
  formatearDias,
  tagTendencia,
  textoAtrasoAnterior,
  textoFacturasConsideradas,
  textoHistorialInsuficiente,
} from "./indicadoresPago";
import { useIndicadoresPago, type VentanaMeses } from "./useIndicadoresPago";
import { useObtenerIndicadores } from "./useObtenerIndicadores";

const VENTANAS: VentanaMeses[] = [6, 12];

// Se monta solo si la funcionalidad "indicadores_pago" esta habilitada: el
// gating vive en quien lo usa, asi sin habilitar no hay ni fetch.
export function BloqueComportamientoPago({ cardCode, enPiloto }: { cardCode: string; enPiloto: boolean }) {
  const [ventana, setVentana] = useState<VentanaMeses>(6);
  const obtenerIndicadores = useObtenerIndicadores();
  const { datos, loading, error } = useIndicadoresPago(obtenerIndicadores, cardCode, ventana);

  let contenido: ReactNode;
  if (error) {
    contenido = <p style={{ color: "var(--color-risk)", fontSize: 12.5, margin: 0 }}>{error}</p>;
  } else if (!datos) {
    contenido = <p style={{ color: "var(--color-muted)", fontSize: 12.5, margin: 0 }}>Cargando indicadores...</p>;
  } else if (!datos.historial_suficiente) {
    contenido = (
      <>
        <p style={{ color: "var(--color-muted)", margin: 0 }}>
          Sin historial suficiente para calcular indicadores (pocas facturas saldadas).
        </p>
        <p style={{ fontSize: 11.5, color: "#8A9490", margin: "6px 0 0" }}>
          {textoHistorialInsuficiente(datos.facturas_consideradas, datos.minimo_facturas, datos.ventana_meses)}
        </p>
      </>
    );
  } else {
    const atraso = describirAtraso(datos.dias_atraso);
    const tendencia = tagTendencia(datos.tendencia);
    contenido = (
      <>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 16,
            opacity: loading ? 0.55 : 1,
            transition: "opacity 120ms",
          }}
        >
          <Indicador
            etiqueta="Días para cobrar"
            valor={formatearDias(datos.dias_para_cobrar)}
            detalle="promedio desde la emisión"
          />
          <Indicador etiqueta="Atraso promedio" valor={atraso.valor} detalle={atraso.detalle}>
            {tendencia && (
              <div style={{ marginTop: 8 }}>
                <StatusTag variant={tendencia.variant}>{tendencia.texto}</StatusTag>
                {datos.anterior && (
                  <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 6 }}>
                    {textoAtrasoAnterior(datos.anterior.dias_atraso)}
                  </div>
                )}
              </div>
            )}
          </Indicador>
        </div>
        <p
          style={{ fontSize: 11.5, color: "#8A9490", margin: "12px 0 0" }}
          title="Promedios ponderados por importe. La tendencia compara el atraso con el período anterior de igual largo."
        >
          {textoFacturasConsideradas(datos.facturas_consideradas, datos.ventana_meses)}
          {tendencia ? `, comparado con los ${datos.ventana_meses} meses anteriores` : ""}
        </p>
      </>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0, fontWeight: 500 }}>Comportamiento de pago</p>
          {enPiloto && <BadgePiloto />}
        </div>
        <div role="group" aria-label="Período de cálculo" style={{ display: "flex" }}>
          {VENTANAS.map((v, i) => {
            const activa = v === ventana;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={activa}
                onClick={() => setVentana(v)}
                style={{
                  padding: "3px 10px",
                  fontSize: 12,
                  fontWeight: activa ? 600 : 500,
                  border: `1px solid ${activa ? "var(--color-accent)" : "var(--color-line)"}`,
                  marginLeft: i === 0 ? 0 : -1,
                  borderRadius: i === 0 ? "6px 0 0 6px" : "0 6px 6px 0",
                  background: activa ? "var(--color-accent)" : "var(--color-surface)",
                  color: activa ? "#fff" : "var(--color-muted)",
                  cursor: "pointer",
                  position: "relative",
                  zIndex: activa ? 1 : 0,
                }}
              >
                {v} meses
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, padding: "14px 16px" }}>{contenido}</div>
    </div>
  );
}

function Indicador({
  etiqueta,
  valor,
  detalle,
  children,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 4 }}>{etiqueta}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 21, fontWeight: 500, whiteSpace: "nowrap" }}>{valor}</div>
      <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>{detalle}</div>
      {children}
    </div>
  );
}
