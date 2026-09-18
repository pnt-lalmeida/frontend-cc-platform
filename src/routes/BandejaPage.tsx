import { useCallback, useState } from "react";
import { apiFetch } from "../api/client";
import type { CandidatoBandeja, DecisionResponse } from "../api/types";
import { useAccessToken } from "../auth/useAccessToken";
import { StatusTag } from "../components/StatusTag";
import { Table, type TableColumn } from "../components/Table";
import { formatDate, formatMoney } from "../design/format";
import { variantParaEstadoBandeja } from "./bandeja/estado";
import { useCandidatos } from "./bandeja/useCandidatos";
import { OPCIONES_APROBAR, useDecision } from "./bandeja/useDecision";

const COLUMNAS_CANDIDATOS: TableColumn<CandidatoBandeja>[] = [
  {
    key: "doc_num",
    header: "N° pedido",
    render: (c) => String(c.doc_num ?? "—"),
    sortValue: (c) => c.doc_num ?? 0,
  },
  {
    key: "cliente",
    header: "Cliente",
    render: (c) => `${c.card_name ?? "—"} (${c.card_code ?? "—"})`,
  },
  {
    key: "importe",
    header: "Importe",
    align: "right",
    render: (c) => formatMoney(c.importe, c.moneda),
    sortValue: (c) => c.importe ?? 0,
  },
  { key: "vendedor", header: "Vendedor", render: (c) => c.vendedor ?? "—" },
  { key: "condicion_pago", header: "Cond. pago", render: (c) => c.condicion_pago ?? "—" },
  {
    key: "status_aprobacion",
    header: "Estado",
    render: (c) => (
      <StatusTag variant={variantParaEstadoBandeja(c.status_aprobacion)}>
        {c.status_aprobacion ?? "—"}
      </StatusTag>
    ),
  },
];

export function BandejaPage() {
  const getAccessToken = useAccessToken();
  const { candidatos, loading, error, recargar } = useCandidatos();
  const [seleccionado, setSeleccionado] = useState<CandidatoBandeja | null>(null);
  const [opcionAprobar, setOpcionAprobar] = useState<string | null>(null);

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

  const { enviando, error: errorDecision, decidir } = useDecision(postDecision);

  async function aprobar() {
    if (!seleccionado || !opcionAprobar) return;
    if (seleccionado.doc_entry == null || seleccionado.doc_num == null) return;
    const resultado = await decidir({
      docEntry: seleccionado.doc_entry,
      cardCode: seleccionado.card_code ?? "",
      docNum: seleccionado.doc_num,
      decision: "approved",
      motivo: opcionAprobar,
    });
    if (resultado) {
      setSeleccionado(null);
      setOpcionAprobar(null);
      recargar();
    }
  }

  async function rechazar() {
    if (!seleccionado) return;
    if (seleccionado.doc_entry == null || seleccionado.doc_num == null) return;
    const resultado = await decidir({
      docEntry: seleccionado.doc_entry,
      cardCode: seleccionado.card_code ?? "",
      docNum: seleccionado.doc_num,
      decision: "rejected",
    });
    if (resultado) {
      setSeleccionado(null);
      recargar();
    }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Bandeja de autorización</h1>

      {error && <p style={{ color: "var(--color-risk)" }}>{error}</p>}
      {loading && <p style={{ color: "var(--color-muted)" }}>Cargando pedidos...</p>}

      {!loading && !error && candidatos.length === 0 && (
        <p style={{ color: "var(--color-muted)" }}>No hay pedidos pendientes de autorización.</p>
      )}

      {!loading && candidatos.length > 0 && (
        <Table
          columns={COLUMNAS_CANDIDATOS}
          rows={candidatos}
          rowKey={(c) => c.doc_entry ?? c.doc_num ?? 0}
          onRowClick={(c) => {
            setSeleccionado(c);
            setOpcionAprobar(null);
          }}
        />
      )}

      {seleccionado && (
        <div
          style={{
            marginTop: 24,
            padding: 20,
            border: "1px solid var(--color-line)",
            borderRadius: 8,
            background: "var(--color-surface)",
          }}
        >
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 0 }}>
            Pedido {seleccionado.doc_num} — {seleccionado.card_name}
          </h2>

          <p>Fecha: {formatDate(seleccionado.doc_date)} {seleccionado.hora_pedido ?? ""}</p>
          {seleccionado.nro_referencia_externa && (
            <p>Referencia externa: {seleccionado.nro_referencia_externa}</p>
          )}
          {seleccionado.cliente_suspendido && (
            <p>
              <StatusTag variant="risk">Cliente suspendido</StatusTag>
            </p>
          )}
          {seleccionado.comentarios && <p>Comentarios: {seleccionado.comentarios}</p>}

          <div style={{ marginTop: 16 }}>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Aprobar</p>
            {OPCIONES_APROBAR.map((opcion) => (
              <label key={opcion} style={{ display: "block", marginBottom: 4, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="opcion-aprobar"
                  value={opcion}
                  checked={opcionAprobar === opcion}
                  onChange={() => setOpcionAprobar(opcion)}
                  disabled={enviando}
                />{" "}
                {opcion}
              </label>
            ))}
          </div>

          {errorDecision && <p style={{ color: "var(--color-risk)" }}>{errorDecision}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
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
      )}
    </div>
  );
}
