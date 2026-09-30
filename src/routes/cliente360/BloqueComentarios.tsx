import { useId, useMemo, useState } from "react";
import { recortarComentarios } from "./comentarios";

// "Comentarios" de la ficha de cliente de SAP: donde el sector anota a mano la
// forma de pago acordada, el WhatsApp del estado de cuenta, cuando llamar, etc.
// Es la chuleta con la que gestionan, por eso vive en el encabezado de la ficha
// y se ve en todas las pestanas.
//
// SOLO LECTURA A PROPOSITO. No hay que "mejorarlo" con edicion en linea: el
// dato es de SAP y quien quiera cambiarlo lo cambia alli. Por eso tampoco
// tiene borde ni fondo de input, ni cursor de texto: es una nota, no un campo.
//
// Sin contenido (null) no se dibuja nada: dos de cada tres fichas no lo tienen
// y un recuadro vacio repetido es ruido; si el bloque no esta, se entiende.
export function BloqueComentarios({ comentarios }: { comentarios: string | null | undefined }) {
  const idTexto = useId();
  const [expandido, setExpandido] = useState(false);
  const recorte = useMemo(() => (comentarios ? recortarComentarios(comentarios) : null), [comentarios]);

  if (!comentarios || !recorte) return null;

  const ocultos = recorte.renglonesOcultos;
  const etiquetaVerMas = ocultos > 0 ? `Ver más (${ocultos} ${ocultos === 1 ? "renglón" : "renglones"})` : "Ver más";

  return (
    <section aria-label="Comentarios de la ficha de SAP" style={{ marginTop: 20 }}>
      <p style={{ fontSize: 12, color: "var(--color-muted)", margin: "0 0 6px", fontWeight: 500 }}>Comentarios</p>
      <div
        style={{
          background: "var(--color-paper)",
          borderLeft: "3px solid var(--color-line-strong)",
          borderRadius: 4,
          padding: "10px 14px",
        }}
      >
        {/* tabIndex solo al expandir: si el texto largo tiene scroll propio, se
            puede recorrer con teclado. */}
        <div
          id={idTexto}
          data-testid="comentarios-texto"
          tabIndex={expandido && recorte.recortado ? 0 : undefined}
          className="c360-comentarios-texto"
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: 13.5,
            lineHeight: 1.5,
            color: "var(--color-ink)",
            fontFamily: "inherit",
            cursor: "default",
            maxHeight: expandido ? "45vh" : undefined,
            overflowY: expandido ? "auto" : undefined,
          }}
        >
          {expandido ? comentarios : recorte.visible}
        </div>
        {recorte.recortado && (
          <button
            type="button"
            className="c360-comentarios-toggle"
            aria-expanded={expandido}
            aria-controls={idTexto}
            onClick={() => setExpandido((v) => !v)}
          >
            {expandido ? "Ver menos" : etiquetaVerMas}
          </button>
        )}
      </div>
    </section>
  );
}
