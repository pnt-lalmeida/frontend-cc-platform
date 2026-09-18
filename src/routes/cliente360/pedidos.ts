const ESTADOS_PEDIDO: Record<string, string> = {
  bost_Open: "Abierto",
  bost_Close: "Cerrado",
};

export function traducirEstadoPedido(documentStatus: string | null): string {
  if (!documentStatus) {
    return "—";
  }
  return ESTADOS_PEDIDO[documentStatus] ?? documentStatus;
}
