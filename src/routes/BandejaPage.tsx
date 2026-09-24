import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { apiFetch } from "../api/client";
import type {
  AdjuntoRequest,
  CandidatoBandeja,
  DecisionMultipleRequest,
  DecisionMultipleResponse,
  DecisionResponse,
} from "../api/types";
import { useAccessToken } from "../auth/useAccessToken";
import { StatusTag } from "../components/StatusTag";
import { formatDate, formatMoney } from "../design/format";
import { agruparPorCliente, type GrupoCliente } from "./bandeja/agrupar";
import { coincideBusqueda, ordenarPorFechaDesc } from "./bandeja/busqueda";
import { variantParaEstadoBandeja } from "./bandeja/estado";
import { useCandidatos } from "./bandeja/useCandidatos";
import { OPCIONES_APROBAR, OPCION_CON_ADJUNTO, useDecision } from "./bandeja/useDecision";
import { useDecisionMultiple, type ResultadoDecisionMultiple } from "./bandeja/useDecisionMultiple";

type FiltroEstado = "Todos" | "Pendiente" | "Rechazado";

const TAMANO_MAXIMO_ADJUNTO_BYTES = 10 * 1024 * 1024;
const TIPOS_ADJUNTO_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function archivoABase64(archivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      // data:<mime>;base64,<contenido> - solo interesa la parte de despues de la coma.
      resolve(resultado.slice(resultado.indexOf(",") + 1));
    };
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

function validarArchivo(archivo: File): string | null {
  if (archivo.size > TAMANO_MAXIMO_ADJUNTO_BYTES) {
    return "El archivo supera el tamaño máximo permitido (10 MB).";
  }
  if (!TIPOS_ADJUNTO_PERMITIDOS.includes(archivo.type)) {
    return "Tipo de archivo no permitido. Usá imagen, PDF o Word.";
  }
  return null;
}

async function archivoAAdjuntoRequest(archivo: File): Promise<AdjuntoRequest> {
  return {
    nombreArchivo: archivo.name,
    contenidoBase64: await archivoABase64(archivo),
    contentType: archivo.type,
  };
}

