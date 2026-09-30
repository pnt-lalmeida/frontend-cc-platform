import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type {
  BitacoraResponse,
  EventoBitacora,
  FiltroBitacora,
  MiembroEquipo,
  ResumenBitacora,
  TareaBitacora,
} from "../../api/types";
import { BadgePiloto } from "../../components/BadgePiloto";
import { formatDate, formatDateTime } from "../../design/format";
import { useFeatures } from "../../features/FeaturesContext";
import { hoyUruguay } from "../../utils/fechas";
import {
  FILTROS,
  MAX_DESCRIPCION,
  MAX_NOTA,
  SIN_GESTIONES,
  armarGestionRequest,
  armarHistorial,
  armarRecordatorioRequest,
  claveEvento,
  clasificarTareas,
  describirGrupo,
  describirRecordatorios,
  describirUltimaGestion,
  describirVencimiento,
  esAutomatico,
  etiquetaEvento,
  guardarFiltro,
  hayErrores,
  horaLocal,
  leerFiltroGuardado,
  nombreDeUsuario,
  responsablePorDefecto,
  sumarDias,
  validarGestion,
  vacioDeFiltro,
  validarRecordatorio,
  type Errores,
  type FormGestion,
  type FormRecordatorio,
} from "./bitacora";
import { PromesasVigentes } from "./PromesasVigentes";
import { MAX_FACTURAS, armarPromesaRequest, validarPromesa, type FormPromesa } from "./promesas";
import { useAccionesBitacora } from "./useAccionesBitacora";
import { useApiBitacora } from "./useApiBitacora";
import { useApiPromesas } from "./useApiPromesas";
import { useBitacora } from "./useBitacora";
import { usePromesas, type EstadoPromesas } from "./usePromesas";

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

interface PropsActividad {
  cardCode: string;
  enPiloto: boolean;
  usuarioActual: string | null;
}

// Promesas de pago (Fase 4): el estado se comparte entre el bloque de vigentes
// (arriba) y la pestaña "Promesa" del panel Registrar, asi que vive aca y baja
// por props.
interface PromesasDeActividad {
  estado: EstadoPromesas;
  enPiloto: boolean;
}

// El gating vive en quien monta: sin la funcionalidad "promesas" ni se monta
// ConPromesas ni se hace ningun fetch. Los hooks de promesas no pueden ser
// condicionales, por eso el estado se arma en un componente aparte.
export function BitacoraActividad(props: PropsActividad) {
  const { habilitada, enPiloto } = useFeatures();
  if (habilitada("promesas")) return <ConPromesas {...props} promesasEnPiloto={enPiloto("promesas")} />;
  return <ActividadCliente {...props} promesas={null} />;
}

function ConPromesas({ promesasEnPiloto, ...props }: PropsActividad & { promesasEnPiloto: boolean }) {
  const api = useApiPromesas();
  const estado = usePromesas(api, props.cardCode);
  return <ActividadCliente {...props} promesas={{ estado, enPiloto: promesasEnPiloto }} />;
}

