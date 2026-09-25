// Fechas "de calendario" compartidas. El equipo trabaja en Uruguay: "hoy" es
// siempre la fecha de Montevideo, sin importar la zona del navegador ni UTC
// (entre las 21 y las 24 h de Uruguay, en UTC ya es el dia siguiente).

// "Hoy" (o el dia de un instante cualquiera) en Montevideo, como YYYY-MM-DD.
export function hoyUruguay(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ahora);
}

// Dia calendario (ms UTC a las 00:00) de una fecha de SAP. SAP no manda hora
// (o viene a las 00:00Z): se toma el dia en UTC, igual que formatDate.
export function diaCalendario(iso: string): number | null {
  const fecha = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(fecha.getTime())) return null;
  return Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate());
}