export function BandejaPage() {
  const getAccessToken = useAccessToken();
  const { candidatos, loading, error, recargar } = useCandidatos();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("Pendiente");
  const [seleccionado, setSeleccionado] = useState<CandidatoBandeja | null>(null);
  const [opcionAprobar, setOpcionAprobar] = useState<(typeof OPCIONES_APROBAR)[number] | null>(null);
  const [archivoAdjunto, setArchivoAdjunto] = useState<File | null>(null);
  const [errorAdjunto, setErrorAdjunto] = useState<string | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [seleccionMultiple, setSeleccionMultiple] = useState<Set<number>>(new Set());
  const [gruposColapsados, setGruposColapsados] = useState<Set<string>>(new Set());
  const [opcionAprobarMultiple, setOpcionAprobarMultiple] = useState<(typeof OPCIONES_APROBAR)[number] | null>(null);
  const [archivoAdjuntoMultiple, setArchivoAdjuntoMultiple] = useState<File | null>(null);
  const [errorAdjuntoMultiple, setErrorAdjuntoMultiple] = useState<string | null>(null);

  const candidatosOrdenados = useMemo(() => ordenarPorFechaDesc(candidatos), [candidatos]);
  const candidatosFiltrados = useMemo(
    () =>
      candidatosOrdenados
        .filter((c) => filtroEstado === "Todos" || c.status_aprobacion === filtroEstado)
        .filter((c) => coincideBusqueda(c, busqueda)),
    [candidatosOrdenados, busqueda, filtroEstado]
  );
  const gruposFiltrados = useMemo(() => agruparPorCliente(candidatosFiltrados), [candidatosFiltrados]);
  const cantidadPendientes = candidatos.filter((c) => c.status_aprobacion === "Pendiente").length;
  const cantidadRechazados = candidatos.filter((c) => c.status_aprobacion === "Rechazado").length;

  const postDecision = useCallback(
    async (
      docEntry: number,
      body: { cardCode: string; docNum: number; decision: "approved" | "rejected"; motivo?: string }
    ): Promise<DecisionResponse> => {
      const token = await getAccessToken();
      return apiFetch<DecisionResponse>(`/api/bandeja/pedidos/${docEntry}/decision`, {
        token,
        method: "POST",
        body,
      });
    },
    [getAccessToken]
  );

  const postDecisionMultiple = useCallback(
    async (body: DecisionMultipleRequest): Promise<DecisionMultipleResponse> => {
      const token = await getAccessToken();
      return apiFetch<DecisionMultipleResponse>("/api/bandeja/pedidos/decision-multiple", {
        token,
        method: "POST",
        body,
      });
    },
    [getAccessToken]
  );

  const {
    enviando,
    segundosTranscurridos: segundosTranscurridosDecision,
    error: errorDecision,
    decidir,
    limpiarError,
  } = useDecision(postDecision);
  const { procesando, segundosTranscurridos, resultados, decidirVarios, limpiarResultados } =
    useDecisionMultiple(postDecisionMultiple);

  function alternarSeleccionMultiple(docEntry: number) {
    setSeleccionMultiple((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(docEntry)) {
        nuevo.delete(docEntry);
      } else {
        nuevo.add(docEntry);
      }
      return nuevo;
    });
    limpiarResultados();
  }

  function alternarSeleccionGrupo(grupo: GrupoCliente) {
    const docEntries = grupo.pedidos
      .map((p) => p.doc_entry)
      .filter((d): d is number => d != null);
    if (docEntries.length === 0) return;
    const todosMarcados = docEntries.every((d) => seleccionMultiple.has(d));
    setSeleccionMultiple((previo) => {
      const nuevo = new Set(previo);
      docEntries.forEach((d) => (todosMarcados ? nuevo.delete(d) : nuevo.add(d)));
      return nuevo;
    });
    limpiarResultados();
  }

  function alternarColapso(clave: string) {
    setGruposColapsados((previo) => {
      const nuevo = new Set(previo);
      if (nuevo.has(clave)) {
        nuevo.delete(clave);
      } else {
        nuevo.add(clave);
      }
      return nuevo;
    });
  }

  function limpiarSeleccionMultiple() {
    setSeleccionMultiple(new Set());
    setOpcionAprobarMultiple(null);
    setArchivoAdjuntoMultiple(null);
    setErrorAdjuntoMultiple(null);
    limpiarResultados();
  }

  function elegirOpcionAprobarMultiple(opcion: (typeof OPCIONES_APROBAR)[number]) {
    setOpcionAprobarMultiple(opcion);
    setArchivoAdjuntoMultiple(null);
    setErrorAdjuntoMultiple(null);
  }

  function elegirArchivoMultiple(archivo: File | null) {
    setErrorAdjuntoMultiple(null);
    if (!archivo) {
      setArchivoAdjuntoMultiple(null);
      return;
    }
    const error = validarArchivo(archivo);
    if (error) {
      setErrorAdjuntoMultiple(error);
      setArchivoAdjuntoMultiple(null);
      return;
    }
    setArchivoAdjuntoMultiple(archivo);
  }

  const candidatosSeleccionados = useMemo(
    () => candidatosFiltrados.filter((c) => c.doc_entry != null && seleccionMultiple.has(c.doc_entry)),
    [candidatosFiltrados, seleccionMultiple]
  );

  async function decidirSeleccionMultiple(decision: "approved" | "rejected") {
    const pedidos = candidatosSeleccionados
      .filter((c) => c.doc_entry != null && c.doc_num != null && c.card_code != null)
      .map((c) => ({ docEntry: c.doc_entry as number, docNum: c.doc_num as number, cardCode: c.card_code as string }));
    if (pedidos.length === 0) return;

    let adjunto: AdjuntoRequest | undefined;
    if (decision === "approved" && opcionAprobarMultiple === OPCION_CON_ADJUNTO && archivoAdjuntoMultiple) {
      adjunto = await archivoAAdjuntoRequest(archivoAdjuntoMultiple);
    }

    const items = await decidirVarios({
      pedidos,
      decision,
      motivo: decision === "approved" ? (opcionAprobarMultiple ?? undefined) : undefined,
      adjunto,
    });
    const exitosos = items.filter((r) => r.ok).length;
    if (exitosos === items.length) {
      setMensajeExito(`${exitosos} pedido${exitosos === 1 ? "" : "s"} ${decision === "approved" ? "aprobado" : "rechazado"}${exitosos === 1 ? "" : "s"}.`);
      limpiarSeleccionMultiple();
    } else {
      // Se dejan marcados solo los que fallaron, para poder reintentar sin
      // tener que volver a elegir todo el lote de nuevo.
      setSeleccionMultiple(new Set(items.filter((r) => !r.ok).map((r) => r.docEntry)));
    }
    recargar();
  }

  function seleccionar(c: CandidatoBandeja) {
    setSeleccionado(c);
    setOpcionAprobar(null);
    setArchivoAdjunto(null);
    setErrorAdjunto(null);
    setMensajeError(null);
    setMensajeExito(null);
    limpiarError();
  }

  function elegirArchivo(archivo: File | null) {
    setErrorAdjunto(null);
    if (!archivo) {
      setArchivoAdjunto(null);
      return;
    }
    const error = validarArchivo(archivo);
    if (error) {
      setErrorAdjunto(error);
      setArchivoAdjunto(null);
      return;
    }
    setArchivoAdjunto(archivo);
  }

  async function aprobar() {
    if (!seleccionado || !opcionAprobar) return;
    if (seleccionado.doc_entry == null || seleccionado.doc_num == null || seleccionado.card_code == null) {
      setMensajeError("Este pedido no tiene los datos necesarios para decidir.");
      return;
    }
    let adjunto: AdjuntoRequest | undefined;
    if (opcionAprobar === OPCION_CON_ADJUNTO && archivoAdjunto) {
      adjunto = await archivoAAdjuntoRequest(archivoAdjunto);
    }
    const resultado = await decidir({
      docEntry: seleccionado.doc_entry,
      cardCode: seleccionado.card_code,
      docNum: seleccionado.doc_num,
      decision: "approved",
      motivo: opcionAprobar,
      adjunto,
    });
    if (resultado) {
      setSeleccionado(null);
      setOpcionAprobar(null);
      setArchivoAdjunto(null);
      setMensajeExito(
        resultado.sap_status === "ejecutado"
          ? "Decisión registrada y enviada a SAP."
          : "Decisión registrada localmente. Todavía no se envió a SAP."
      );
      recargar();
    }
  }

  async function rechazar() {
    if (!seleccionado) return;
    if (seleccionado.doc_entry == null || seleccionado.doc_num == null || seleccionado.card_code == null) {
      setMensajeError("Este pedido no tiene los datos necesarios para decidir.");
      return;
    }
    const resultado = await decidir({
      docEntry: seleccionado.doc_entry,
      cardCode: seleccionado.card_code,
      docNum: seleccionado.doc_num,
      decision: "rejected",
    });
    if (resultado) {
      setSeleccionado(null);
      setMensajeExito(
        resultado.sap_status === "ejecutado"
          ? "Decisión registrada y enviada a SAP."
          : "Decisión registrada localmente. Todavía no se envió a SAP."
      );
      recargar();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "calc(100vh - 96px)" }}>
      {mensajeExito && (
        <div
          style={{
            padding: "10px 16px",
            background: "var(--color-ok-soft)",
            border: "1px solid var(--color-ok-soft)",
            borderRadius: 8,
            fontSize: 12.5,
            color: "var(--color-ok)",
          }}
        >
          <strong>✓ {mensajeExito}</strong>
        </div>
      )}

      <div className="bandeja-header-row" style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 className="bandeja-titulo" style={{ fontFamily: "var(--font-display)", margin: 0 }}>
          Pedidos pendientes de autorización
        </h1>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={chipStyle(filtroEstado === "Todos")} onClick={() => setFiltroEstado("Todos")}>
            Todos · {candidatos.length}
          </button>
          <button style={chipStyle(filtroEstado === "Pendiente")} onClick={() => setFiltroEstado("Pendiente")}>
            Pendiente · {cantidadPendientes}
          </button>
          <button style={chipStyle(filtroEstado === "Rechazado")} onClick={() => setFiltroEstado("Rechazado")}>
            Rechazado · {cantidadRechazados}
          </button>
        </div>
      </div>

      <div className="bandeja-filter-row" style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por cliente o vendedor..."
          style={{
            width: 340,
            padding: "9px 14px",
            border: "1px solid var(--color-line)",
            borderRadius: 8,
            fontSize: 13,
            background: "var(--color-surface)",
          }}
        />
        <div className="bandeja-sort-hint" style={{ width: 1, height: 22, background: "var(--color-line)" }} />
        <div className="bandeja-sort-hint" style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
          Ordenado por fecha de pedido, más reciente primero
        </div>
      </div>

      {error && <p style={{ color: "var(--color-risk)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--color-muted)" }}>Cargando pedidos...</p>}

      {!loading && !error && (
        <div
          className="bandeja-grid"
          data-selected={seleccionado != null}
          style={{ flex: 1, display: "grid", gridTemplateColumns: "520px 1fr", gap: 20, overflow: "hidden" }}
        >
          <div
            className="bandeja-queue"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {seleccionMultiple.size > 0 && (
              <BarraSeleccionMultiple
                cantidad={seleccionMultiple.size}
                opcionAprobar={opcionAprobarMultiple}
                onElegirOpcion={elegirOpcionAprobarMultiple}
                archivoAdjunto={archivoAdjuntoMultiple}
                errorAdjunto={errorAdjuntoMultiple}
                onElegirArchivo={elegirArchivoMultiple}
                procesando={procesando}
                segundosTranscurridos={segundosTranscurridos}
                resultados={resultados}
                onAprobar={() => decidirSeleccionMultiple("approved")}
                onRechazar={() => decidirSeleccionMultiple("rejected")}
                onCancelar={limpiarSeleccionMultiple}
              />
            )}
            {candidatosFiltrados.length === 0 ? (
              <p style={{ padding: 18, color: "var(--color-muted)" }}>
                {candidatos.length === 0
                  ? "No hay pedidos pendientes de autorización."
                  : "Ningún pedido coincide con la búsqueda."}
              </p>
            ) : (
              gruposFiltrados.map((grupo) => {
                const docEntries = grupo.pedidos.map((p) => p.doc_entry).filter((d): d is number => d != null);
                const seleccionTotal = docEntries.length > 0 && docEntries.every((d) => seleccionMultiple.has(d));
                const seleccionParcial = docEntries.some((d) => seleccionMultiple.has(d));
                const colapsado = gruposColapsados.has(grupo.clave);
                return (
                  <div key={grupo.clave}>
                    <EncabezadoGrupo
                      grupo={grupo}
                      colapsado={colapsado}
                      onToggleColapso={() => alternarColapso(grupo.clave)}
                      seleccionTotal={seleccionTotal}
                      seleccionParcial={seleccionParcial}
                      onToggleSeleccionGrupo={() => alternarSeleccionGrupo(grupo)}
                    />
                    {!colapsado &&
                      grupo.pedidos.map((c) => (
                        <FilaCola
                          key={c.doc_entry ?? c.doc_num ?? Math.random()}
                          candidato={c}
                          activa={seleccionado?.doc_entry === c.doc_entry}
                          marcado={c.doc_entry != null && seleccionMultiple.has(c.doc_entry)}
                          procesando={procesando && c.doc_entry != null && seleccionMultiple.has(c.doc_entry)}
                          onClick={() => seleccionar(c)}
                          onToggleMarcado={c.doc_entry != null ? () => alternarSeleccionMultiple(c.doc_entry as number) : undefined}
                        />
                      ))}
                  </div>
                );
              })
            )}
            {candidatosFiltrados.length > 0 && (
              <div
                style={{
                  padding: "12px 18px",
                  textAlign: "center",
                  fontSize: 11.5,
                  color: "var(--color-muted)",
                  borderTop: "1px solid var(--color-line)",
                }}
              >
                {candidatosFiltrados.length} pedido{candidatosFiltrados.length === 1 ? "" : "s"}
              </div>
            )}
          </div>

          <div
            className="bandeja-detail"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {!seleccionado ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--color-muted)",
                  fontSize: 13,
                }}
              >
                Seleccioná un pedido de la lista para ver el detalle.
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid var(--color-line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <button
                      className="bandeja-back-mobile"
                      onClick={() => setSeleccionado(null)}
                      style={{
                        alignItems: "center",
                        gap: 6,
                        border: "none",
                        background: "none",
                        padding: 0,
                        marginBottom: 10,
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--color-accent)",
                        cursor: "pointer",
                      }}
                    >
                      ← Volver a la lista
                    </button>
                    <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, margin: 0 }}>
                      {seleccionado.card_name ?? "—"}
                    </h2>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-muted)", marginTop: 3 }}>
                      Pedido {seleccionado.doc_num ?? "—"} · {formatDate(seleccionado.doc_date)}
                      {seleccionado.hora_pedido ? ` ${seleccionado.hora_pedido}` : ""} ·{" "}
                      {seleccionado.card_code ?? "—"}
                    </div>
                  </div>
                  <StatusTag variant={variantParaEstadoBandeja(seleccionado.status_aprobacion)}>
                    {seleccionado.status_aprobacion ?? "—"}
                  </StatusTag>
                </div>

                <div style={{ padding: "20px 24px", flex: 1, overflow: "auto" }}>
                  <div style={{ display: "flex", gap: 32, marginBottom: 20, flexWrap: "wrap" }}>
                    <Estadistica etiqueta="Importe" valor={formatMoney(seleccionado.importe, seleccionado.moneda)} mono />
                    <Estadistica etiqueta="Moneda" valor={seleccionado.moneda ?? "—"} />
                    <Estadistica etiqueta="Vendedor" valor={seleccionado.vendedor ?? "—"} />
                    <Estadistica etiqueta="Cond. de pago" valor={seleccionado.condicion_pago ?? "—"} />
                  </div>

                  {seleccionado.cliente_suspendido && (
                    <p>
                      <StatusTag variant="risk">Cliente suspendido</StatusTag>
                    </p>
                  )}

                  {seleccionado.nro_referencia_externa && (
                    <>
                      <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
                        Referencia externa (Rondanet/Mercarea)
                      </div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, marginBottom: 18 }}>
                        {seleccionado.nro_referencia_externa}
                      </div>
                    </>
                  )}

                  {seleccionado.comentarios && (
                    <>
                      <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 8, fontWeight: 500 }}>
                        Comentario del pedido
                      </div>
                      <div
                        style={{
                          background: "var(--color-paper)",
                          borderRadius: 8,
                          padding: "14px 16px",
                          fontSize: 13,
                          lineHeight: 1.6,
                        }}
                      >
                        {seleccionado.comentarios}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ padding: "18px 24px", background: "var(--color-paper)", borderTop: "1px solid var(--color-line)" }}>
                  <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, fontWeight: 500 }}>
                    Aprobar — motivo (obligatorio, elegir uno)
                  </p>
                  <div style={{ display: "flex", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
                    {OPCIONES_APROBAR.map((opcion) => (
                      <label key={opcion} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                        <input
                          type="radio"
                          name="opcion-aprobar"
                          value={opcion}
                          checked={opcionAprobar === opcion}
                          onChange={() => {
                            setOpcionAprobar(opcion);
                            setArchivoAdjunto(null);
                            setErrorAdjunto(null);
                          }}
                          disabled={enviando}
                        />
                        {opcion}
                      </label>
                    ))}
                  </div>

                  {opcionAprobar === OPCION_CON_ADJUNTO && (
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12.5, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                        Adjuntar archivo (opcional — imagen, PDF o Word, máx. 10 MB)
                      </label>
                      <input
                        type="file"
                        accept={TIPOS_ADJUNTO_PERMITIDOS.join(",")}
                        onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
                        disabled={enviando}
                        style={{ fontSize: 13 }}
                      />
                      {archivoAdjunto && (
                        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 4 }}>
                          {archivoAdjunto.name} ({Math.round(archivoAdjunto.size / 1024)} KB)
                        </p>
                      )}
                      {errorAdjunto && <p style={{ color: "var(--color-risk)", fontSize: 12 }}>{errorAdjunto}</p>}
                    </div>
                  )}

                  {mensajeError && <p style={{ color: "var(--color-risk)" }}>{mensajeError}</p>}
                  {errorDecision && <p style={{ color: "var(--color-risk)" }}>{errorDecision}</p>}

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button style={botonAccionStyle} onClick={aprobar} disabled={enviando || !opcionAprobar}>
                      {enviando ? "Aprobando..." : "Aprobar"}
                    </button>
                    <button style={botonAccionStyle} onClick={rechazar} disabled={enviando}>
                      {enviando ? "Rechazando..." : "Rechazar"}
                    </button>
                    <button style={botonAccionStyle} onClick={() => setSeleccionado(null)} disabled={enviando}>
                      Cancelar
                    </button>
                    {enviando && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--color-muted)" }}>
                        <span className="spinner" />
                        {segundosTranscurridosDecision}s
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const botonAccionStyle: CSSProperties = {
  minHeight: 44,
  padding: "10px 20px",
  fontSize: 14,
};

