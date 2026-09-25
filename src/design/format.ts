const MONEDA_SIMBOLO: Record<string, string> = {
  UYU: "$",
  USD: "US$",
  EUR: "€",
};

function formatearConDecimales(
  value: number | null | undefined,
  moneda: string | null,
  decimales: number
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const numero = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(value);
  if (!moneda) {
    return numero;
  }
  const simbolo = MONEDA_SIMBOLO[moneda] ?? moneda;
  return `${simbolo} ${numero}`;
}

export function formatMoney(value: number | null | undefined, moneda: string | null = "UYU"): string {
  return formatearConDecimales(value, moneda, 2);
}

// Monto completo sin decimales, para estadisticas "de un vistazo" (grilla de
// Cliente 360, cheques) donde el centavo no cambia ninguna decision. Pedido
// de Liber 25/09/2026: reemplaza la version abreviada K/M, que no se leia bien.
// En Bandeja, Facturas, Pedidos, etc. sigue formatMoney con los decimales.
export function formatMoneyEntero(value: number | null | undefined, moneda: string | null = "UYU"): string {
  return formatearConDecimales(value, moneda, 0);
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
