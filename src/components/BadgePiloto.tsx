// Marca una funcionalidad que esta en etapa "piloto" (useFeatures().enPiloto):
// la ve solo un grupo reducido y todavia puede cambiar.
export function BadgePiloto() {
  return (
    <span
      title="En prueba con un grupo reducido: puede cambiar"
      style={{
        fontSize: 10.5,
        fontWeight: 600,
        padding: "1px 7px",
        borderRadius: 20,
        background: "var(--color-accent-soft)",
        color: "var(--color-accent-ink)",
        lineHeight: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      Piloto
    </span>
  );
}
