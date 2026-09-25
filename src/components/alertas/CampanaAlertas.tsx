import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { Alerta, AlertasResponse } from "../../api/types";
import { useFeatures } from "../../features/FeaturesContext";
import { BadgePiloto } from "../BadgePiloto";
import { destinoDeAlerta, etiquetaTipoAlerta, haceCuanto, quienResolvio, textoBadge } from "./alertas";
import { useAccionesAlertas } from "./useAccionesAlertas";
import { useAlertas } from "./useAlertas";
import { useApiAlertas } from "./useApiAlertas";
import { useMediaQuery } from "./useMediaQuery";

// Mismo corte que el @media de tokens.css.
const MEDIA_CELULAR = "(max-width: 720px)";

const SELECTOR_ENFOCABLES =
  'button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

// Trampa de foco simple: Tab y Shift+Tab dan la vuelta dentro del panel, y si
// el foco quedo afuera, vuelve al panel.
function atraparFoco(e: KeyboardEvent, panel: HTMLElement) {
  const enfocables = Array.from(panel.querySelectorAll<HTMLElement>(SELECTOR_ENFOCABLES));
  if (enfocables.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const primero = enfocables[0];
  const ultimo = enfocables[enfocables.length - 1];
  const activo = document.activeElement;
  if (!panel.contains(activo)) {
    e.preventDefault();
    (e.shiftKey ? ultimo : primero).focus();
  } else if (e.shiftKey && (activo === primero || activo === panel)) {
    e.preventDefault();
    ultimo.focus();
  } else if (!e.shiftKey && activo === ultimo) {
    e.preventDefault();
    primero.focus();
  }
}

// Centro de alertas (Fase 2 CRM): campana en el header con la lista compartida
// del equipo. AppShell la monta solo si la funcionalidad "alertas" esta
// habilitada, asi sin ella no hay ningun fetch.
export function CampanaAlertas() {
  const { enPiloto } = useFeatures();
  const { obtenerAlertas, api } = useApiAlertas();
  const { datos, cargando, error, recargar } = useAlertas(obtenerAlertas);
  const acciones = useAccionesAlertas(api, recargar);
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();
  // En celular el panel es una hoja a pantalla completa (tokens.css): ahi es
  // modal y el Tab no se escapa a la pagina tapada. En escritorio no.
  const esHoja = useMediaQuery(MEDIA_CELULAR);

  const noVistas = datos?.no_vistas ?? 0;
  const badge = textoBadge(noVistas);

  function cerrar(devolverFoco = true) {
    setAbierto(false);
    if (devolverFoco) botonRef.current?.focus();
  }

  useEffect(() => {
    if (!abierto) return;
    panelRef.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
      if (e.key === "Tab" && esHoja && panelRef.current) atraparFoco(e, panelRef.current);
    };
    const alTocarAfuera = (e: MouseEvent | TouchEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) cerrar(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alTocarAfuera);
    document.addEventListener("touchstart", alTocarAfuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alTocarAfuera);
      document.removeEventListener("touchstart", alTocarAfuera);
    };
  }, [abierto, esHoja]);

  function ver(alerta: Alerta) {
    if (alerta.estado === "nueva") void acciones.marcarVista.ejecutar(alerta.id);
    const destino = destinoDeAlerta(alerta);
    cerrar(false);
    if (destino) navigate(destino);
  }

  return (
    <div ref={contenedorRef} style={{ position: "relative" }}>
      <button
        ref={botonRef}
        type="button"
        className="alertas-campana"
        aria-label={noVistas > 0 ? `Alertas: ${noVistas} nueva${noVistas === 1 ? "" : "s"}` : "Alertas: sin nuevas"}
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 38,
          height: 38,
          borderRadius: 8,
          border: "none",
          cursor: "pointer",
          background: abierto ? "var(--color-paper)" : "transparent",
          color: abierto || noVistas > 0 ? "var(--color-ink)" : "var(--color-muted)",
        }}
      >
        <IconoCampana />
        {badge && (
          <span
            data-testid="alertas-badge"
            aria-hidden="true"
            style={{
              position: "absolute",
              top: 3,
              right: badge.length > 1 ? -2 : 3,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              boxSizing: "border-box",
              borderRadius: 9,
              border: "2px solid var(--color-surface)",
              background: "var(--color-accent)",
              color: "#fff",
              fontSize: 10.5,
              fontWeight: 600,
              lineHeight: "14px",
              textAlign: "center",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {badge}
          </span>
        )}
      </button>

      {abierto && (
        <div
          ref={panelRef}
          id={idPanel}
          role="dialog"
          aria-label="Alertas"
          aria-modal={esHoja ? true : undefined}
          tabIndex={-1}
          className="alertas-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: -8,
            width: 408,
            maxHeight: "min(600px, calc(100vh - 96px))",
            display: "flex",
            flexDirection: "column",
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: 10,
            boxShadow: "0 16px 40px rgba(27, 31, 29, 0.16), 0 2px 6px rgba(27, 31, 29, 0.06)",
            outline: "none",
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          <PanelAlertas
            datos={datos}
            cargando={cargando}
            error={error}
            piloto={enPiloto("alertas")}
            acciones={acciones}
            onVer={ver}
            onCerrar={() => cerrar()}
          />
        </div>
      )}
    </div>
  );
}

