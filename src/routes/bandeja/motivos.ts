import type { CandidatoBandeja } from "../../api/types";

// Motivo(s) por los que SAP retuvo el pedido. Es solo informacion: nunca filtra,
// ordena ni habilita nada. Ver docs/Architecture.md punto 62 (misma regla que pagador central).
//
// Un backend viejo no manda los campos: en ese caso no se muestra nada (ni "Ya sin deuda
// vencida", que exigiria que los dos vengan explicitamente en false).
export function motivosDeRetencion(
  c: Pick<CandidatoBandeja, "status_aprobacion" | "motivo_deuda_vencida" | "motivo_tope_cedula">,
): string[] {
  const motivos: string[] = [];
  if (c.motivo_deuda_vencida === true) motivos.push("Deuda vencida");
  if (c.motivo_tope_cedula === true) motivos.push("Tope cédula");
  if (
    motivos.length === 0 &&
    c.motivo_deuda_vencida === false &&
    c.motivo_tope_cedula === false &&
    c.status_aprobacion === "Rechazado"
  ) {
    return ["Ya sin deuda vencida"];
  }
  return motivos;
}
