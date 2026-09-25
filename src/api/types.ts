export interface ClienteBusqueda {
  card_code: string;
  card_name: string | null;
  numero_sn: string | null;
  moneda: string | null;
}

export interface FichaCliente {
  card_code: string;
  card_name: string | null;
  moneda: string | null;
  credit_limit: number | null;
  sin_limite: boolean;
  current_account_balance: number | null;
  open_orders_balance: number | null;
  valid: boolean | null;
  frozen: boolean | null;
  block_dunning: boolean | null;
  payment_block: boolean | null;
  numero_sn: string | null;
  email_cc: string | null;
  whatsapp_cc: string | null;
  clasificacion_cc: string | null;
  dias_tolerancia_cc: string | null;
  cheques_pendientes: number | null;
  condicion_pago: string | null;
  suspendido: boolean;
  zona_ctas_ctes: string | null;
  pagador_central: PagadorCentral | null;
  cuentas_relacionadas: FichaCliente[];
}

export interface Factura {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_due_date: string;
  doc_total: number;
}

export interface Pedido {
  doc_entry: number;
  doc_num: number;
  doc_date: string;
  doc_total: number;
  confirmed: boolean | null;
  document_status: string | null;
}

export interface CandidatoBandeja {
  doc_entry: number | null;
  doc_num: number | null;
  doc_date: string | null;
  hora_pedido: string | null;
  card_code: string | null;
  card_name: string | null;
  nro_referencia_externa: string | null;
  moneda: string | null;
  importe: number | null;
  vendedor: string | null;
  cliente_suspendido: boolean | null;
  status_aprobacion: string | null;
  condicion_pago: string | null;
  comentarios: string | null;
}

export interface DecisionResponse {
  doc_entry: number;
  decision: "approved" | "rejected";
  sap_status: "no_ejecutado" | "ejecutado";
  activity_code: number | null;
  timestamp: string;
  adjunto_blob_path: string | null;
}

export interface ClientesResponse {
  clientes: ClienteBusqueda[];
}

export interface FacturasResponse {
  facturas: Factura[];
}

export interface PedidosResponse {
  pedidos: Pedido[];
}

export interface EstadoCuentaFila {
  folio: string | null;
  tipo: string | null;
  moneda: string | null;
  vendedor: string | null;
  fecha: string | null;
  vencimiento: string | null;
  saldo: number | null;
  saldo_corrido: number;
}

export interface PagadorCentral {
  card_code: string;
  card_name: string | null;
}

export interface EstadoCuentaResponse {
  estado_cuenta: EstadoCuentaFila[];
  // Cuenta hija: el estado de cuenta es el consolidado de su pagador central.
  pagador_central?: PagadorCentral | null;
}

export interface ChequesResumen {
  cantidad_cheques: number;
  promedio_plazo_dias: number | null;
}

export interface CandidatosResponse {
  candidatos: CandidatoBandeja[];
}

export interface Autorizacion {
  doc_entry: number;
  doc_num: number;
  decision: "approved" | "rejected";
  usuario: string;
  motivo: string | null;
  timestamp: string;
  sap_status: "no_ejecutado" | "pendiente" | "ejecutado";
  tiene_adjunto: boolean;
}

export interface AutorizacionesResponse {
  autorizaciones: Autorizacion[];
}

export interface AdjuntoRequest {
  nombreArchivo: string;
  contenidoBase64: string;
  contentType: string;
}

export interface DecisionRequest {
  cardCode: string;
  docNum: number;
  decision: "approved" | "rejected";
  motivo?: string;
  adjunto?: AdjuntoRequest;
}

export interface SuspendidoRequest {
  suspendido: boolean;
}

export interface SuspendidoResponse {
  card_code: string;
  suspendido: boolean;
}

export interface PedidoParaDecisionMultiple {
  docEntry: number;
  cardCode: string;
  docNum: number;
}

export interface DecisionMultipleRequest {
  decision: "approved" | "rejected";
  motivo?: string;
  pedidos: PedidoParaDecisionMultiple[];
  adjunto?: AdjuntoRequest;
}

export interface ResultadoDecisionMultipleApi {
  docEntry: number;
  docNum: number;
  ok: boolean;
  sapStatus: "no_ejecutado" | "pendiente" | "ejecutado" | null;
  activityCode: number | null;
  adjuntoBlobPath: string | null;
  error: string | null;
}

export interface DecisionMultipleResponse {
  resultados: ResultadoDecisionMultipleApi[];
}

// Fase 1 CRM (25/09/2026): GET /api/clientes/{card_code}/indicadores?ventana=6|12.
// Consolidado por cliente (U_NumeroSN + FatherCard), no por cuenta C1/C2.
export type TendenciaPago = "mejora" | "empeora" | "estable";

