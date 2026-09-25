import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { StatusTag } from "../../components/StatusTag";
import { SIN_SITUACION, textoActualizada, varianteSituacion } from "./situacion";
import { useApiSituacion } from "./useApiSituacion";
import { useSituacionCuenta } from "./useSituacionCuenta";

// Situacion de la cuenta (Fase A CRM) en la fila de etiquetas del encabezado.
// Se monta solo con la funcionalidad "situacion_cuenta": el gating vive en
// quien lo usa, asi sin habilitar no hay fetch. La mayoria de los clientes no
// tiene situacion: en ese caso es un control punteado y liviano, no una
// etiqueta mas.
const ANCHO_PANEL = 264;
const MARGEN_PANTALLA = 8;

const ESTILO_VACIO: CSSProperties = {
  border: "1px dashed var(--color-line-strong)",
  background: "transparent",
  borderRadius: 20,
  padding: "2px 9px",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--color-muted)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  fontFamily: "inherit",
};

export function ControlSituacionCuenta({ cardCode }: { cardCode: string }) {
  const api = useApiSituacion();
  const { datos, error, enviando, errorGuardar, guardar } = useSituacionCuenta(api, cardCode);
  const [abierto, setAbierto] = useState(false);
  const [eligiendo, setEligiendo] = useState<string | null | undefined>(undefined);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();
  const opcionesRef = useRef<(HTMLButtonElement | null)[]>([]);
  // Roving tabindex: una sola parada de Tab en la lista; flechas, Home y End
  // mueven el foco sin guardar (elige Enter/Espacio o el clic).
  const [foco, setFoco] = useState(0);
  // El panel se abre hacia la derecha del boton; si no entra, hacia la izquierda.
  const [lado, setLado] = useState<"izquierda" | "derecha">("izquierda");

  // Al cambiar de cliente el selector se cierra.
  const [cardCodeAbierto, setCardCodeAbierto] = useState(cardCode);
  if (cardCodeAbierto !== cardCode) {
    setCardCodeAbierto(cardCode);
    setAbierto(false);
  }

  function cerrar(devolverFoco = true) {
    setAbierto(false);
    if (devolverFoco) botonRef.current?.focus();
  }

  function abrir() {
    const rect = botonRef.current?.getBoundingClientRect();
    const entra = !rect || rect.left + ANCHO_PANEL <= window.innerWidth - MARGEN_PANTALLA;
    setLado(entra ? "izquierda" : "derecha");
    const indiceActual = datos ? [null, ...datos.opciones].indexOf(datos.situacion) : 0;
    setFoco(Math.max(indiceActual, 0));
    setAbierto(true);
  }

  useEffect(() => {
    if (!abierto) return;
    panelRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    const alTocarAfuera = (e: MouseEvent | TouchEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) cerrar(false);
    };
    document.addEventListener("keydown", alTeclear);
    document.addEventListener("mousedown", alTocarAfuera);
    document.addEventListener("touchstart", alTocarAfuera);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.removeEventListener("mousedown", alTocarAfuera);
      document.removeEventListener("touchstart", alTocarAfuera);
    };
  }, [abierto]);

  if (error) {
    return (
      <span title={error} style={{ fontSize: 12, color: "var(--color-muted)", padding: "3px 0", whiteSpace: "nowrap" }}>
        Situación no disponible
      </span>
    );
  }
  // Mientras carga ocupa el mismo lugar que el control vacio (el caso de la
  // mayoria), deshabilitado: asi Suspendido y el resto no saltan.
  if (!datos) {
    return (
      <button type="button" disabled style={{ ...ESTILO_VACIO, cursor: "default", opacity: 0.6 }}>
        Definir situación
      </button>
    );
  }

  const actual = datos.situacion;
  const actualizada = textoActualizada(datos.actualizada_por_nombre, datos.actualizada_por, datos.actualizada_utc);

  async function elegir(valor: string | null) {
    if (valor === actual) {
      cerrar();
      return;
    }
    setEligiendo(valor);
    const ok = await guardar(valor);
    setEligiendo(undefined);
    if (ok) cerrar();
  }

  const opciones: (string | null)[] = [null, ...datos.opciones];

  function moverFoco(e: ReactKeyboardEvent<HTMLDivElement>) {
    const n = opciones.length;
    const destinos: Record<string, number> = {
      ArrowDown: (foco + 1) % n,
      ArrowRight: (foco + 1) % n,
      ArrowUp: (foco - 1 + n) % n,
      ArrowLeft: (foco - 1 + n) % n,
      Home: 0,
      End: n - 1,
    };
    const destino = destinos[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    setFoco(destino);
    opcionesRef.current[destino]?.focus();
  }

  return (
    <div ref={contenedorRef} style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        aria-haspopup="dialog"
        onClick={() => (abierto ? cerrar() : abrir())}
        title={actualizada ?? undefined}
        className={actual ? "situacion-disparador" : "situacion-disparador situacion-vacia"}
        style={actual ? { border: "none", background: "none", padding: 0, cursor: "pointer", borderRadius: 20 } : ESTILO_VACIO}
      >
        {actual ? (
          <StatusTag variant={varianteSituacion(actual)}>
            Situación: {actual}
            <span aria-hidden="true" style={{ marginLeft: 5, fontSize: 9, opacity: 0.7 }}>
              ▾
            </span>
          </StatusTag>
        ) : (
          "Definir situación"
        )}
      </button>

      {abierto && (
        <div
          ref={panelRef}
          id={idPanel}
          role="dialog"
          aria-label="Situación de la cuenta"
          className="situacion-popover"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            ...(lado === "izquierda" ? { left: 0 } : { right: 0 }),
            width: ANCHO_PANEL,
            zIndex: 30,
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: 10,
            boxShadow: "0 16px 40px rgba(27, 31, 29, 0.16), 0 2px 6px rgba(27, 31, 29, 0.06)",
            padding: 6,
            textAlign: "left",
          }}
        >
          <p style={{ fontSize: 12, color: "var(--color-muted)", fontWeight: 500, margin: "6px 10px 6px" }}>
            Situación de la cuenta
          </p>
          <div role="radiogroup" aria-label="Situación de la cuenta" onKeyDown={moverFoco}>
            {opciones.map((valor, i) => {
              const marcada = valor === actual;
              const enCurso = enviando && eligiendo === valor;
              const riesgo = valor !== null && varianteSituacion(valor) === "risk";
              return (
                <div key={valor ?? "__ninguna"}>
                  <button
                    type="button"
                    ref={(el) => {
                      opcionesRef.current[i] = el;
                    }}
                    role="radio"
                    aria-checked={marcada}
                    tabIndex={i === foco ? 0 : -1}
                    onFocus={() => setFoco(i)}
                    disabled={enviando}
                    onClick={() => void elegir(valor)}
                    className="situacion-opcion"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "10px 1fr 16px",
                      alignItems: "center",
                      gap: 6,
                      width: "100%",
                      textAlign: "left",
                      padding: "7px 10px",
                      border: "none",
                      borderRadius: 6,
                      background: marcada ? "var(--color-accent-soft)" : "transparent",
                      color: marcada ? "var(--color-accent-ink)" : "var(--color-ink)",
                      fontWeight: marcada ? 600 : 400,
                      fontSize: 13,
                      fontFamily: "inherit",
                      cursor: enviando ? "default" : "pointer",
                      opacity: enviando && !enCurso && !marcada ? 0.5 : 1,
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: riesgo ? "var(--color-risk)" : "transparent",
                      }}
                    />
                    <span>{valor ?? SIN_SITUACION}</span>
                    <span aria-hidden="true" style={{ display: "inline-flex", justifyContent: "flex-end", color: "var(--color-accent)" }}>
                      {enCurso ? <span className="spinner" style={{ width: 11, height: 11 }} /> : marcada ? "✓" : null}
                    </span>
                  </button>
                  {i === 0 && <div style={{ height: 1, background: "var(--color-line)", margin: "4px 10px" }} />}
                </div>
              );
            })}
          </div>

          {(actualizada || datos.pagador_central || errorGuardar) && (
            <div
              style={{
                borderTop: "1px solid var(--color-line)",
                margin: "6px 4px 0",
                padding: "8px 6px 4px",
                display: "grid",
                gap: 6,
                fontSize: 11.5,
                lineHeight: 1.45,
              }}
            >
              {errorGuardar && (
                <p role="alert" style={{ margin: 0, color: "var(--color-risk)", fontSize: 12 }}>
                  {errorGuardar}
                </p>
              )}
              {datos.pagador_central && (
                <p style={{ margin: 0, color: "var(--color-accent-ink)" }}>
                  Compartida con el pagador central{" "}
                  <span style={{ fontFamily: "var(--font-mono)" }}>{datos.pagador_central.card_code}</span>
                  {datos.pagador_central.card_name ? ` (${datos.pagador_central.card_name})` : ""}.
                </p>
              )}
              {actualizada && <p style={{ margin: 0, color: "var(--color-muted)" }}>{actualizada}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
