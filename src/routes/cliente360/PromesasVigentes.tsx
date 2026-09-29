import type { CSSProperties } from "react";
import type { MiembroEquipo } from "../../api/types";
import { BadgePiloto } from "../../components/BadgePiloto";
import { StatusTag } from "../../components/StatusTag";
import { formatDate, formatMoney } from "../../design/format";
import {
  diasHastaVencimiento,
  etiquetaEstadoPromesa,
  fraseVencimiento,
  textoRegistrada,
  varianteEstadoPromesa,
  vigentesOrdenadas,
} from "./promesas";
import type { EstadoPromesas } from "./usePromesas";

// Promesas de pago vigentes (Fase 4 CRM), arriba de la Bitacora en la pestaña
// "Actividad". Solo lo pendiente: el historial (cumplidas, incumplidas) ya
// aparece solo en la linea de tiempo, porque el backend escribe un evento cada
// vez que verifica una promesa. Una lista completa duplicaria eso.
//
// Se monta solo con la funcionalidad "promesas" habilitada: el gating vive en
// quien lo monta (BitacoraActividad), asi sin habilitar no hay fetch.

const ETIQUETA: CSSProperties = { fontSize: 12, color: "var(--color-muted)", margin: 0, fontWeight: 500 };
const MENOR: CSSProperties = { fontSize: 12.5, color: "var(--color-muted)", margin: 0, overflowWrap: "anywhere" };

interface Props {
  estado: EstadoPromesas;
  equipo: MiembroEquipo[];
  // YYYY-MM-DD de Montevideo; se recibe por parametro para poder probarlo.
  hoy: string;
  enPiloto: boolean;
}

export function PromesasVigentes({ estado, equipo, hoy, enPiloto }: Props) {
  const { datos, cargando, error, recargar } = estado;
  const vigentes = datos ? vigentesOrdenadas(datos.promesas) : [];

  let cuerpo;
  if (!datos && error) {
    cuerpo = (
      <div role="alert" style={{ padding: "12px 16px", fontSize: 13 }}>
        <p style={{ margin: 0, color: "var(--color-risk)" }}>{error}</p>
        <button type="button" className="promesas-boton-texto" onClick={() => void recargar()}>
          Reintentar
        </button>
      </div>
    );
  } else if (!datos) {
    // Ocupa el mismo lugar que el estado vacio (el caso mas comun): la
    // pantalla no salta cuando llegan los datos.
    cuerpo = (
      <p style={{ margin: 0, padding: "12px 16px", fontSize: 13, color: "var(--color-muted)", minHeight: 20 }}>
        Cargando promesas...
      </p>
    );
  } else if (vigentes.length === 0) {
    cuerpo = (
      <p style={{ margin: 0, padding: "12px 16px", fontSize: 13, color: "var(--color-muted)", minHeight: 20 }}>
        Sin promesas de pago vigentes. Registrá una desde Registrar cuando el cliente se comprometa a pagar.
      </p>
    );
  } else {
    cuerpo = (
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {vigentes.map((p, i) => {
          const frase = fraseVencimiento(p.fecha_prometida, hoy);
          // Hoy o ya vencida: la que hay que mirar primero.
          const urgente = frase !== null && diasHastaVencimiento(p.fecha_prometida, hoy) <= 0;
          const contexto = [p.facturas ? `Facturas: ${p.facturas}` : null, p.canal ? `Por ${p.canal}` : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                columnGap: 14,
                rowGap: 3,
                padding: "11px 16px",
                borderTop: i === 0 ? "none" : "1px solid var(--color-line)",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: urgente ? "var(--color-caution)" : "var(--color-ink)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <span>{frase ? capitalizar(frase) : "Fecha no disponible"}</span>
                  {p.estado === "vencida_a_verificar" && (
                    <StatusTag variant={varianteEstadoPromesa(p.estado)}>{etiquetaEstadoPromesa(p.estado)}</StatusTag>
                  )}
                </p>
                <p style={{ ...MENOR, marginTop: 2 }}>
                  <time dateTime={p.fecha_prometida}>{formatDate(p.fecha_prometida)}</time>
                </p>
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  textAlign: "right",
                }}
              >
                {formatMoney(p.importe, p.moneda)}
              </div>
              {contexto && <p style={{ ...MENOR, gridColumn: "1 / -1" }}>{contexto}</p>}
              <p style={{ ...MENOR, fontSize: 11.5, gridColumn: "1 / -1" }}>{textoRegistrada(p, equipo)}</p>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section aria-labelledby="promesas-titulo" aria-busy={cargando && !datos} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <h3 id="promesas-titulo" style={{ ...ETIQUETA }}>
          Promesas de pago
        </h3>
        {enPiloto && <BadgePiloto />}
        {cargando && datos && <span className="spinner" role="status" aria-label="Actualizando" style={{ color: "var(--color-muted)" }} />}
      </div>
      <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, background: "var(--color-surface)", overflow: "hidden" }}>
        {cuerpo}
        {datos && error && (
          <div
            role="alert"
            style={{ borderTop: "1px solid var(--color-line)", padding: "8px 16px", fontSize: 12.5, background: "var(--color-paper)" }}
          >
            <span style={{ color: "var(--color-risk)" }}>{error}</span>{" "}
            <button type="button" className="promesas-boton-texto" onClick={() => void recargar()}>
              Reintentar
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
