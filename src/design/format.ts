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
