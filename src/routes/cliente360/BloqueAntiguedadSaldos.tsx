import { useId, useMemo, useState, type ReactNode } from "react";
import type { EstadoCuentaFila, PagadorCentral } from "../../api/types";
import { BadgePiloto } from "../../components/BadgePiloto";
import { formatMoney, formatMoneyEntero } from "../../design/format";
import { hoyUruguay } from "../../utils/fechas";
import { TRAMOS, TRAMOS_MAYOR_61, calcularAntiguedad, type AntiguedadMoneda } from "./antiguedad";

// Antiguedad de saldos (Fase B CRM) en el Resumen de Cliente 360. Se monta solo
// con la funcionalidad "antiguedad_saldos". Usa las filas del Estado de cuenta
// que la pagina ya carga: no hay fetch propio. La cifra que sigue el equipo es
// "Más de 61 días": va arriba y grande; los tres tramos que la forman quedan
// marcados con una barra a la izquierda.
//
// Por defecto se ve UNA LINEA POR MONEDA (total + lo que importa: lo de más de
// 61 días, o lo vencido, o "Al día"), sin enumerar ceros. "Ver detalle" abre las
// tarjetas con los cinco tramos y "A vencer". Un solo control para todo el
// bloque, mismo patron que "Ver más" de Comentarios (aria-expanded/aria-controls).
export function BloqueAntiguedadSaldos({
  filas,
  pagadorCentral,
  loading,
  error,
  enPiloto,
  hoy,
}: {
  filas: EstadoCuentaFila[];
  pagadorCentral: PagadorCentral | null;
  loading: boolean;
  error: string | null;
  enPiloto: boolean;
  hoy?: string;
}) {
  const idDetalle = useId();
  const [expandido, setExpandido] = useState(false);
  const monedas = useMemo(() => calcularAntiguedad(filas, hoy ?? hoyUruguay()), [filas, hoy]);

  let contenido: ReactNode;
  if (error) {
    contenido = <Marco><p style={{ color: "var(--color-risk)", fontSize: 12.5, margin: 0 }}>{error}</p></Marco>;
  } else if (loading) {
    contenido = <Marco><p style={{ color: "var(--color-muted)", fontSize: 12.5, margin: 0 }}>Cargando estado de cuenta...</p></Marco>;
  } else if (monedas.length === 0) {
    contenido = <Marco><p style={{ color: "var(--color-muted)", margin: 0 }}>Sin saldos abiertos.</p></Marco>;
  } else {
    contenido = (
      <div style={{ display: "grid", gap: 6 }}>
        <div id={idDetalle}>
          {expandido ? (
            <div style={{ display: "grid", gap: 10 }}>
              {monedas.map((m) => (
                <TarjetaMoneda key={m.moneda ?? "—"} antiguedad={m} />
              ))}
              {/* Los tramos se muestran sin centavos: pueden no sumar exacto el total
                  (que se calcula con centavos). El title de cada monto tiene el exacto. */}
              <p
                style={{ fontSize: 11.5, color: "#8A9490", margin: 0 }}
                title="Cada monto muestra el valor exacto al pasar el mouse."
              >
                {monedas.length > 1 ? "Cada moneda por separado: nunca se suman. " : ""}
                Montos redondeados, sin centavos.
              </p>
            </div>
          ) : (
            <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, padding: "0 14px" }}>
              {monedas.map((m, i) => (
                <LineaMoneda key={m.moneda ?? "—"} antiguedad={m} primera={i === 0} />
              ))}
            </div>
          )}
        </div>
        <div>
          <button
            type="button"
            className="c360-comentarios-toggle"
            style={{ marginTop: 0 }}
            aria-expanded={expandido}
            aria-controls={idDetalle}
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? "Ver menos" : "Ver detalle por tramos"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <p style={{ fontSize: 12, color: "var(--color-muted)", margin: 0, fontWeight: 500 }}>Antigüedad de saldos</p>
        {enPiloto && <BadgePiloto />}
      </div>
      {!loading && !error && pagadorCentral && (
        <p
          style={{
            margin: "0 0 10px",
            padding: "8px 12px",
            background: "var(--color-accent-soft)",
            borderRadius: 8,
            fontSize: 12,
            color: "var(--color-accent-ink)",
          }}
        >
          Consolidado del pagador central{" "}
          <span style={{ fontFamily: "var(--font-mono)" }}>{pagadorCentral.card_code}</span>
          {pagadorCentral.card_name ? ` (${pagadorCentral.card_name})` : ""}.
        </p>
      )}
      {contenido}
    </div>
  );
}