function chipStyle(activo: boolean): CSSProperties {
  return {
    fontSize: 12.5,
    fontWeight: 500,
    padding: "6px 14px",
    borderRadius: 20,
    border: "none",
    cursor: "pointer",
    background: activo ? "var(--color-ink)" : "transparent",
    color: activo ? "#fff" : "var(--color-muted)",
  };
}

function BarraSeleccionMultiple({
  cantidad,
  opcionAprobar,
  onElegirOpcion,
  archivoAdjunto,
  errorAdjunto,
  onElegirArchivo,
  procesando,
  segundosTranscurridos,
  resultados,
  onAprobar,
  onRechazar,
  onCancelar,
}: {
  cantidad: number;
  opcionAprobar: (typeof OPCIONES_APROBAR)[number] | null;
  onElegirOpcion: (opcion: (typeof OPCIONES_APROBAR)[number]) => void;
  archivoAdjunto: File | null;
  errorAdjunto: string | null;
  onElegirArchivo: (archivo: File | null) => void;
  procesando: boolean;
  segundosTranscurridos: number;
  resultados: ResultadoDecisionMultiple[] | null;
  onAprobar: () => void;
  onRechazar: () => void;
  onCancelar: () => void;
}) {
  const fallidos = resultados?.filter((r) => !r.ok) ?? [];

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 5,
        padding: "14px 18px",
        background: "var(--color-accent-soft)",
        borderBottom: "1px solid var(--color-accent)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <strong style={{ fontSize: 13.5 }}>{cantidad} seleccionado{cantidad === 1 ? "" : "s"}</strong>
        <button
          onClick={onCancelar}
          disabled={procesando}
          style={{ border: "none", background: "none", fontSize: 12.5, color: "var(--color-accent-ink)", cursor: "pointer", padding: "4px 8px" }}
        >
          Cancelar
        </button>
      </div>

      {fallidos.length > 0 && (
        <div style={{ marginBottom: 10, fontSize: 12.5 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--color-risk)" }}>
            {fallidos.length} pedido{fallidos.length === 1 ? "" : "s"} no se pudo procesar — sigue{fallidos.length === 1 ? "" : "n"} seleccionado{fallidos.length === 1 ? "" : "s"} para reintentar:
          </p>
          {fallidos.map((f) => (
            <p key={f.docEntry} style={{ margin: "2px 0", color: "var(--color-risk)" }}>
              Pedido {f.docNum}: {f.mensaje}
            </p>
          ))}
        </div>
      )}

      {procesando ? (
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span className="spinner" />
          Procesando {cantidad} pedido{cantidad === 1 ? "" : "s"}... {segundosTranscurridos}s
        </p>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
            {OPCIONES_APROBAR.map((opcion) => (
              <label key={opcion} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="opcion-aprobar-multiple"
                  value={opcion}
                  checked={opcionAprobar === opcion}
                  onChange={() => onElegirOpcion(opcion)}
                />
                {opcion}
              </label>
            ))}
          </div>
          {opcionAprobar === OPCION_CON_ADJUNTO && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, color: "var(--color-muted)", display: "block", marginBottom: 6 }}>
                Adjuntar archivo (opcional — se sube una copia a cada pedido seleccionado, máx. 10 MB)
              </label>
              <input
                type="file"
                accept={TIPOS_ADJUNTO_PERMITIDOS.join(",")}
                onChange={(e) => onElegirArchivo(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12.5 }}
              />
              {archivoAdjunto && (
                <p style={{ fontSize: 11.5, color: "var(--color-muted)", marginTop: 4 }}>
                  {archivoAdjunto.name} ({Math.round(archivoAdjunto.size / 1024)} KB) — se sube a los {cantidad} pedidos seleccionados
                </p>
              )}
              {errorAdjunto && <p style={{ color: "var(--color-risk)", fontSize: 11.5 }}>{errorAdjunto}</p>}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button style={botonAccionStyle} onClick={onAprobar} disabled={!opcionAprobar}>
              Aprobar {cantidad}
            </button>
            <button style={botonAccionStyle} onClick={onRechazar}>
              Rechazar {cantidad}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Estadistica({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{etiqueta}</div>
      <div style={{ fontFamily: mono ? "var(--font-mono)" : undefined, fontSize: 16, marginTop: 3 }}>{valor}</div>
    </div>
  );
}

function EncabezadoGrupo({
  grupo,
  colapsado,
  onToggleColapso,
  seleccionTotal,
  seleccionParcial,
  onToggleSeleccionGrupo,
}: {
  grupo: GrupoCliente;
  colapsado: boolean;
  onToggleColapso: () => void;
  seleccionTotal: boolean;
  seleccionParcial: boolean;
  onToggleSeleccionGrupo: () => void;
}) {
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = !seleccionTotal && seleccionParcial;
    }
  }, [seleccionTotal, seleccionParcial]);

  const nombre = grupo.cardName ?? grupo.cardCode ?? "Cliente sin nombre";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 18px 9px 12px",
        background: "var(--color-paper)",
        borderTop: "1px solid var(--color-line)",
      }}
    >
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={seleccionTotal}
        onChange={onToggleSeleccionGrupo}
        style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
        aria-label={`Seleccionar todos los pedidos de ${nombre}`}
      />
      <button
        type="button"
        onClick={onToggleColapso}
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          padding: 0,
          font: "inherit",
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>
          {colapsado ? "▸" : "▾"} {nombre}
        </span>
        <span style={{ fontSize: 11.5, color: "var(--color-muted)" }}>
          {grupo.pedidos.length} pedido{grupo.pedidos.length === 1 ? "" : "s"}
        </span>
      </button>
    </div>
  );
}

