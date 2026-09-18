import { useCallback, useMemo, useState, type CSSProperties } from "react";
import { apiFetch } from "../api/client";
import type { CandidatoBandeja, DecisionResponse } from "../api/types";
import { useAccessToken } from "../auth/useAccessToken";
import { StatusTag } from "../components/StatusTag";
import { formatDate, formatMoney } from "../design/format";
import { coincideBusqueda, ordenarPorFechaDesc } from "./bandeja/busqueda";
import { variantParaEstadoBandeja } from "./bandeja/estado";
import { useCandidatos } from "./bandeja/useCandidatos";
import { OPCIONES_APROBAR, useDecision } from "./bandeja/useDecision";

type FiltroEstado = "Todos" | "Pendiente" | "Rechazado";

export function BandejaPage() {
  const getAccessToken = useAccessToken();
  const { candidatos, loading, error, recargar } = useCandidatos();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("Pendiente");
  const [seleccionado, setSeleccionado] = useState<CandidatoBandeja | null>(null);
  const [opcionAprobar, setOpcionAprobar] = useState<(typeof OPCIONES_APROBAR)[number] | null>(null);
  const [mensajeError, setMensajeError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  const candidatosOrdenados = useMemo(() => ordenarPorFechaDesc(candidatos), [candidatos]);
  const candidatosFiltrados = useMemo(
    () =>
      candidatosOrdenados
        .filter((c) => filtroEstado === "Todos" || c.status_aprobacion === filtroEstado)
        .filter((c) => coincideBusqueda(c, busqueda)),
    [candidatosOrdenados, busqueda, filtroEstado]
  );
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

  const { enviando, error: errorDecision, decidir, limpiarError } = useDecision(postDecision);

  function seleccionar(c: CandidatoBandeja) {
    setSeleccionado(c);
    setOpcionAprobar(null);
    setMensajeError(null);
    setMensajeExito(null);
    limpiarError();
  }

  async function aprobar() {
    if (!seleccionado || !opcionAprobar) return;
    if (seleccionado.doc_entry == null || seleccionado.doc_num == null || seleccionado.card_code == null) {
      setMensajeError("Este pedido no tiene los datos necesarios para decidir.");
      return;
    }
    const resultado = await decidir({
      docEntry: seleccionado.doc_entry,
      cardCode: seleccionado.card_code,
      docNum: seleccionado.doc_num,
      decision: "approved",
      motivo: opcionAprobar,
    });
    if (resultado) {
      setSeleccionado(null);
      setOpcionAprobar(null);
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

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-display)", margin: 0 }}>Pedidos pendientes de autorización</h1>
        <div style={{ display: "flex", gap: 6 }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
        <div style={{ width: 1, height: 22, background: "var(--color-line)" }} />
        <div style={{ fontSize: 12.5, color: "var(--color-muted)" }}>
          Ordenado por fecha de pedido, más reciente primero
        </div>
      </div>

      {error && <p style={{ color: "var(--color-risk)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--color-muted)" }}>Cargando pedidos...</p>}

      {!loading && !error && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "520px 1fr", gap: 20, overflow: "hidden" }}>
          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {candidatosFiltrados.length === 0 ? (
              <p style={{ padding: 18, color: "var(--color-muted)" }}>
                {candidatos.length === 0
                  ? "No hay pedidos pendientes de autorización."
                  : "Ningún pedido coincide con la búsqueda."}
              </p>
            ) : (
              candidatosFiltrados.map((c) => (
                <FilaCola
                  key={c.doc_entry ?? c.doc_num ?? Math.random()}
                  candidato={c}
                  activa={seleccionado?.doc_entry === c.doc_entry}
                  onClick={() => seleccionar(c)}
                />
              ))
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
                          onChange={() => setOpcionAprobar(opcion)}
                          disabled={enviando}
                        />
                        {opcion}
                      </label>
                    ))}
                  </div>

                  {mensajeError && <p style={{ color: "var(--color-risk)" }}>{mensajeError}</p>}
                  {errorDecision && <p style={{ color: "var(--color-risk)" }}>{errorDecision}</p>}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={aprobar} disabled={enviando || !opcionAprobar}>
                      {enviando ? "Aprobando..." : "Aprobar"}
                    </button>
                    <button onClick={rechazar} disabled={enviando}>
                      {enviando ? "Rechazando..." : "Rechazar"}
                    </button>
                    <button onClick={() => setSeleccionado(null)} disabled={enviando}>
                      Cancelar
                    </button>
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

function Estadistica({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--color-muted)" }}>{etiqueta}</div>
      <div style={{ fontFamily: mono ? "var(--font-mono)" : undefined, fontSize: 16, marginTop: 3 }}>{valor}</div>
    </div>
  );
}

function FilaCola({
  candidato,
  activa,
  onClick,
}: {
  candidato: CandidatoBandeja;
  activa: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 18px",
        borderTop: "1px solid var(--color-line)",
        cursor: "pointer",
        background: activa ? "var(--color-accent-ink)" : undefined,
        color: activa ? "#fff" : undefined,
      }}
    >
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
  );
}
