import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "../api/client";
import type {
  Autorizacion,
  ClienteBusqueda,
  ClientesResponse,
  EstadoCuentaFila,
  Factura,
  FichaCliente,
  Pedido,
  SuspendidoResponse,
} from "../api/types";
import { useAccessToken } from "../auth/useAccessToken";
import { StatusTag } from "../components/StatusTag";
import { Table, type TableColumn } from "../components/Table";
import { formatDate, formatDateTime, formatMoney } from "../design/format";
import { useAutorizaciones } from "./cliente360/useAutorizaciones";
import { facturaVencida } from "./cliente360/facturas";
import { traducirEstadoPedido } from "./cliente360/pedidos";
import { calcularResumenFacturas } from "./cliente360/resumenSaldos";
import { construirResumenRiesgo } from "./cliente360/riesgo";
import { useClienteSearch } from "./cliente360/useClienteSearch";
import { useEstadoCuenta } from "./cliente360/useEstadoCuenta";
import { useFichaCliente } from "./cliente360/useFichaCliente";
import { useSuspendido } from "./cliente360/useSuspendido";

type Pestaña = "resumen" | "facturas" | "pedidos" | "autorizaciones" | "estado-cuenta";

const COLUMNAS_AUTORIZACIONES: TableColumn<Autorizacion>[] = [
  { key: "doc_num", header: "N° pedido", render: (a) => String(a.doc_num), sortValue: (a) => a.doc_num },
  {
    key: "decision",
    header: "Decisión",
    render: (a) =>
      a.decision === "approved" ? (
        <StatusTag variant="ok">Autorizado</StatusTag>
      ) : (
        <StatusTag variant="risk">Rechazado</StatusTag>
      ),
  },
  { key: "motivo", header: "Motivo", render: (a) => a.motivo ?? "—" },
  { key: "usuario", header: "Usuario", render: (a) => a.usuario },
  { key: "timestamp", header: "Cuándo", render: (a) => formatDateTime(a.timestamp), sortValue: (a) => a.timestamp },
  {
    key: "sap_status",
    header: "En SAP",
    render: (a) =>
      a.sap_status === "ejecutado" ? (
        <StatusTag variant="ok">Sí</StatusTag>
      ) : (
        <StatusTag variant="caution">Todavía no</StatusTag>
      ),
  },
  { key: "tiene_adjunto", header: "Adjunto", render: (a) => (a.tiene_adjunto ? "Sí" : "—") },
];

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

const COLUMNAS_ESTADO_CUENTA: TableColumn<EstadoCuentaFila>[] = [
  { key: "fecha", header: "Fecha", render: (f) => formatDate(f.fecha) },
  { key: "vencimiento", header: "Vencimiento", render: (f) => formatDate(f.vencimiento) },
  { key: "tipo", header: "Tipo", render: (f) => f.tipo ?? "—" },
  { key: "folio", header: "N° Doc", render: (f) => f.folio ?? "—" },
  { key: "moneda", header: "Moneda", render: (f) => f.moneda ?? "—" },
  {
    key: "saldo",
    header: "Importe",
    align: "right",
    render: (f) => formatMoney(f.saldo, f.moneda),
  },
  {
    key: "saldo_corrido",
    header: "Saldo corrido",
    align: "right",
    render: (f) => formatMoney(f.saldo_corrido, f.moneda),
  },
  { key: "vendedor", header: "Vendedor", render: (f) => f.vendedor ?? "—" },
  {
    key: "estado",
    header: "Estado",
    render: (f) =>
      f.vencimiento && facturaVencida(f.vencimiento) ? (
        <StatusTag variant="risk">Vencido</StatusTag>
      ) : (
        <StatusTag variant="ok">Al día</StatusTag>
      ),
  },
];

