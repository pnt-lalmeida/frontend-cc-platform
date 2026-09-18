export function facturaVencida(docDueDate: string, hoy: Date = new Date()): boolean {
  const vencimiento = new Date(docDueDate);
  const vencimientoUTC = Date.UTC(
    vencimiento.getUTCFullYear(),
    vencimiento.getUTCMonth(),
    vencimiento.getUTCDate()
  );
  const hoyUTC = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  return vencimientoUTC < hoyUTC;
}