function Marco({ children }: { children: ReactNode }) {
  return <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, padding: "14px 16px" }}>{children}</div>;
}

// Vista compacta de una moneda. Lo primero que se lee es lo que el equipo sigue:
// deuda de más de 61 días (riesgo) > vencido > "Al día". Nunca enumera ceros.
function LineaMoneda({ antiguedad: m, primera }: { antiguedad: AntiguedadMoneda; primera: boolean }) {
  const clave = m.moneda ?? "sin-moneda";
  const vencido = Math.round((m.d0_30 + m.d31_60 + m.mayor_61) * 100) / 100;

  let estado: ReactNode;
  if (m.mayor_61 > 0) {
    estado = (
      <span
        data-testid={`mayor-61-compacto-${clave}`}
        title={formatMoney(m.mayor_61, m.moneda)}
        style={{ color: "var(--color-risk)", fontWeight: 600 }}
      >
        <span style={{ fontFamily: "var(--font-mono)" }}>{formatMoneyEntero(m.mayor_61, m.moneda)}</span> más de 61 días
      </span>
    );
  } else if (vencido > 0) {
    estado = (
      <span title={formatMoney(vencido, m.moneda)} style={{ color: "var(--color-caution)", fontWeight: 600 }}>
        <span style={{ fontFamily: "var(--font-mono)" }}>{formatMoneyEntero(vencido, m.moneda)}</span> vencido
      </span>
    );
  } else {
    estado = <span style={{ color: "var(--color-ok)", fontWeight: 600 }}>Al día</span>;
  }

  return (
    <div
      data-testid={`resumen-${clave}`}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: "2px 16px",
        padding: "10px 0",
        borderTop: primera ? "none" : "1px solid var(--color-line)",
        fontSize: 13.5,
      }}
    >
      <span title={formatMoney(m.total, m.moneda)} style={{ whiteSpace: "nowrap" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500 }}>
          {formatMoneyEntero(m.total, m.moneda)}
        </span>{" "}
        <span style={{ color: "var(--color-muted)" }}>total</span>
      </span>
      {estado}
    </div>
  );
}

function TarjetaMoneda({ antiguedad: m }: { antiguedad: AntiguedadMoneda }) {
  const hayMayor61 = m.mayor_61 > 0;
  const clave = m.moneda ?? "sin-moneda";
  const comunes = TRAMOS.filter((t) => !TRAMOS_MAYOR_61.includes(t.key));
  const mayores = TRAMOS.filter((t) => TRAMOS_MAYOR_61.includes(t.key));

  return (
    <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, padding: "14px 16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 4 }}>Más de 61 días</div>
          <div
            data-testid={`mayor-61-${clave}`}
            title={formatMoney(m.mayor_61, m.moneda)}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 24,
              fontWeight: 500,
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              color: hayMayor61 ? "var(--color-risk)" : "var(--color-muted)",
            }}
          >
            {formatMoneyEntero(m.mayor_61, m.moneda)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 4 }}>Total</div>
          <div
            title={formatMoney(m.total, m.moneda)}
            style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 500, whiteSpace: "nowrap" }}
          >
            {formatMoneyEntero(m.total, m.moneda)}
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--color-line)", paddingTop: 8 }}>
        {comunes.map((t) => (
          <FilaTramo key={t.key} etiqueta={t.label} valor={m[t.key]} moneda={m.moneda} />
        ))}
        <div
          aria-label="Tramos de más de 61 días"
          role="group"
          style={{
            borderLeft: `2px solid ${hayMayor61 ? "var(--color-risk)" : "var(--color-line)"}`,
            marginLeft: -12,
            paddingLeft: 10,
            marginTop: 2,
          }}
        >
          {mayores.map((t) => (
            <FilaTramo key={t.key} etiqueta={t.label} valor={m[t.key]} moneda={m.moneda} riesgo />
          ))}
        </div>
      </div>
    </div>
  );
}

function FilaTramo({
  etiqueta,
  valor,
  moneda,
  riesgo,
}: {
  etiqueta: string;
  valor: number;
  moneda: string | null;
  riesgo?: boolean;
}) {
  const color = valor === 0 ? "#8A9490" : riesgo && valor > 0 ? "var(--color-risk)" : "var(--color-ink)";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        padding: "4px 0",
        fontSize: 13,
      }}
    >
      <span style={{ color: valor === 0 ? "#8A9490" : "var(--color-muted)" }}>{etiqueta}</span>
      <span title={formatMoney(valor, moneda)} style={{ fontFamily: "var(--font-mono)", color, whiteSpace: "nowrap" }}>
        {formatMoneyEntero(valor, moneda)}
      </span>
    </div>
  );
}