function PanelAlertas({
  datos,
  cargando,
  error,
  piloto,
  acciones,
  onVer,
  onCerrar,
}: {
  datos: AlertasResponse | null;
  cargando: boolean;
  error: string | null;
  piloto: boolean;
  acciones: ReturnType<typeof useAccionesAlertas>;
  onVer: (alerta: Alerta) => void;
  onCerrar: () => void;
}) {
  const ahora = new Date();
  const abiertas = datos?.abiertas ?? [];
  const resueltas = datos?.resueltas_recientes ?? [];
  const noVistas = datos?.no_vistas ?? 0;
  const errorAccion = acciones.resolver.error ?? acciones.marcarVista.error ?? acciones.marcarTodas.error;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px 12px 18px",
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>Alertas</h2>
        {piloto && <BadgePiloto />}
        <div style={{ flex: 1 }} />
        {noVistas > 0 && (
          <button
            type="button"
            onClick={() => void acciones.marcarTodas.ejecutar()}
            disabled={acciones.marcarTodas.enviando}
            style={{ ...botonTextoStyle, color: "var(--color-accent)" }}
          >
            {acciones.marcarTodas.enviando ? "Marcando..." : "Marcar todas como vistas"}
          </button>
        )}
        <button type="button" className="alertas-cerrar-mobile" onClick={onCerrar} aria-label="Cerrar alertas" style={cerrarStyle}>
          ✕
        </button>
      </div>

      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        {errorAccion && <p style={{ ...avisoStyle, color: "var(--color-risk)" }}>{errorAccion}</p>}
        {error && datos && <p style={{ ...avisoStyle, color: "var(--color-caution)" }}>{error}</p>}

        {!datos ? (
          <p style={{ padding: "28px 18px", margin: 0, fontSize: 13, color: error ? "var(--color-risk)" : "var(--color-muted)" }}>
            {cargando ? "Cargando alertas..." : error}
          </p>
        ) : abiertas.length === 0 ? (
          <div style={{ padding: "30px 24px 26px", textAlign: "center" }}>
            <div style={{ color: "var(--color-line-strong)", display: "flex", justifyContent: "center", marginBottom: 10 }}>
              <IconoCampana tamano={26} />
            </div>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>No hay alertas abiertas.</p>
            <p style={{ margin: "4px auto 0", fontSize: 12.5, color: "var(--color-muted)", maxWidth: 260, lineHeight: 1.45 }}>
              Te avisamos acá cuando se bloquee un pedido nuevo.
            </p>
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {abiertas.map((alerta) => (
              <FilaAlerta
                key={alerta.id}
                alerta={alerta}
                ahora={ahora}
                resolviendo={acciones.resolver.enCursoIds.includes(alerta.id)}
                onVer={() => onVer(alerta)}
                onResolver={() => void acciones.resolver.ejecutar(alerta.id)}
              />
            ))}
          </ul>
        )}

        {resueltas.length > 0 && (
          <details className="alertas-resueltas" style={{ borderTop: "1px solid var(--color-line)" }}>
            <summary
              style={{
                padding: "11px 18px",
                fontSize: 12.5,
                fontWeight: 600,
                color: "var(--color-muted)",
                cursor: "pointer",
              }}
            >
              Resueltas recientemente ({resueltas.length})
            </summary>
            <ul style={{ listStyle: "none", margin: 0, padding: "0 0 6px" }}>
              {resueltas.map((alerta) => (
                <li key={alerta.id} style={{ padding: "8px 18px 8px 36px", fontSize: 12.5 }}>
                  <div style={{ color: "var(--color-muted)", lineHeight: 1.4 }}>{alerta.descripcion}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: "var(--color-muted)" }}>
                    {quienResolvio(alerta, datos?.equipo ?? [])}, {haceCuanto(alerta.resuelta_utc, ahora)}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <p
        style={{
          margin: 0,
          padding: "9px 18px",
          fontSize: 11.5,
          color: "var(--color-muted)",
          background: "var(--color-paper)",
          borderTop: "1px solid var(--color-line)",
        }}
      >
        La lista es del equipo: lo que marcás o resolvés lo ven todos.
      </p>
    </>
  );
}

function FilaAlerta({
  alerta,
  ahora,
  resolviendo,
  onVer,
  onResolver,
}: {
  alerta: Alerta;
  ahora: Date;
  resolviendo: boolean;
  onVer: () => void;
  onResolver: () => void;
}) {
  const nueva = alerta.estado === "nueva";
  const colorTipo = alerta.tipo === "pedido_reabierto" ? "var(--color-ok)" : "var(--color-risk)";
  return (
    <li
      data-estado={alerta.estado}
      style={{
        display: "grid",
        gridTemplateColumns: "22px 1fr",
        padding: "13px 18px 12px 0",
        paddingLeft: 0,
        borderBottom: "1px solid var(--color-line)",
        background: nueva ? "var(--color-accent-soft)" : undefined,
        opacity: resolviendo ? 0.55 : 1,
      }}
    >
      <span style={{ display: "flex", justifyContent: "flex-end", paddingTop: 5 }}>
        {nueva && (
          <span
            title="Nueva"
            style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-accent)", marginRight: 2 }}
          />
        )}
      </span>
      <div style={{ paddingLeft: 6, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: colorTipo }}>{etiquetaTipoAlerta(alerta.tipo)}</span>
          {nueva && <span className="sr-only">(nueva)</span>}
          <span style={{ flex: 1 }} />
          <time
            dateTime={alerta.fecha_utc}
            style={{ fontSize: 11.5, color: "var(--color-muted)", whiteSpace: "nowrap" }}
          >
            {haceCuanto(alerta.fecha_utc, ahora)}
          </time>
        </div>
        <div
          style={{
            marginTop: 3,
            fontSize: 13,
            lineHeight: 1.45,
            color: "var(--color-ink)",
            fontWeight: nueva ? 500 : 400,
            overflowWrap: "anywhere",
          }}
        >
          {alerta.descripcion}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
          {destinoDeAlerta(alerta) && (
            <button type="button" className="alertas-accion" onClick={onVer} style={botonVerStyle}>
              Ver pedido
            </button>
          )}
          <button
            type="button"
            className="alertas-accion"
            onClick={onResolver}
            disabled={resolviendo}
            style={{ ...botonTextoStyle, padding: "5px 8px", color: "var(--color-muted)" }}
          >
            {resolviendo ? "Resolviendo..." : "Resolver"}
          </button>
        </div>
      </div>
    </li>
  );
}

function IconoCampana({ tamano = 20 }: { tamano?: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}

const botonTextoStyle: CSSProperties = {
  background: "none",
  border: "none",
  padding: "4px 6px",
  borderRadius: 6,
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const botonVerStyle: CSSProperties = {
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 6,
  border: "1px solid var(--color-line-strong)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  cursor: "pointer",
};

const cerrarStyle: CSSProperties = {
  ...botonTextoStyle,
  fontSize: 15,
  width: 36,
  height: 36,
  color: "var(--color-muted)",
};

const avisoStyle: CSSProperties = {
  margin: 0,
  padding: "9px 18px",
  fontSize: 12.5,
  borderBottom: "1px solid var(--color-line)",
};
