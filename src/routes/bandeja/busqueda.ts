import type { CandidatoBandeja } from "../../api/types";

export function coincideBusqueda(candidato: CandidatoBandeja, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (candidato.card_name ?? "").toLowerCase().includes(q) ||
    (candidato.vendedor ?? "").toLowerCase().includes(q)
  );
}

export function ordenarPorFechaDesc(candidatos: CandidatoBandeja[]): CandidatoBandeja[] {
  return [...candidatos].sort((a, b) => {
    if (a.doc_date == null && b.doc_date == null) return 0;
    if (a.doc_date == null) return 1;
    if (b.doc_date == null) return -1;
    if (a.doc_date === b.doc_date) return 0;
    return a.doc_date < b.doc_date ? 1 : -1;
  });
}