function ActividadCliente({
  cardCode,
  enPiloto,
  usuarioActual,
  promesas,
}: PropsActividad & { promesas: PromesasDeActividad | null }) {
  const { fuentes, api } = useApiBitacora();
  // Ultimo filtro elegido por esta persona; si localStorage falla, "Todo".
  const [filtro, setFiltro] = useState<FiltroBitacora>(() => leerFiltroGuardado(usuarioActual));
  const [usuarioDelFiltro, setUsuarioDelFiltro] = useState(usuarioActual);
  const [eligioFiltro, setEligioFiltro] = useState(false);
  // El usuario puede llegar despues del primer render (null -> UPN): si la
  // persona todavia no eligio un filtro aca, se aplica el que tenia guardado.
  // Ajuste de estado durante el render, sin efecto (mismo patron que
  // useAccionesBitacora).
  if (usuarioDelFiltro !== usuarioActual) {
    setUsuarioDelFiltro(usuarioActual);
    if (usuarioDelFiltro === null && usuarioActual !== null && !eligioFiltro) {
      setFiltro(leerFiltroGuardado(usuarioActual));
    }
  }
  const bitacora = useBitacora(fuentes, cardCode, filtro);
  const { datos, loading, error, recargar } = bitacora;
  const acciones = useAccionesBitacora(api, cardCode, recargar);
  // Un solo "hoy" para todo el panel: el de Montevideo (ver utils/fechas).
  const hoy = hoyUruguay();
  const [resaltada, resaltar] = useResaltado();

  function elegirFiltro(nuevo: FiltroBitacora) {
    setFiltro(nuevo);
    setEligioFiltro(true);
    guardarFiltro(usuarioActual, nuevo);
  }

  // Lleva a la ultima gestion si esta cargada (con el filtro vigente y las
  // paginas pedidas); si no, el resumen no la ofrece como enlace.
  const ultimaGestion = datos?.resumen?.ultima_gestion ?? null;
  const claveUltima = ultimaGestion ? claveEvento(ultimaGestion) : null;
  const ultimaCargada = claveUltima !== null && bitacora.eventos.some((e) => claveEvento(e) === claveUltima);

  function irAUltimaGestion() {
    if (!claveUltima || !ultimaCargada) return;
    const nodo = document.getElementById(idItem(claveUltima));
    if (!nodo) return;
    const reducir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    nodo.scrollIntoView?.({ block: "center", behavior: reducir ? "auto" : "smooth" });
    nodo.focus({ preventScroll: true });
    resaltar(claveUltima);
  }

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
        {datos.resumen && (
          <ResumenActividad
            resumen={datos.resumen}
            equipo={datos.equipo}
            hoy={hoy}
            onIrAUltima={ultimaCargada ? irAUltimaGestion : undefined}
          />
        )}
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
              promesas={promesas?.estado ?? null}
              // Puede que el backend haya escrito un evento al registrar la promesa.
              alRegistrarPromesa={() => void recargar()}
            />
          </section>

          <section className="bitacora-area-historial" aria-labelledby="bitacora-historial">
            <Historial
              bitacora={bitacora}
              equipo={datos.equipo}
              hoy={hoy}
              cardCodeActual={cardCode}
              filtro={filtro}
              onFiltro={elegirFiltro}
              resaltada={resaltada}
            />
          </section>
        </div>
      </>
    );
  }

  return (
    <div>
      {promesas && (
        <PromesasVigentes
          estado={promesas.estado}
          equipo={datos?.equipo ?? []}
          hoy={hoyUruguay()}
          enPiloto={promesas.enPiloto}
        />
      )}
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

/* --------------------------------------------------------------- resumen */

function idItem(clave: string): string {
  return `bitacora-item-${clave.replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

// Resalta un evento unos segundos (clic en "Última gestión").
function useResaltado(): [string | null, (clave: string) => void] {
  const [clave, setClave] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!clave) return;
    const t = setTimeout(() => setClave(null), 2400);
    return () => clearTimeout(t);
  }, [clave, vuelta]);
  return [
    clave,
    (nueva: string) => {
      setClave(nueva);
      setVuelta((v) => v + 1);
    },
  ];
}

function ResumenActividad({
  resumen,
  equipo,
  hoy,
  onIrAUltima,
}: {
  resumen: ResumenBitacora;
  equipo: MiembroEquipo[];
  hoy: string;
  onIrAUltima?: () => void;
}) {
  const gestion = describirUltimaGestion(resumen.ultima_gestion, equipo, hoy);
  const recordatorios = describirRecordatorios(resumen.tareas_pendientes, resumen.tareas_vencidas);
  const textoGestion = gestion && (
    <>
      <strong style={{ fontWeight: 600 }}>{gestion.cuando}</strong> — {gestion.detalle}
    </>
  );

  return (
    <div className="bitacora-resumen" aria-label="Resumen de actividad" role="group">
      <span>
        {gestion ? (
          <>
            <span style={{ color: "var(--color-muted)" }}>Última gestión: </span>
            {onIrAUltima ? (
              <button type="button" className="bitacora-resumen-enlace" onClick={onIrAUltima} title="Ver en el historial">
                {textoGestion}
              </button>
            ) : (
              <span>{textoGestion}</span>
            )}
          </>
        ) : (
          <span style={{ color: "var(--color-muted)" }}>{SIN_GESTIONES}</span>
        )}
      </span>
      {recordatorios && (
        <span className="bitacora-resumen-recordatorios">
          <span className="bitacora-resumen-sep" aria-hidden>
            {" · "}
          </span>
          {recordatorios.pendientes}
          {recordatorios.vencidas && (
            <span style={{ color: "var(--color-risk)", fontWeight: 600 }}> ({recordatorios.vencidas})</span>
          )}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- historial */

function Historial({
  bitacora,
  equipo,
  hoy,
  cardCodeActual,
  filtro,
  onFiltro,
  resaltada,
}: {
  bitacora: ReturnType<typeof useBitacora>;
  equipo: MiembroEquipo[];
  hoy: string;
  cardCodeActual: string;
  filtro: FiltroBitacora;
  onFiltro: (filtro: FiltroBitacora) => void;
  resaltada: string | null;
}) {
  const { eventos, hayMas, cargandoEventos, errorEventos, anteriores } = bitacora;
  const dias = useMemo(() => armarHistorial(eventos, hoy), [eventos, hoy]);

  let cuerpo: ReactNode;
  if (cargandoEventos) {
    cuerpo = (
      <p style={{ color: "var(--color-muted)", fontSize: 13, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <span className="spinner" aria-hidden /> Cargando historial…
      </p>
    );
  } else if (errorEventos) {
    cuerpo = (
      <div role="alert">
        <p style={{ ...ERROR, margin: 0 }}>{errorEventos}</p>
        <button type="button" onClick={() => void bitacora.recargar()} style={{ ...botonTexto, marginTop: 6 }}>
          Reintentar
        </button>
      </div>
    );
  } else if (dias.length === 0) {
    cuerpo = (
      <div style={{ border: "1px dashed var(--color-line-strong)", borderRadius: 8, padding: "18px 16px", color: "var(--color-muted)", fontSize: 13 }}>
        {vacioDeFiltro(filtro)}
      </div>
    );
  } else {
    cuerpo = (
      <>
        {dias.map((dia) => (
          <div key={dia.clave} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)", margin: "0 0 6px" }}>{dia.titulo}</div>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {dia.items.map((item, i) => {
                const ultimo = i === dia.items.length - 1;
                if (item.tipo === "grupo") {
                  return <ItemGrupo key={item.clave} eventos={item.eventos} equipo={equipo} ultimo={ultimo} cardCodeActual={cardCodeActual} />;
                }
                const Item = esAutomatico(item.evento) ? ItemAutomatico : ItemEvento;
                return (
                  <Item
                    key={item.clave}
                    id={idItem(item.clave)}
                    evento={item.evento}
                    equipo={equipo}
                    ultimo={ultimo}
                    cardCodeActual={cardCodeActual}
                    resaltado={resaltada === item.clave}
                  />
                );
              })}
            </ol>
          </div>
        ))}
        {hayMas && (
          <div style={{ marginTop: 4 }}>
            <button
              type="button"
              className="bitacora-ver-anteriores"
              onClick={() => void anteriores.cargar()}
              disabled={anteriores.cargando}
              aria-busy={anteriores.cargando}
            >
              {anteriores.cargando && <span className="spinner" aria-hidden />}
              {anteriores.cargando ? "Cargando anteriores…" : "Ver anteriores"}
            </button>
            {anteriores.error && (
              <p role="alert" style={ERROR}>
                {anteriores.error}
              </p>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="bitacora-historial-cabecera">
        <p id="bitacora-historial" style={ETIQUETA}>
          Historial
        </p>
        <div role="group" aria-label="Filtrar historial" className="bitacora-filtros">
          {FILTROS.map((f) => (
            <button key={f.clave} type="button" aria-pressed={f.clave === filtro} onClick={() => f.clave !== filtro && onFiltro(f.clave)}>
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>
      {cuerpo}
    </>
  );
}

interface PropsItem {
  id: string;
  evento: EventoBitacora;
  equipo: MiembroEquipo[];
  ultimo: boolean;
  cardCodeActual: string;
  resaltado: boolean;
}

// Riel del timeline: punto lleno para gestiones de una persona, hueco para lo automatico.
function Riel({ ultimo, auto }: { ultimo: boolean; auto: boolean }) {
  return (
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
  );
}

function Hora({ fecha }: { fecha: string }) {
  return (
    <time
      dateTime={fecha}
      title={formatDateTime(fecha)}
      style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-muted)", paddingTop: 1, textAlign: "right" }}
    >
      {horaLocal(fecha)}
    </time>
  );
}

function EtiquetaAutomatico() {
  return (
    <span className="bitacora-tag" style={{ fontSize: 10.5, padding: "0 6px", borderRadius: 10, border: "1px solid var(--color-line)", color: "var(--color-muted)", whiteSpace: "nowrap" }}>
      automático
    </span>
  );
}

function OtraCuenta({ evento, cardCodeActual }: { evento: EventoBitacora; cardCodeActual: string }) {
  if (!evento.card_code || evento.card_code === cardCodeActual) return null;
  return (
    <span className="bitacora-otra-cuenta" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }} title="Registrado desde esta cuenta">
      {evento.card_code}
    </span>
  );
}

const SEP = (
  <span aria-hidden className="bitacora-sep" style={{ color: "var(--color-line-strong)" }}>
    ·
  </span>
);

// Gestion del equipo: el protagonista del historial (punto lleno, motivo en
// negrita, nota completa).
function ItemEvento({ id, evento, equipo, ultimo, cardCodeActual, resaltado }: PropsItem) {
  return (
    <li id={id} tabIndex={-1} className={`bitacora-evento${resaltado ? " bitacora-resaltado" : ""}`}>
      <Hora fecha={evento.fecha_utc} />
      <Riel ultimo={ultimo} auto={false} />
      <div style={{ paddingBottom: ultimo ? 0 : 14, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--color-ink)" }}>{evento.resultado}</div>
        <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2, display: "flex", flexWrap: "wrap", gap: "2px 6px", alignItems: "center" }}>
          <span>{etiquetaEvento(evento)}</span>
          {SEP}
          <span>{nombreDeUsuario(evento.origen, equipo)}</span>
          <OtraCuenta evento={evento} cardCodeActual={cardCodeActual} />
        </div>
        {evento.nota && (
          <div style={{ fontSize: 13, color: "var(--color-ink)", marginTop: 4, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "70ch" }}>
            {evento.nota}
          </div>
        )}
      </div>
    </li>
  );
}

// Automatico suelto: una sola linea, en segundo plano.
function ItemAutomatico({ id, evento, equipo, ultimo, cardCodeActual, resaltado }: PropsItem) {
  return (
    <li id={id} tabIndex={-1} className={`bitacora-evento${resaltado ? " bitacora-resaltado" : ""}`}>
      <Hora fecha={evento.fecha_utc} />
      <Riel ultimo={ultimo} auto />
      <div className="bitacora-auto-linea" style={{ paddingBottom: ultimo ? 0 : 10 }}>
        <span style={{ fontWeight: 500 }}>{evento.resultado}</span>
        {evento.nota && (
          <>
            {SEP}
            <span style={{ overflowWrap: "anywhere" }}>{evento.nota}</span>
          </>
        )}
        {SEP}
        <span>{nombreDeUsuario(evento.origen, equipo)}</span>
        <OtraCuenta evento={evento} cardCodeActual={cardCodeActual} />
        <EtiquetaAutomatico />
      </div>
    </li>
  );
}

// Varios automaticos seguidos del mismo dia y resultado: una fila colapsada.
function ItemGrupo({
  eventos,
  equipo,
  ultimo,
  cardCodeActual,
}: {
  eventos: EventoBitacora[];
  equipo: MiembroEquipo[];
  ultimo: boolean;
  cardCodeActual: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const { titulo, quien, rango } = describirGrupo(eventos, equipo);

  return (
    <li className="bitacora-evento">
      <span aria-hidden />
      <Riel ultimo={ultimo} auto />
      <div style={{ paddingBottom: ultimo ? 0 : 10, minWidth: 0 }}>
        <button type="button" className="bitacora-grupo-boton bitacora-auto-linea" aria-expanded={abierto} onClick={() => setAbierto((v) => !v)}>
          <span aria-hidden className="bitacora-chevron" data-abierto={abierto}>
            ›
          </span>
          <span style={{ fontWeight: 500 }}>{titulo}</span>
          {SEP}
          <span>{quien}</span>
          {SEP}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, whiteSpace: "nowrap" }}>{rango}</span>
          <EtiquetaAutomatico />
        </button>
        {abierto && (
          <ul className="bitacora-grupo-detalle">
            {eventos.map((e) => (
              <li key={claveEvento(e)}>
                <time dateTime={e.fecha_utc} title={formatDateTime(e.fecha_utc)} style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                  {horaLocal(e.fecha_utc)}
                </time>
                {SEP}
                <span style={{ overflowWrap: "anywhere" }}>{e.nota ?? "Sin motivo"}</span>
                {SEP}
                <span>{nombreDeUsuario(e.origen, equipo)}</span>
                <OtraCuenta evento={e} cardCodeActual={cardCodeActual} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------- registrar */

type Modo = "gestion" | "recordatorio" | "promesa";

function PanelRegistrar({
  datos,
  hoy,
  usuarioActual,
  acciones,
  promesas,
  alRegistrarPromesa,
}: {
  datos: BitacoraResponse;
  hoy: string;
  usuarioActual: string | null;
  acciones: ReturnType<typeof useAccionesBitacora>;
  // null = funcionalidad "promesas" no habilitada: no hay pestaña ni formulario.
  promesas: EstadoPromesas | null;
  alRegistrarPromesa: () => void;
}) {
  const [modo, setModo] = useState<Modo>("gestion");
  const opciones: { key: Modo; label: string }[] = [
    { key: "gestion", label: "Gestión" },
    { key: "recordatorio", label: "Recordatorio" },
    ...(promesas ? [{ key: "promesa" as const, label: "Promesa" }] : []),
  ];

  return (
    <div
      className="bitacora-registrar"
      data-promesas={promesas ? "true" : undefined}
      style={{ border: "1px solid var(--color-line)", borderRadius: 10, background: "var(--color-surface)", padding: "14px 16px 16px" }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <p id="bitacora-registrar" style={ETIQUETA}>
          Registrar
        </p>
        <div role="group" aria-label="Qué registrar" style={{ display: "flex", flexWrap: "wrap" }}>
          {opciones.map((opcion, i) => {
            const activa = opcion.key === modo;
            const primera = i === 0;
            const ultima = i === opciones.length - 1;
            return (
              <button
                key={opcion.key}
                type="button"
                className="bitacora-modo"
                aria-pressed={activa}
                onClick={() => setModo(opcion.key)}
                style={{
                  padding: "4px 12px",
                  fontSize: 12.5,
                  fontWeight: activa ? 600 : 500,
                  border: `1px solid ${activa ? "var(--color-accent)" : "var(--color-line)"}`,
                  marginLeft: primera ? 0 : -1,
                  borderRadius: primera ? "6px 0 0 6px" : ultima ? "0 6px 6px 0" : 0,
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

      {/* Todos quedan montados: cambiar de modo no pierde lo que se estaba escribiendo. */}
      <div hidden={modo !== "gestion"}>
        <FormularioGestion motivos={datos.motivos} canales={datos.canales} estado={acciones.gestion} />
      </div>
      <div hidden={modo !== "recordatorio"}>
        <FormularioRecordatorio equipo={datos.equipo} hoy={hoy} usuarioActual={usuarioActual} estado={acciones.recordatorio} />
      </div>
      {promesas && (
        <div hidden={modo !== "promesa"}>
          <FormularioPromesa canales={datos.canales} estado={promesas} alRegistrar={alRegistrarPromesa} />
        </div>
      )}
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
      className="bitacora-boton-enviar"
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

// Canal opcional en chips, compartido por Gestion y Promesa (la lista es la
// misma: viene de la respuesta de la Bitacora).
function SelectorCanal({
  id,
  canales,
  valor,
  error,
  onCambio,
}: {
  id: string;
  canales: string[];
  valor: string;
  error?: string;
  onCambio: (canal: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div id={id} style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 6 }}>
        Canal <span style={{ fontWeight: 400, color: "var(--color-muted)" }}>(opcional)</span>
      </div>
      <div role="radiogroup" aria-labelledby={id} className="bitacora-chips" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {canales.map((c) => {
          const activo = valor === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={activo}
              className="bitacora-chip"
              // Un segundo click lo deselecciona: el canal es opcional.
              onClick={() => onCambio(activo ? "" : c)}
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
      {error && <p style={ERROR}>{error}</p>}
    </div>
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
      {/* "Resultado", no "Motivo" (pedido de Claudia y Rosina, 30/09/2026): los
          valores dicen como quedo la gestion, no que accion se hizo. "Estado"
          se descarto por chocar con "Situacion de la cuenta", en esta misma
          ficha. El id y la clave de la API siguen diciendo "motivo"/"motivos". */}
      <Campo id="gestion-motivo" etiqueta="Resultado" error={errores.resultado}>
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
          <option value="">Elegí un resultado…</option>
          {motivos.map((m) => (
            <option key={m} value={m} style={{ color: "var(--color-ink)" }}>
              {m}
            </option>
          ))}
        </select>
      </Campo>

      <SelectorCanal id="gestion-canal" canales={canales} valor={form.canal} error={errores.canal} onCambio={(canal) => setForm({ ...form, canal })} />

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

const PROMESA_VACIA: FormPromesa = { fecha_prometida: "", importe: "", moneda: "", canal: "", facturas: "" };

function FormularioPromesa({
  canales,
  estado,
  alRegistrar,
}: {
  canales: string[];
  estado: EstadoPromesas;
  alRegistrar: () => void;
}) {
  const [form, setForm] = useState<FormPromesa>(PROMESA_VACIA);
  const [errores, setErrores] = useState<Errores<FormPromesa>>({});
  const [confirmacion, confirmar] = useConfirmacion();
  // "Hoy" en Montevideo, igual que el bloque de vigentes: la fecha minima y el
  // "vence hoy" nunca discrepan.
  const hoy = hoyUruguay();
  // Las monedas vienen del GET de promesas (no se duplica la lista). Sin
  // elegir, se propone la primera (UYU): es la que se usa casi siempre.
  const monedas = estado.datos?.monedas ?? [];
  const moneda = form.moneda || monedas[0] || "";
  const sinMonedas = monedas.length === 0;
  const errorMonedas = sinMonedas && estado.error && !estado.datos ? "No se pudieron cargar las monedas." : null;

  function cambiar(cambio: Partial<FormPromesa>) {
    setForm({ ...form, ...cambio });
    setErrores({ ...errores, ...Object.fromEntries(Object.keys(cambio).map((k) => [k, undefined])) });
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    const completo = { ...form, moneda };
    const nuevos = validarPromesa(completo, hoy, monedas, canales);
    setErrores(nuevos);
    if (hayErrores(nuevos)) return;
    const ok = await estado.registrar(armarPromesaRequest(completo));
    if (ok) {
      // Conserva la moneda: suele cargarse mas de una seguida en la misma.
      setForm({ ...PROMESA_VACIA, moneda: form.moneda });
      confirmar("Promesa registrada.");
      alRegistrar();
    }
  }

  const largoFacturas = form.facturas.trim().length;

  return (
    <form onSubmit={enviar} noValidate>
      <div className="bitacora-form-fila" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(0, 1fr)", gap: 10 }}>
        <Campo id="promesa-importe" etiqueta="Importe" error={errores.importe}>
          <input
            id="promesa-importe"
            className="bitacora-campo"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={form.importe}
            placeholder="Ej: 45.000"
            aria-invalid={Boolean(errores.importe)}
            aria-describedby={errores.importe ? "promesa-importe-error" : undefined}
            onChange={(e) => cambiar({ importe: e.target.value })}
            style={{ ...CAMPO, fontFamily: "var(--font-mono)", borderColor: errores.importe ? "var(--color-risk)" : undefined }}
          />
        </Campo>
        <Campo id="promesa-moneda" etiqueta="Moneda" error={errores.moneda}>
          <select
            id="promesa-moneda"
            className="bitacora-campo"
            value={moneda}
            disabled={sinMonedas}
            aria-invalid={Boolean(errores.moneda)}
            aria-describedby={errores.moneda ? "promesa-moneda-error" : undefined}
            onChange={(e) => cambiar({ moneda: e.target.value })}
            style={{ ...CAMPO, borderColor: errores.moneda ? "var(--color-risk)" : undefined }}
          >
            {sinMonedas && <option value="">{estado.error ? "—" : "Cargando…"}</option>}
            {monedas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Campo>
      </div>
      {errorMonedas && (
        <p role="alert" style={{ ...ERROR, margin: "-6px 0 12px" }}>
          {errorMonedas}{" "}
          <button type="button" className="promesas-boton-texto" onClick={() => void estado.recargar()}>
            Reintentar
          </button>
        </p>
      )}

      <Campo id="promesa-fecha" etiqueta="Fecha prometida" error={errores.fecha_prometida}>
        <input
          id="promesa-fecha"
          className="bitacora-campo"
          type="date"
          value={form.fecha_prometida}
          min={hoy}
          aria-invalid={Boolean(errores.fecha_prometida)}
          aria-describedby={errores.fecha_prometida ? "promesa-fecha-error" : undefined}
          onChange={(e) => cambiar({ fecha_prometida: e.target.value })}
          style={{ ...CAMPO, borderColor: errores.fecha_prometida ? "var(--color-risk)" : undefined }}
        />
      </Campo>

      <SelectorCanal id="promesa-canal" canales={canales} valor={form.canal} error={errores.canal} onCambio={(canal) => cambiar({ canal })} />

      <Campo id="promesa-facturas" etiqueta="Facturas" opcional error={errores.facturas}>
        <input
          id="promesa-facturas"
          className="bitacora-campo"
          type="text"
          autoComplete="off"
          value={form.facturas}
          placeholder="Ej: A-1234, A-1240"
          aria-invalid={Boolean(errores.facturas)}
          aria-describedby={errores.facturas ? "promesa-facturas-error" : undefined}
          onChange={(e) => cambiar({ facturas: e.target.value })}
          style={{ ...CAMPO, borderColor: errores.facturas ? "var(--color-risk)" : undefined }}
        />
        {largoFacturas > MAX_FACTURAS - 100 && (
          <div style={{ ...AYUDA, textAlign: "right", color: largoFacturas > MAX_FACTURAS ? "var(--color-risk)" : AYUDA.color }}>
            {largoFacturas}/{MAX_FACTURAS}
          </div>
        )}
      </Campo>

      <PieFormulario confirmacion={confirmacion} error={estado.errorRegistrar}>
        <BotonEnviar enviando={estado.enviando} texto="Registrar promesa" textoEnviando="Registrando…" />
      </PieFormulario>
    </form>
  );
}
