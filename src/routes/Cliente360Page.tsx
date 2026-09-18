import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "../api/client";
import type { ClienteBusqueda, ClientesResponse, Factura, Pedido } from "../api/types";
import { useAccessToken } from "../auth/useAccessToken";
import { StatusTag } from "../components/StatusTag";
import { Table, type TableColumn } from "../components/Table";
import { formatDate, formatMoney } from "../design/format";
import { facturaVencida } from "./cliente360/facturas";
import { traducirEstadoPedido } from "./cliente360/pedidos";
import { construirResumenRiesgo } from "./cliente360/riesgo";
import { useClienteSearch } from "./cliente360/useClienteSearch";
import { useFichaCliente } from "./cliente360/useFichaCliente";

function construirColumnasFacturas(moneda: string | null): TableColumn<Factura>[] {
  return [
    { key: "doc_num", header: "N° factura", render: (f) => String(f.doc_num), sortValue: (f) => f.doc_num },
    { key: "doc_date", header: "Fecha", render: (f) => formatDate(f.doc_date), sortValue: (f) => f.doc_date },
    {
      key: "doc_due_date",
      header: "Vencimiento",
      render: (f) => formatDate(f.doc_due_date),
      sortValue: (f) => f.doc_due_date,
    },
    {
      key: "doc_total",
      header: "Importe",
      align: "right",
      render: (f) => formatMoney(f.doc_total, moneda),
      sortValue: (f) => f.doc_total,
    },
    {
      key: "estado",
      header: "Estado",
      render: (f) =>
        facturaVencida(f.doc_due_date) ? (
          <StatusTag variant="risk">Vencida</StatusTag>
        ) : (
          <StatusTag variant="ok">Al día</StatusTag>
        ),
    },
  ];
}

function construirColumnasPedidos(moneda: string | null): TableColumn<Pedido>[] {
  return [
    { key: "doc_num", header: "N° pedido", render: (p) => String(p.doc_num), sortValue: (p) => p.doc_num },
    { key: "doc_date", header: "Fecha", render: (p) => formatDate(p.doc_date), sortValue: (p) => p.doc_date },
    {
      key: "doc_total",
      header: "Importe",
      align: "right",
      render: (p) => formatMoney(p.doc_total, moneda),
      sortValue: (p) => p.doc_total,
    },
    {
      key: "document_status",
      header: "Estado",
      render: (p) => <StatusTag variant="neutral">{traducirEstadoPedido(p.document_status)}</StatusTag>,
    },
  ];
}

export function Cliente360Page() {
  const getAccessToken = useAccessToken();
  const [cardCodeSeleccionado, setCardCodeSeleccionado] = useState<string | null>(null);

  const buscar = useCallback(
    async (query: string): Promise<ClienteBusqueda[]> => {
      const token = await getAccessToken();
      const respuesta = await apiFetch<ClientesResponse>(
        `/api/clientes?q=${encodeURIComponent(query)}`,
        { token }
      );
      return respuesta.clientes;
    },
    [getAccessToken]
  );

  const {
    query,
    setQuery,
    resultados,
    loading: buscando,
    error: errorBusqueda,
  } = useClienteSearch(buscar);
  const { ficha, facturas, pedidos, loading: cargandoFicha, error } = useFichaCliente(cardCodeSeleccionado);

  const cuentas = ficha ? [ficha, ...ficha.cuentas_relacionadas] : [];

  const columnasFacturas = useMemo(() => construirColumnasFacturas(ficha?.moneda ?? null), [ficha?.moneda]);
  const columnasPedidos = useMemo(() => construirColumnasPedidos(ficha?.moneda ?? null), [ficha?.moneda]);

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)" }}>Cliente 360</h1>

      <div style={{ position: "relative", maxWidth: 420 }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o código..."
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid var(--color-line-strong)",
            borderRadius: 6,
            fontSize: 14,
          }}
        />
        {resultados.length > 0 && (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 6,
              zIndex: 1,
            }}
          >
            {resultados.map((cliente) => (
              <li key={cliente.card_code}>
                <button
                  onClick={() => {
                    setCardCodeSeleccionado(cliente.card_code);
                    setQuery("");
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  {cliente.card_name} — {cliente.card_code} ({cliente.moneda ?? "—"})
                </button>
              </li>
            ))}
          </ul>
        )}
        {buscando && <p style={{ fontSize: 12.5, color: "var(--color-muted)" }}>Buscando...</p>}
        {errorBusqueda && <p style={{ color: "var(--color-risk)" }}>{errorBusqueda}</p>}
      </div>

      {error && <p style={{ color: "var(--color-risk)" }}>{error}</p>}
      {cargandoFicha && <p style={{ color: "var(--color-muted)" }}>Cargando cliente...</p>}

      {ficha && (
        <div style={{ marginTop: 24 }}>
          {cuentas.length > 1 && (
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              {cuentas.map((cuenta) => (
                <button
                  key={cuenta.card_code}
                  onClick={() => setCardCodeSeleccionado(cuenta.card_code)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--color-line-strong)",
                    background:
                      cuenta.card_code === ficha.card_code ? "var(--color-paper)" : "var(--color-surface)",
                    cursor: "pointer",
                  }}
                >
                  {cuenta.moneda ?? cuenta.card_code}
                </button>
              ))}
              <span style={{ fontSize: 12, color: "var(--color-muted)" }}>
                cuenta separada, sin sumar con las otras
              </span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {construirResumenRiesgo(ficha).map((tag) => (
              <StatusTag key={tag.key} variant={tag.variant}>
                {tag.label}
              </StatusTag>
            ))}
          </div>

          <p>
            <strong>{ficha.card_name}</strong> ({ficha.card_code})
          </p>
          <p>Saldo cta. cte.: {formatMoney(ficha.current_account_balance, ficha.moneda)}</p>
          <p>Saldo pedidos abiertos: {formatMoney(ficha.open_orders_balance, ficha.moneda)}</p>
          {ficha.dias_tolerancia_cc != null && <p>Días de tolerancia: {ficha.dias_tolerancia_cc}</p>}

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 24 }}>Facturas</h2>
          {facturas.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>Sin facturas pendientes.</p>
          ) : (
            <Table columns={columnasFacturas} rows={facturas} rowKey={(f) => f.doc_entry} />
          )}

          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, marginTop: 24 }}>Pedidos</h2>
          {pedidos.length === 0 ? (
            <p style={{ color: "var(--color-muted)" }}>Sin pedidos registrados.</p>
          ) : (
            <Table columns={columnasPedidos} rows={pedidos} rowKey={(p) => p.doc_entry} />
          )}
        </div>
      )}
    </div>
  );
}
