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
