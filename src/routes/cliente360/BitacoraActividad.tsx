import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { BitacoraResponse, EventoBitacora, MiembroEquipo, TareaBitacora } from "../../api/types";
import { BadgePiloto } from "../../components/BadgePiloto";
import { formatDate, formatDateTime } from "../../design/format";
import {
  MAX_DESCRIPCION,
  MAX_NOTA,
  agruparEventosPorDia,
  armarGestionRequest,
  armarRecordatorioRequest,
  clasificarTareas,
  describirVencimiento,
  esAutomatico,
  etiquetaEvento,
  fechaLocalISO,
  hayErrores,
  horaLocal,
  nombreDeUsuario,
  responsablePorDefecto,
  sumarDias,
  validarGestion,
  validarRecordatorio,
  type Errores,
  type FormGestion,
  type FormRecordatorio,
} from "./bitacora";
import { useAccionesBitacora } from "./useAccionesBitacora";
import { useApiBitacora } from "./useApiBitacora";
import { useBitacora } from "./useBitacora";

// Fase 3 CRM (25/09/2026): pestaña "Actividad" de Cliente 360. Se monta solo
// si la funcionalidad "bitacora" esta habilitada: sin habilitar no hay fetch.

const ETIQUETA: CSSProperties = { fontSize: 12, color: "var(--color-muted)", margin: 0, fontWeight: 500 };
const AYUDA: CSSProperties = { fontSize: 11.5, color: "#8A9490" };
const ERROR: CSSProperties = { color: "var(--color-risk)", fontSize: 12.5, margin: "6px 0 0" };
const CAMPO: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  border: "1px solid var(--color-line-strong)",
  borderRadius: 6,
  fontSize: 13.5,
  fontFamily: "inherit",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
};

export function BitacoraActividad({
  cardCode,
  enPiloto,
  usuarioActual,
}: {
  cardCode: string;
  enPiloto: boolean;
  usuarioActual: string | null;
}) {
  const { obtenerBitacora, api } = useApiBitacora();
  const { datos, loading, error, recargar } = useBitacora(obtenerBitacora, cardCode);
  const acciones = useAccionesBitacora(api, cardCode, recargar);
  const hoy = fechaLocalISO(new Date());

  let contenido: ReactNode;
  if (!datos) {
    contenido = error ? (
      <div>
        <p style={{ color: "var(--color-risk)", margin: 0 }}>{error}</p>
        <button type="button" onClick={() => void recargar()} style={{ ...botonTexto, marginTop: 8 }}>
          Reintentar
        </button>
      </div>
    ) : (
      <p style={{ color: "var(--color-muted)", margin: 0 }}>{loading ? "Cargando bitácora..." : ""}</p>
    );
  } else {
    contenido = (
      <>
        {datos.cliente.pagador_central && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              background: "var(--color-accent-soft)",
              borderRadius: 8,
              fontSize: 12.5,
              color: "var(--color-accent-ink)",
            }}
          >
            <div>
              Bitácora compartida con el pagador central{" "}
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{datos.cliente.pagador_central.card_code}</span>
              {datos.cliente.pagador_central.card_name ? ` · ${datos.cliente.pagador_central.card_name}` : ""}
            </div>
            <div style={{ fontSize: 12, marginTop: 2, opacity: 0.85 }}>
              Lo que registres acá también lo ve quien gestione esa cuenta.
            </div>
          </div>
        )}
        {error && <p style={{ ...ERROR, margin: "0 0 12px" }}>{error}</p>}

        <div className="bitacora-grid">
          <section className="bitacora-area-tareas" aria-labelledby="bitacora-tareas">
            <ListaTareas
              tareas={datos.tareas}
              equipo={datos.equipo}
              hoy={hoy}
              completandoIds={acciones.completar.completandoIds}
              error={acciones.completar.error}
              onCompletar={(id) => void acciones.completar.completar(id)}
            />
          </section>

          <section className="bitacora-area-registrar" aria-labelledby="bitacora-registrar">
            <PanelRegistrar
              datos={datos}
              hoy={hoy}
              usuarioActual={usuarioActual}
              acciones={acciones}
            />
          </section>

          <section className="bitacora-area-historial" aria-labelledby="bitacora-historial">
            <Historial eventos={datos.eventos} equipo={datos.equipo} hoy={hoy} cardCodeActual={cardCode} />
          </section>
        </div>
      </>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 500, margin: 0 }}>Bitácora de gestión</h3>
        {enPiloto && <BadgePiloto />}
        {loading && datos && <span className="spinner" aria-label="Actualizando" style={{ color: "var(--color-muted)" }} />}
      </div>
      {contenido}
    </div>
  );
}