export interface IndicadoresPagoAnterior {
  dias_para_cobrar: number;
  dias_atraso: number;
  facturas_consideradas: number;
}

export interface IndicadoresPago {
  ventana_meses: 6 | 12;
  historial_suficiente: boolean;
  minimo_facturas: number;
  facturas_consideradas: number;
  dias_para_cobrar: number | null;
  // Negativo = paga antes del vencimiento.
  dias_atraso: number | null;
  tendencia: TendenciaPago | null;
  anterior: IndicadoresPagoAnterior | null;
}

// Fase 3 CRM (25/09/2026): Bitacora de gestion. GET /api/clientes/{card_code}/bitacora.
// La clave es el N.º SN consolidado: una cuenta hija y su pagador central
// comparten la misma Bitacora.
export interface BitacoraPagadorCentral {
  card_code: string;
  card_name: string | null;
}

export interface BitacoraCliente {
  numero_sn: string | null;
  pagador_central?: BitacoraPagadorCentral | null;
}

export interface MiembroEquipo {
  upn: string;
  nombre: string;
}

export type EstadoTarea = "pendiente" | "completada";

export interface TareaBitacora {
  id: number;
  descripcion: string;
  // YYYY-MM-DD, sin hora.
  fecha_objetivo: string;
  estado: EstadoTarea;
  responsable: string;
  creada_por: string;
  creada_utc: string;
  completada_utc: string | null;
}

export type TipoEventoBitacora = "manual" | "automatico";

export interface EventoBitacora {
  // null en los automaticos derivados de decisiones de la Bandeja (se arman en la lectura).
  id: number | null;
  tipo: TipoEventoBitacora;
  canal: string | null;
  resultado: string;
  nota: string | null;
  origen: string;
  fecha_utc: string;
  // "decision:<doc_entry>" | "tarea:<id>" | null
  referencia: string | null;
  // null en "Recordatorio completado" (las tareas son del cliente, no de una cuenta).
  card_code: string | null;
}

export interface BitacoraResponse {
  cliente: BitacoraCliente;
  motivos: string[];
  canales: string[];
  equipo: MiembroEquipo[];
  tareas: TareaBitacora[];
  eventos: EventoBitacora[];
}

export interface RegistrarGestionRequest {
  resultado: string;
  canal?: string;
  nota?: string;
}

export interface CrearRecordatorioRequest {
  descripcion: string;
  fecha_objetivo: string;
  responsable?: string;
}

export interface CompletarTareaRequest {
  estado: "completada";
}

// Fase 2 CRM (25/09/2026): Centro de alertas. Lista compartida por todo el
// equipo de cobranza: marcar vista o resuelta vale para todos.
export type TipoAlerta = "pedido_bloqueado" | "pedido_reabierto" | "riesgo_bloqueo" | "promesa_incumplida";

export type EstadoAlerta = "nueva" | "vista" | "resuelta";

export interface Alerta {
  id: number;
  tipo: TipoAlerta;
  descripcion: string;
  card_code: string | null;
  numero_sn: string | null;
  // "pedido:<doc_entry>" | null
  entidad_ref: string | null;
  fecha_utc: string;
  estado: EstadoAlerta;
  vista_por: string | null;
  vista_utc: string | null;
  resuelta_por: string | null;
  resuelta_utc: string | null;
}

// GET /api/alertas
export interface AlertasResponse {
  no_vistas: number;
  abiertas: Alerta[];
  resueltas_recientes: Alerta[];
  // Para mostrar nombres en vez de UPN ("Resuelta por Rosina"). Puede venir vacio.
  equipo: MiembroEquipo[];
}

// PATCH /api/alertas/{id}
export interface ActualizarAlertaRequest {
  estado: "vista" | "resuelta";
}

// POST /api/alertas/marcar-vistas
export interface MarcarVistasResponse {
  marcadas: number;
}

// Situacion de la cuenta (contrato Fase A, 25/09/2026). La lista de opciones
// viaja siempre en la respuesta: la UI nunca la duplica. null = "Sin
// situacion especial" (la gran mayoria de los clientes).
export interface SituacionCuentaResponse {
  situacion: string | null;
  actualizada_por: string | null; // UPN
  actualizada_por_nombre: string | null;
  actualizada_utc: string | null;
  opciones: string[];
  // Solo si la clave consolido con un SN distinto del propio (cuenta hija).
  pagador_central?: PagadorCentral | null;
}

export interface GuardarSituacionRequest {
  situacion: string | null;
}
