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
  pagador_central: { card_code: string; card_name: string | null } | null;
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

export interface EstadoCuentaResponse {
  estado_cuenta: EstadoCuentaFila[];
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