const botonTexto: CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  font: "inherit",
  fontSize: 12.5,
  color: "var(--color-accent)",
  textDecoration: "underline",
  cursor: "pointer",
};

/* ---------------------------------------------------------------- tareas */

function ListaTareas({
  tareas,
  equipo,
  hoy,
  completandoIds,
  error,
  onCompletar,
}: {
  tareas: TareaBitacora[];
  equipo: MiembroEquipo[];
  hoy: string;
  completandoIds: number[];
  error: string | null;
  onCompletar: (id: number) => void;
}) {
  const [verCompletadas, setVerCompletadas] = useState(false);
  const { vencidas, pendientes, completadas } = useMemo(() => clasificarTareas(tareas, hoy), [tareas, hoy]);
  const abiertas = [...vencidas, ...pendientes];

  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
        <p id="bitacora-tareas" style={ETIQUETA}>
          Tareas y recordatorios
        </p>
        {vencidas.length > 0 && (
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-risk)" }}>
            {vencidas.length} vencida{vencidas.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, background: "var(--color-surface)", overflow: "hidden" }}>
        {abiertas.length === 0 ? (
          <p style={{ color: "var(--color-muted)", margin: 0, padding: "14px 16px", fontSize: 13 }}>
            {completadas.length > 0
              ? "No hay recordatorios pendientes."
              : "Sin recordatorios para este cliente. Creá uno desde Registrar para no olvidarte del próximo paso."}
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {abiertas.map((t, i) => (
              <FilaTarea
                key={t.id}
                tarea={t}
                equipo={equipo}
                hoy={hoy}
                primera={i === 0}
                completando={completandoIds.includes(t.id)}
                onCompletar={onCompletar}
              />
            ))}
          </ul>
        )}

        {completadas.length > 0 && (
          <div style={{ borderTop: "1px solid var(--color-line)" }}>
            <button
              type="button"
              aria-expanded={verCompletadas}
              onClick={() => setVerCompletadas((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                padding: "9px 16px",
                background: "var(--color-paper)",
                border: "none",
                font: "inherit",
                fontSize: 12.5,
                color: "var(--color-muted)",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span aria-hidden style={{ display: "inline-block", width: 10, transform: verCompletadas ? "rotate(90deg)" : undefined, transition: "transform 120ms" }}>
                ›
              </span>
              {verCompletadas ? "Ocultar completadas" : `Ver completadas (${completadas.length})`}
            </button>
            {verCompletadas && (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {completadas.map((t) => (
                  <li
                    key={t.id}
                    style={{ display: "flex", gap: 10, padding: "8px 16px", borderTop: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                  >
                    <input type="checkbox" checked disabled aria-label="Completada" style={{ width: 16, height: 16, marginTop: 2, accentColor: "var(--color-ok)" }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, textDecoration: "line-through", overflowWrap: "anywhere" }}>{t.descripcion}</div>
                      <div style={{ fontSize: 11.5, marginTop: 2 }}>
                        Completada {formatDateTime(t.completada_utc)} · {nombreDeUsuario(t.responsable, equipo)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {error && <p style={ERROR} role="alert">{error}</p>}
    </>
  );
}

function FilaTarea({
  tarea,
  equipo,
  hoy,
  primera,
  completando,
  onCompletar,
}: {
  tarea: TareaBitacora;
  equipo: MiembroEquipo[];
  hoy: string;
  primera: boolean;
  completando: boolean;
  onCompletar: (id: number) => void;
}) {
  const vencimiento = describirVencimiento(tarea.fecha_objetivo, hoy);
  const vencida = vencimiento.variante === "vencida";
  const idCheck = `tarea-${tarea.id}`;
  const colorFecha =
    vencida ? "var(--color-risk)" : vencimiento.variante === "hoy" ? "var(--color-accent)" : "var(--color-muted)";

  return (
    <li
      style={{
        display: "flex",
        gap: 10,
        padding: "10px 16px 10px 13px",
        borderTop: primera ? undefined : "1px solid var(--color-line)",
        borderLeft: `3px solid ${vencida ? "var(--color-risk)" : "transparent"}`,
        background: vencida ? "var(--color-risk-soft)" : undefined,
        opacity: completando ? 0.55 : 1,
        transition: "opacity 120ms",
      }}
    >
      <input
        id={idCheck}
        type="checkbox"
        checked={completando}
        disabled={completando}
        onChange={() => onCompletar(tarea.id)}
        style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0, accentColor: "var(--color-accent)", cursor: completando ? "default" : "pointer" }}
      />
      <label htmlFor={idCheck} style={{ minWidth: 0, flex: 1, cursor: completando ? "default" : "pointer" }}>
        <span style={{ display: "block", fontSize: 13.5, overflowWrap: "anywhere" }}>{tarea.descripcion}</span>
        <span style={{ display: "block", fontSize: 12, marginTop: 2, color: "var(--color-muted)" }}>
          <span style={{ color: colorFecha, fontWeight: vencimiento.variante === "futura" ? 400 : 600 }} title={formatDate(tarea.fecha_objetivo)}>
            {vencimiento.texto}
          </span>
          {" · "}
          {nombreDeUsuario(tarea.responsable, equipo)}
          {completando && " · Completando…"}
        </span>
      </label>
    </li>
  );
}

/* ------------------------------------------------------------- historial */

function Historial({
  eventos,
  equipo,
  hoy,
  cardCodeActual,
}: {
  eventos: EventoBitacora[];
  equipo: MiembroEquipo[];
  hoy: string;
  cardCodeActual: string;
}) {
  const grupos = useMemo(() => agruparEventosPorDia(eventos, hoy), [eventos, hoy]);

  return (
    <>
      <p id="bitacora-historial" style={{ ...ETIQUETA, marginBottom: 10 }}>
        Historial
      </p>
      {grupos.length === 0 ? (
        <div style={{ border: "1px dashed var(--color-line-strong)", borderRadius: 8, padding: "18px 16px", color: "var(--color-muted)", fontSize: 13 }}>
          Todavía no hay gestiones registradas para este cliente. Registrá la primera con el formulario.
        </div>
      ) : (
        <div>
          {grupos.map((grupo) => (
            <div key={grupo.clave} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)", margin: "0 0 6px" }}>{grupo.titulo}</div>
              <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {grupo.eventos.map((e, i) => (
                  <ItemEvento
                    key={e.id ?? `${e.referencia}-${e.fecha_utc}-${i}`}
                    evento={e}
                    equipo={equipo}
                    ultimo={i === grupo.eventos.length - 1}
                    cardCodeActual={cardCodeActual}
                  />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function ItemEvento({
  evento,
  equipo,
  ultimo,
  cardCodeActual,
}: {
  evento: EventoBitacora;
  equipo: MiembroEquipo[];
  ultimo: boolean;
  cardCodeActual: string;
}) {
  const auto = esAutomatico(evento);
  return (
    <li className="bitacora-evento" style={{ display: "grid", gridTemplateColumns: "44px 14px 1fr", columnGap: 8 }}>
      <time
        dateTime={evento.fecha_utc}
        title={formatDateTime(evento.fecha_utc)}
        style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-muted)", paddingTop: 1, textAlign: "right" }}
      >
        {horaLocal(evento.fecha_utc)}
      </time>
      {/* Riel del timeline: punto lleno para gestiones de una persona, hueco para lo automatico. */}
      <div aria-hidden style={{ position: "relative", display: "flex", justifyContent: "center" }}>
        {!ultimo && <span style={{ position: "absolute", top: 14, bottom: -4, width: 1, background: "var(--color-line)" }} />}
        <span
          style={{
            marginTop: 5,
            width: auto ? 7 : 9,
            height: auto ? 7 : 9,
            borderRadius: "50%",
            boxSizing: "border-box",
            background: auto ? "var(--color-surface)" : "var(--color-accent)",
            border: auto ? "1.5px solid var(--color-line-strong)" : "none",
          }}
        />
      </div>
      <div style={{ paddingBottom: ultimo ? 0 : 12, minWidth: 0 }}>
        <div style={{ fontSize: auto ? 13 : 14, fontWeight: auto ? 500 : 600, color: auto ? "var(--color-muted)" : "var(--color-ink)" }}>
          {evento.resultado}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2, display: "flex", flexWrap: "wrap", gap: "2px 6px", alignItems: "center" }}>
          <span>{etiquetaEvento(evento)}</span>
          <span aria-hidden>·</span>
          <span>{nombreDeUsuario(evento.origen, equipo)}</span>
          {auto && (
            <span style={{ fontSize: 10.5, padding: "0 6px", borderRadius: 10, border: "1px solid var(--color-line)", color: "var(--color-muted)" }}>
              automático
            </span>
          )}
          {evento.card_code && evento.card_code !== cardCodeActual && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} title="Registrado desde esta cuenta">
              {evento.card_code}
            </span>
          )}
        </div>
        {evento.nota && (
          <div
            style={{
              fontSize: auto ? 12.5 : 13,
              color: auto ? "var(--color-muted)" : "var(--color-ink)",
              marginTop: 4,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              maxWidth: "70ch",
            }}
          >
            {evento.nota}
          </div>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------- registrar */

type Modo = "gestion" | "recordatorio";

function PanelRegistrar({
  datos,
  hoy,
  usuarioActual,
  acciones,
}: {
  datos: BitacoraResponse;
  hoy: string;
  usuarioActual: string | null;
  acciones: ReturnType<typeof useAccionesBitacora>;
}) {
  const [modo, setModo] = useState<Modo>("gestion");

  return (
    <div
      className="bitacora-registrar"
      style={{ border: "1px solid var(--color-line)", borderRadius: 10, background: "var(--color-surface)", padding: "14px 16px 16px" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <p id="bitacora-registrar" style={ETIQUETA}>
          Registrar
        </p>
        <div role="group" aria-label="Qué registrar" style={{ display: "flex" }}>
          {(
            [
              { key: "gestion", label: "Gestión" },
              { key: "recordatorio", label: "Recordatorio" },
            ] as const
          ).map((opcion, i) => {
            const activa = opcion.key === modo;
            return (
              <button
                key={opcion.key}
                type="button"
                aria-pressed={activa}
                onClick={() => setModo(opcion.key)}
                style={{
                  padding: "4px 12px",
                  fontSize: 12.5,
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
                {opcion.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Los dos quedan montados: cambiar de modo no pierde lo que se estaba escribiendo. */}
      <div hidden={modo !== "gestion"}>
        <FormularioGestion motivos={datos.motivos} canales={datos.canales} estado={acciones.gestion} />
      </div>
      <div hidden={modo !== "recordatorio"}>
        <FormularioRecordatorio equipo={datos.equipo} hoy={hoy} usuarioActual={usuarioActual} estado={acciones.recordatorio} />
      </div>
    </div>
  );
}

// Confirmacion breve con el mismo verbo del boton ("Registrar gestión" -> "Gestión registrada.").
function useConfirmacion(): [string | null, (texto: string) => void] {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    if (!texto) return;
    const t = setTimeout(() => setTexto(null), 4000);
    return () => clearTimeout(t);
  }, [texto]);
  return [texto, setTexto];
}

function Campo({ id, etiqueta, opcional, error, children }: { id: string; etiqueta: string; opcional?: boolean; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: "block", fontSize: 12.5, fontWeight: 500, marginBottom: 5 }}>
        {etiqueta}
        {opcional && <span style={{ fontWeight: 400, color: "var(--color-muted)" }}> (opcional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} style={ERROR}>
          {error}
        </p>
      )}
    </div>
  );
}

function BotonEnviar({ enviando, texto, textoEnviando }: { enviando: boolean; texto: string; textoEnviando: string }) {
  return (
    <button
      type="submit"
      disabled={enviando}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        border: "none",
        borderRadius: 7,
        background: "var(--color-accent)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        fontFamily: "inherit",
        cursor: enviando ? "default" : "pointer",
        opacity: enviando ? 0.75 : 1,
      }}
    >
      {enviando && <span className="spinner" aria-hidden />}
      {enviando ? textoEnviando : texto}
    </button>
  );
}

function PieFormulario({ children, confirmacion, error }: { children: ReactNode; confirmacion: string | null; error: string | null }) {
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        {children}
        <span aria-live="polite" style={{ fontSize: 12.5, color: "var(--color-ok)", fontWeight: 500 }}>
          {confirmacion}
        </span>
      </div>
      {error && (
        <p role="alert" style={ERROR}>
          {error}
        </p>
      )}
    </>
  );
}

const GESTION_VACIA: FormGestion = { resultado: "", canal: "", nota: "" };

function FormularioGestion({
  motivos,
  canales,
  estado,
}: {
  motivos: string[];
  canales: string[];
  estado: ReturnType<typeof useAccionesBitacora>["gestion"];
}) {
  const [form, setForm] = useState<FormGestion>(GESTION_VACIA);
  const [errores, setErrores] = useState<Errores<FormGestion>>({});
  const [confirmacion, confirmar] = useConfirmacion();

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const nuevos = validarGestion(form, motivos, canales);
    setErrores(nuevos);
    if (hayErrores(nuevos)) return;
    const ok = await estado.enviar(armarGestionRequest(form));
    if (ok) {
      setForm(GESTION_VACIA);
      confirmar("Gestión registrada.");
    }
  }

  const largoNota = form.nota.trim().length;

  return (
    <form onSubmit={enviar} noValidate>
      <Campo id="gestion-motivo" etiqueta="Motivo" error={errores.resultado}>
        <select
          id="gestion-motivo"
          value={form.resultado}
          aria-invalid={Boolean(errores.resultado)}
          aria-describedby={errores.resultado ? "gestion-motivo-error" : undefined}
          onChange={(e) => {
            setForm({ ...form, resultado: e.target.value });
            setErrores({ ...errores, resultado: undefined });
          }}
          style={{ ...CAMPO, borderColor: errores.resultado ? "var(--color-risk)" : undefined, color: form.resultado ? "var(--color-ink)" : "var(--color-muted)" }}
        >
          <option value="">Elegí un motivo…</option>
          {motivos.map((m) => (
            <option key={m} value={m} style={{ color: "var(--color-ink)" }}>
              {m}
            </option>
          ))}
        </select>
      </Campo>

      <div style={{ marginBottom: 12 }}>
        <div id="gestion-canal" style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 6 }}>
          Canal <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>(opcional)</span>
        </div>
        <div role="radiogroup" aria-labelledby="gestion-canal" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {canales.map((c) => {
            const activo = form.canal === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={activo}
                // Un segundo click lo deselecciona: el canal es opcional.
                onClick={() => setForm({ ...form, canal: activo ? "" : c })}
                style={{
                  padding: "4px 11px",
                  borderRadius: 20,
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  border: `1px solid ${activo ? "var(--color-accent)" : "var(--color-line)"}`,
                  background: activo ? "var(--color-accent-soft)" : "var(--color-surface)",
                  color: activo ? "var(--color-accent-ink)" : "var(--color-muted)",
                  fontWeight: activo ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
        {errores.canal && <p style={ERROR}>{errores.canal}</p>}
      </div>

      <Campo id="gestion-nota" etiqueta="Nota" opcional error={errores.nota}>
        <textarea
          id="gestion-nota"
          value={form.nota}
          rows={3}
          placeholder="Ej: Paga el viernes por transferencia"
          aria-invalid={Boolean(errores.nota)}
          onChange={(e) => {
            setForm({ ...form, nota: e.target.value });
            setErrores({ ...errores, nota: undefined });
          }}
          style={{ ...CAMPO, resize: "vertical", minHeight: 64, borderColor: errores.nota ? "var(--color-risk)" : undefined }}
        />
        {largoNota > MAX_NOTA - 200 && (
          <div style={{ ...AYUDA, textAlign: "right", color: largoNota > MAX_NOTA ? "var(--color-risk)" : AYUDA.color }}>
            {largoNota}/{MAX_NOTA}
          </div>
        )}
      </Campo>

      <PieFormulario confirmacion={confirmacion} error={estado.error}>
        <BotonEnviar enviando={estado.enviando} texto="Registrar gestión" textoEnviando="Registrando…" />
      </PieFormulario>
    </form>
  );
}

function FormularioRecordatorio({
  equipo,
  hoy,
  usuarioActual,
  estado,
}: {
  equipo: MiembroEquipo[];
  hoy: string;
  usuarioActual: string | null;
  estado: ReturnType<typeof useAccionesBitacora>["recordatorio"];
}) {
  const inicial = useMemo<FormRecordatorio>(
    () => ({ descripcion: "", fecha_objetivo: sumarDias(hoy, 1), responsable: responsablePorDefecto(usuarioActual, equipo) }),
    [hoy, usuarioActual, equipo]
  );
  const [form, setForm] = useState<FormRecordatorio>(inicial);
  const [errores, setErrores] = useState<Errores<FormRecordatorio>>({});
  const [confirmacion, confirmar] = useConfirmacion();
  const usuarioEnEquipo = responsablePorDefecto(usuarioActual, equipo) !== "";

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const nuevos = validarRecordatorio(form, hoy);
    setErrores(nuevos);
    if (hayErrores(nuevos)) return;
    const ok = await estado.enviar(armarRecordatorioRequest(form));
    if (ok) {
      // Conserva fecha y responsable: suele cargarse más de uno seguido.
      setForm({ ...form, descripcion: "" });
      confirmar("Recordatorio creado.");
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <Campo id="recordatorio-descripcion" etiqueta="Qué hay que hacer" error={errores.descripcion}>
        <input
          id="recordatorio-descripcion"
          type="text"
          value={form.descripcion}
          maxLength={MAX_DESCRIPCION + 50}
          placeholder="Ej: Llamar para confirmar el pago"
          aria-invalid={Boolean(errores.descripcion)}
          aria-describedby={errores.descripcion ? "recordatorio-descripcion-error" : undefined}
          onChange={(e) => {
            setForm({ ...form, descripcion: e.target.value });
            setErrores({ ...errores, descripcion: undefined });
          }}
          style={{ ...CAMPO, borderColor: errores.descripcion ? "var(--color-risk)" : undefined }}
        />
      </Campo>

      <div className="bitacora-form-fila" style={{ display: "grid", gridTemplateColumns: equipo.length > 0 ? "minmax(0, 1fr) minmax(0, 1.3fr)" : "1fr", gap: 10 }}>
        <Campo id="recordatorio-fecha" etiqueta="Para cuándo" error={errores.fecha_objetivo}>
          <input
            id="recordatorio-fecha"
            type="date"
            value={form.fecha_objetivo}
            min={hoy}
            aria-invalid={Boolean(errores.fecha_objetivo)}
            onChange={(e) => {
              setForm({ ...form, fecha_objetivo: e.target.value });
              setErrores({ ...errores, fecha_objetivo: undefined });
            }}
            style={{ ...CAMPO, borderColor: errores.fecha_objetivo ? "var(--color-risk)" : undefined }}
          />
        </Campo>
        {equipo.length > 0 && (
          <Campo id="recordatorio-responsable" etiqueta="Responsable">
            <select
              id="recordatorio-responsable"
              value={form.responsable}
              onChange={(e) => setForm({ ...form, responsable: e.target.value })}
              style={CAMPO}
            >
              {!usuarioEnEquipo && <option value="">Yo</option>}
              {equipo.map((m) => (
                <option key={m.upn} value={m.upn}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </Campo>
        )}
      </div>

      <PieFormulario confirmacion={confirmacion} error={estado.error}>
        <BotonEnviar enviando={estado.enviando} texto="Crear recordatorio" textoEnviando="Creando…" />
      </PieFormulario>
    </form>
  );
}
