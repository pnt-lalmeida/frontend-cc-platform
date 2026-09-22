const MONEDA_SIMBOLO: Record<string, string> = {
  UYU: "$",
  USD: "US$",
  EUR: "€",
};

export function formatMoney(
  value: number | null | undefined,
  moneda: string | null = "UYU"
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const numero = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  if (!moneda) {
    return numero;
  }
  const simbolo = MONEDA_SIMBOLO[moneda] ?? moneda;
  return `${simbolo} ${numero}`;
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) {
    return "—";
  }
  const fecha = new Date(isoDate);
  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(fecha);
}

// A diferencia de formatDate (fechas de SAP, sin hora, mostradas en UTC para
// no correrse de dia) - esto es para timestamps reales con hora (ej. cuando
// se autorizo un pedido), mostrados en la zona horaria del navegador.
export function formatDateTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) {
    return "—";
  }
  const fecha = new Date(isoTimestamp);
  if (Number.isNaN(fecha.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(fecha);
}