export function Cliente360Page() {
  const getAccessToken = useAccessToken();
  const [cardCodeSeleccionado, setCardCodeSeleccionado] = useState<string | null>(null);
  const [pestañaActiva, setPestañaActiva] = useState<Pestaña>("resumen");

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
  const {
    ficha,
    facturas,
    pedidos,
    cheques,
    loading: cargandoFicha,
    error,
    recargar: recargarFicha,
  } = useFichaCliente(cardCodeSeleccionado);
  const {
    filas: estadoCuenta,
    loading: cargandoEstadoCuenta,
    error: errorEstadoCuenta,
  } = useEstadoCuenta(cardCodeSeleccionado);
  const {
    autorizaciones,
    loading: cargandoAutorizaciones,
    error: errorAutorizaciones,
  } = useAutorizaciones(cardCodeSeleccionado);

  const patchSuspendido = useCallback(
    async (suspendido: boolean): Promise<SuspendidoResponse> => {
      const token = await getAccessToken();
      const cardCodeCodificado = encodeURIComponent(ficha?.card_code ?? "");
      return apiFetch<SuspendidoResponse>(`/api/clientes/${cardCodeCodificado}/suspendido`, {
        token,
        method: "PATCH",
        body: { suspendido },
      });
    },
    [getAccessToken, ficha?.card_code]
  );
  const { enviando: enviandoSuspendido, error: errorSuspendido, actualizar: actualizarSuspendido } =
    useSuspendido(patchSuspendido);

  const cuentas = ficha ? [ficha, ...ficha.cuentas_relacionadas] : [];

  const columnasFacturas = useMemo(() => construirColumnasFacturas(ficha?.moneda ?? null), [ficha?.moneda]);
  const columnasPedidos = useMemo(() => construirColumnasPedidos(ficha?.moneda ?? null), [ficha?.moneda]);
  const resumenFacturas = useMemo(() => calcularResumenFacturas(facturas), [facturas]);
  const facturasVencidasOrdenadas = useMemo(
    () =>
      facturas
        .filter((f) => facturaVencida(f.doc_due_date))
        .sort((a, b) => (a.doc_due_date < b.doc_due_date ? -1 : 1))
        .slice(0, 5),
    [facturas]
  );

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
                    setPestañaActiva("resumen");
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
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
              {cuentas.map((cuenta) => (
                <button
                  key={cuenta.card_code}
                  onClick={() => setCardCodeSeleccionado(cuenta.card_code)}
                  style={{
                    padding: "7px 16px",
                    borderRadius: 7,
                    border: `1px solid ${cuenta.card_code === ficha.card_code ? "var(--color-accent)" : "var(--color-line)"}`,
                    background: cuenta.card_code === ficha.card_code ? "var(--color-accent)" : "var(--color-surface)",
                    color: cuenta.card_code === ficha.card_code ? "#fff" : "var(--color-muted)",
                    fontWeight: cuenta.card_code === ficha.card_code ? 600 : 500,
                    fontSize: 12.5,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cuenta.moneda ?? "—"} · {cuenta.card_code}
                </button>
              ))}
              <span className="c360-hint-desktop" style={{ fontSize: 12, color: "var(--color-muted)" }}>
                cada cuenta es una moneda separada — nunca se suman entre sí
              </span>
            </div>
          )}

          <div
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 10,
              padding: "22px 28px",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, margin: 0 }}>{ficha.card_name}</h2>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--color-muted)" }}>
                  {ficha.card_code}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusTag variant="neutral">Clasificación {ficha.clasificacion_cc ?? "—"}</StatusTag>
                {construirResumenRiesgo(ficha)
                  .filter((tag) => tag.key !== "clasificacion")
                  .map((tag) => (
                    <StatusTag key={tag.key} variant={tag.variant}>
                      {tag.label}
                    </StatusTag>
                  ))}
                {cheques && cheques.cantidad_cheques > 0 && (
                  <StatusTag variant="neutral">
                    Cheques pendientes: {formatMoney(ficha.cheques_pendientes, ficha.moneda)} ({cheques.cantidad_cheques})
                  </StatusTag>
                )}
                <ControlSuspendido
                  ficha={ficha}
                  enviando={enviandoSuspendido}
                  onCambiar={async (nuevoValor) => {
                    const resultado = await actualizarSuspendido(nuevoValor);
                    if (resultado) recargarFicha();
                  }}
                />
              </div>
            </div>

            {errorSuspendido && (
              <p style={{ color: "var(--color-risk)", fontSize: 12.5, marginTop: -8, marginBottom: 12 }}>
                {errorSuspendido}
              </p>
            )}

            <div className="c360-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              <Estadistica etiqueta="Saldo cta. cte." valor={formatMoney(ficha.current_account_balance, ficha.moneda)} />
              <Estadistica
                etiqueta="Saldo pedidos abiertos"
                valor={formatMoney(ficha.open_orders_balance, ficha.moneda)}
                borde
              />
              <Estadistica
                etiqueta="Saldo vencido"
                valor={formatMoney(resumenFacturas.saldoVencido, ficha.moneda)}
                color={resumenFacturas.saldoVencido > 0 ? "var(--color-risk)" : undefined}
                borde
              />
              <Estadistica
                etiqueta="Atraso actual"
                valor={resumenFacturas.atrasoActualDias != null ? `${resumenFacturas.atrasoActualDias} días` : "—"}
                color={resumenFacturas.atrasoActualDias != null ? "var(--color-risk)" : undefined}
                borde
              />
              <Estadistica
                etiqueta="Tolerancia vigente"
                valor={ficha.dias_tolerancia_cc != null ? `${ficha.dias_tolerancia_cc} días` : "—"}
                borde
              />
              <Estadistica etiqueta="Condición de pago" valor={ficha.condicion_pago ?? "—"} borde />
              <Estadistica etiqueta="Zona ctas. ctes." valor={ficha.zona_ctas_ctes ?? "—"} borde />
            </div>

            {facturas.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${resumenFacturas.pctAlDia}%`, background: "var(--color-ok)" }} />
                  <div style={{ width: `${resumenFacturas.pctVencido}%`, background: "var(--color-risk)" }} />
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 11.5, color: "var(--color-muted)" }}>
                  <span>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--color-ok)", marginRight: 5 }} />
                    Al día ({Math.round(resumenFacturas.pctAlDia)}%)
                  </span>
                  <span>
                    <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: "var(--color-risk)", marginRight: 5 }} />
                    Vencido ({Math.round(resumenFacturas.pctVencido)}%)
                  </span>
                  <span style={{ color: "#8A9490" }}>— sobre saldo de facturas abiertas de esta cuenta</span>
                </div>
              </div>
            )}
          </div>

          <div className="c360-tabs-row" style={{ display: "flex", gap: 4, marginTop: 24, borderBottom: "1px solid var(--color-line)" }}>
            {(
              [
                { key: "resumen", label: "Resumen" },
                { key: "facturas", label: "Facturas" },
                { key: "pedidos", label: "Pedidos" },
                { key: "autorizaciones", label: "Autorizaciones" },
                { key: "estado-cuenta", label: "Estado de cuenta" },
              ] as const
            ).map((pestaña) => (
              <button
                key={pestaña.key}
                onClick={() => setPestañaActiva(pestaña.key)}
                style={{
                  padding: "8px 14px",
                  border: "none",
                  borderBottom:
                    pestañaActiva === pestaña.key
                      ? "2px solid var(--color-accent)"
                      : "2px solid transparent",
                  background: "none",
                  fontWeight: pestañaActiva === pestaña.key ? 600 : 500,
                  color: pestañaActiva === pestaña.key ? "var(--color-ink)" : "var(--color-muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {pestaña.label}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            {pestañaActiva === "resumen" && (
              <div className="c360-resumen-grid" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
                <div>
                  <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, fontWeight: 500 }}>
                    Facturas vencidas
                  </p>
                  {facturasVencidasOrdenadas.length === 0 ? (
                    <p style={{ color: "var(--color-muted)" }}>Sin facturas vencidas.</p>
                  ) : (
                    <>
                      <Table
                        columns={[
                          { key: "doc_num", header: "Documento", render: (f: Factura) => String(f.doc_num) },
                          {
                            key: "doc_due_date",
                            header: "Vencimiento",
                            render: (f: Factura) => formatDate(f.doc_due_date),
                          },
                          {
                            key: "atraso",
                            header: "Atraso",
                            render: (f: Factura) => {
                              const dias = calcularResumenFacturas([f]).atrasoActualDias;
                              return dias != null ? `${dias} días` : "—";
                            },
                          },
                          {
                            key: "doc_total",
                            header: "Importe",
                            align: "right",
                            render: (f: Factura) => formatMoney(f.doc_total, ficha.moneda),
                          },
                        ]}
                        rows={facturasVencidasOrdenadas}
                        rowKey={(f) => f.doc_entry}
                      />
                      {facturas.filter((f) => facturaVencida(f.doc_due_date)).length > 5 && (
                        <p style={{ fontSize: 11.5, color: "#8A9490", marginTop: 8 }}>
                          Ver todas en la pestaña Facturas.
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div>
                  <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, fontWeight: 500 }}>
                    Cheques pendientes
                  </p>
                  <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, padding: "14px 16px" }}>
                    {cheques && cheques.cantidad_cheques > 0 ? (
                      <>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 500 }}>
                          {formatMoney(ficha.cheques_pendientes, ficha.moneda)}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--color-muted)", marginTop: 4 }}>
                          {cheques.cantidad_cheques} cheque{cheques.cantidad_cheques === 1 ? "" : "s"}
                          {cheques.promedio_plazo_dias != null
                            ? ` · ${Math.round(cheques.promedio_plazo_dias)} días de plazo promedio`
                            : ""}
                        </div>
                      </>
                    ) : (
                      <p style={{ color: "var(--color-muted)", margin: 0 }}>Sin cheques pendientes.</p>
                    )}
                  </div>

                  {ficha.cuentas_relacionadas.length > 0 && (
                    <>
                      <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "20px 0 10px", fontWeight: 500 }}>
                        Cuentas relacionadas {ficha.numero_sn ? `(N.º SN ${ficha.numero_sn})` : ""}
                      </p>
                      <div style={{ border: "1px solid var(--color-line)", borderRadius: 8, overflow: "hidden" }}>
                        {[ficha, ...ficha.cuentas_relacionadas].map((cuenta) => (
                          <div
                            key={cuenta.card_code}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              padding: "10px 14px",
                              borderTop: cuenta.card_code === ficha.card_code ? undefined : "1px solid var(--color-line)",
                              background: cuenta.card_code === ficha.card_code ? "var(--color-paper)" : undefined,
                              fontWeight: cuenta.card_code === ficha.card_code ? 600 : 400,
                            }}
                          >
                            <span style={{ fontSize: 13 }}>
                              {cuenta.card_code} · {cuenta.moneda ?? "—"}
                            </span>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                              {formatMoney(cuenta.current_account_balance, cuenta.moneda)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p style={{ fontSize: 11.5, color: "#8A9490", marginTop: 8 }}>
                        Cada cuenta es una moneda separada — nunca se suman entre sí.
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}

            {pestañaActiva === "facturas" &&
              (facturas.length === 0 ? (
                <p style={{ color: "var(--color-muted)" }}>Sin facturas pendientes.</p>
              ) : (
                <Table columns={columnasFacturas} rows={facturas} rowKey={(f) => f.doc_entry} />
              ))}

            {pestañaActiva === "pedidos" &&
              (pedidos.length === 0 ? (
                <p style={{ color: "var(--color-muted)" }}>Sin pedidos registrados.</p>
              ) : (
                <Table columns={columnasPedidos} rows={pedidos} rowKey={(p) => p.doc_entry} />
              ))}

            {pestañaActiva === "autorizaciones" && (
              <>
                {errorAutorizaciones && <p style={{ color: "var(--color-risk)" }}>{errorAutorizaciones}</p>}
                {cargandoAutorizaciones && (
                  <p style={{ color: "var(--color-muted)" }}>Cargando autorizaciones...</p>
                )}
                {!cargandoAutorizaciones && !errorAutorizaciones && autorizaciones.length === 0 && (
                  <p style={{ color: "var(--color-muted)" }}>Todavía no se autorizó ni rechazó ningún pedido de este cliente.</p>
                )}
                {!cargandoAutorizaciones && !errorAutorizaciones && autorizaciones.length > 0 && (
                  <Table columns={COLUMNAS_AUTORIZACIONES} rows={autorizaciones} rowKey={(a) => a.doc_entry} />
                )}
              </>
            )}

            {pestañaActiva === "estado-cuenta" && (
              <>
                {errorEstadoCuenta && <p style={{ color: "var(--color-risk)" }}>{errorEstadoCuenta}</p>}
                {cargandoEstadoCuenta && (
                  <p style={{ color: "var(--color-muted)" }}>Cargando estado de cuenta...</p>
                )}
                {!cargandoEstadoCuenta && !errorEstadoCuenta && estadoCuenta.length === 0 && (
                  <p style={{ color: "var(--color-muted)" }}>Sin movimientos registrados.</p>
                )}
                {!cargandoEstadoCuenta && !errorEstadoCuenta && estadoCuenta.length > 0 && (
                  <Table
                    columns={COLUMNAS_ESTADO_CUENTA}
                    rows={estadoCuenta}
                    rowKey={(f) => `${f.folio}-${f.fecha}-${f.saldo_corrido}`}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Estadistica({
  etiqueta,
  valor,
  color,
  borde,
}: {
  etiqueta: string;
  valor: string;
  color?: string;
  borde?: boolean;
}) {
  return (
    <div
      style={{
        padding: "0 20px",
        borderLeft: borde ? "1px solid var(--color-line)" : undefined,
      }}
    >
      <div style={{ fontSize: 11.5, color: "var(--color-muted)", marginBottom: 6 }}>{etiqueta}</div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 21, fontWeight: 500, color }}>{valor}</div>
    </div>
  );
}

function ControlSuspendido({
  ficha,
  enviando,
  onCambiar,
}: {
  ficha: FichaCliente;
  enviando: boolean;
  onCambiar: (nuevoValor: boolean) => Promise<void>;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (confirmando) {
    const accion = ficha.suspendido ? "reactivar" : "suspender";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
        ¿Seguro que querés {accion} a este cliente?
        <button
          onClick={async () => {
            await onCambiar(!ficha.suspendido);
            setConfirmando(false);
          }}
          disabled={enviando}
          style={{
            border: "none",
            borderRadius: 20,
            padding: "3px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            background: "var(--color-risk)",
            color: "#fff",
          }}
        >
          {enviando ? "Guardando..." : "Sí, confirmar"}
        </button>
        <button
          onClick={() => setConfirmando(false)}
          disabled={enviando}
          style={{
            border: "none",
            background: "none",
            fontSize: 12,
            color: "var(--color-muted)",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirmando(true)}
      style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}
      title={ficha.suspendido ? "Click para reactivar" : "Click para suspender"}
    >
      <StatusTag variant={ficha.suspendido ? "risk" : "neutral"}>
        {ficha.suspendido ? "Suspendido" : "Activo"}
      </StatusTag>
    </button>
  );
}