function FilaCola({
  candidato,
  activa,
  marcado,
  procesando,
  onClick,
  onToggleMarcado,
}: {
  candidato: CandidatoBandeja;
  activa: boolean;
  marcado: boolean;
  procesando?: boolean;
  onClick: () => void;
  onToggleMarcado?: () => void;
}) {
  return (
    <div
      onClick={procesando ? undefined : onClick}
      style={{
        padding: "14px 18px 14px 12px",
        borderTop: "1px solid var(--color-line)",
        cursor: procesando ? "default" : "pointer",
        display: "flex",
        gap: 8,
        opacity: procesando ? 0.6 : 1,
        background: activa ? "var(--color-accent-ink)" : marcado ? "var(--color-accent-soft)" : undefined,
        color: activa ? "#fff" : undefined,
      }}
    >
      {onToggleMarcado && (
        // Zona de tap generosa (44x44) para que sea comodo marcar desde el celular -
        // el checkbox visual es chico, pero el area clickeable no.
        <label
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            width: 32,
            minHeight: 44,
            paddingTop: 14,
            flexShrink: 0,
            cursor: procesando ? "default" : "pointer",
          }}
        >
          {procesando ? (
            <span className="spinner" style={{ color: "var(--color-accent)", marginTop: 2 }} />
          ) : (
            <input
              type="checkbox"
              checked={marcado}
              onChange={onToggleMarcado}
              style={{ width: 18, height: 18, cursor: "pointer" }}
              aria-label={`Seleccionar pedido ${candidato.doc_num ?? ""}`}
            />
          )}
        </label>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{candidato.card_name ?? "—"}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
          {formatMoney(candidato.importe, candidato.moneda)}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            color: activa ? "rgba(255,255,255,.75)" : "var(--color-muted)",
          }}
        >
          Pedido {candidato.doc_num ?? "—"} · {candidato.card_code ?? "—"}
        </span>
        <span style={{ fontSize: 11.5, color: activa ? "rgba(255,255,255,.75)" : "var(--color-muted)" }}>
          {formatDate(candidato.doc_date)}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: activa ? "rgba(255,255,255,.75)" : "var(--color-muted)" }}>
          {candidato.vendedor ?? "—"}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "2px 9px",
            borderRadius: 20,
            background: activa ? "rgba(255,255,255,.15)" : "var(--color-paper)",
            color: activa ? "#fff" : "var(--color-muted)",
          }}
        >
          {candidato.moneda ?? "—"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <StatusTag variant={variantParaEstadoBandeja(candidato.status_aprobacion)}>
          {candidato.status_aprobacion ?? "—"}
        </StatusTag>
        {candidato.cliente_suspendido && <StatusTag variant="caution">Cliente suspendido</StatusTag>}
      </div>
      </div>
    </div>
  );
}
