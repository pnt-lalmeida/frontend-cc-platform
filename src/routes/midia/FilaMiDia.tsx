import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ClienteDelDia } from "../../api/types";
import { formatMoneyEntero } from "../../design/format";
import { MAX_NOTA } from "../cliente360/bitacora";
import { nombreCliente } from "./miDia";

// Una fila de la lista de trabajo. Densa y tocable: en escritorio todo en una
// linea; en celular el nombre arriba y, abajo, numero, saldo y marcas, con el
// boton de registrar a la derecha (minimo 44px, ver tokens.css).

export interface EstadoResultadosFila {
  lista: string[] | null;
  cargando: boolean;
  error: string | null;
  cargar: (cardCode: string) => Promise<void>;
}

interface PropsFila {
  cliente: ClienteDelDia;
  // Gestionado: la fila se apaga (texto mas quieto, chip "Hecho"), no se borra.
  apagada: boolean;
  // "No contactado" ya anotado hoy: el cliente sigue pendiente.
  anotada: boolean;
  // Sin la funcion de Bitacora no hay registro inline.
  puedeRegistrar: boolean;
  abierta: boolean;
  enviando: boolean;
  error: string | null;
  resultados: EstadoResultadosFila;
  onAbrir: (cardCode: string) => void;
  onCerrar: () => void;
  onRegistrar: (cardCode: string, resultado: string, nota: string) => Promise<boolean>;
}

export function FilaMiDia({
  cliente,
  apagada,
  anotada,
  puedeRegistrar,
  abierta,
  enviando,
  error,
  resultados,
  onAbrir,
  onCerrar,
  onRegistrar,
}: PropsFila) {
  const nombre = nombreCliente(cliente);
  const botonRef = useRef<HTMLButtonElement>(null);
  const filaRef = useRef<HTMLLIElement>(null);

  function abrir() {
    if (abierta) return cerrar();
    onAbrir(cliente.card_code);
  }

  function cerrar() {
    onCerrar();
    botonRef.current?.focus();
  }

  async function registrar(resultado: string, nota: string) {
    const ok = await onRegistrar(cliente.card_code, resultado, nota);
    if (ok) {
      onCerrar();
      // El formulario desaparece: el foco no puede quedar en el aire.
      filaRef.current?.focus();
    }
  }

  return (
    <li ref={filaRef} tabIndex={-1} className="midia-fila" data-apagada={apagada ? "true" : undefined}>
      <div className="midia-fila-meta">
        <span className="midia-numero">{cliente.numero_sn ?? cliente.card_code}</span>
        <span className="midia-marcas">
          {cliente.tiene_vencido && (
            <span className="midia-vencido">
              <span aria-hidden="true">⚠</span> <span>vencido</span>
            </span>
          )}
          {cliente.saldo_en_otra_moneda && <span className="midia-otra-moneda">también en otra moneda</span>}
          {apagada && <span className="midia-chip midia-chip-hecho">Hecho</span>}
          {anotada && !apagada && <span className="midia-chip">Sin contactar</span>}
        </span>
        <span className="midia-saldo">{formatMoneyEntero(cliente.saldo, cliente.moneda)}</span>
      </div>
      <span className="midia-nombre" data-testid="midia-nombre">
        {nombre}
      </span>
      {puedeRegistrar && !apagada && (
        <button
          ref={botonRef}
          type="button"
          className="midia-boton"
          aria-expanded={abierta}
          aria-label={`Registrar gestión de ${nombre}`}
          onClick={abrir}
        >
          Registrar
        </button>
      )}
      {abierta && puedeRegistrar && !apagada && (
        <FormularioRegistro
          cardCode={cliente.card_code}
          nombre={nombre}
          enviando={enviando}
          error={error}
          resultados={resultados}
          onCancelar={cerrar}
          onGuardar={registrar}
        />
      )}
    </li>
  );
}

function FormularioRegistro({
  cardCode,
  nombre,
  enviando,
  error,
  resultados,
  onCancelar,
  onGuardar,
}: {
  cardCode: string;
  nombre: string;
  enviando: boolean;
  error: string | null;
  resultados: EstadoResultadosFila;
  onCancelar: () => void;
  onGuardar: (resultado: string, nota: string) => Promise<void>;
}) {
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("");
  const [errorResultado, setErrorResultado] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const idError = useId();
  const { lista, cargar } = resultados;
  const listo = lista !== null;

  useEffect(() => {
    void cargar(cardCode);
  }, [cargar, cardCode]);

  // El foco va al primer campo apenas esta disponible (mientras carga la
  // lista el select todavia no existe).
  useEffect(() => {
    if (listo) selectRef.current?.focus();
  }, [listo]);

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!resultado) {
      setErrorResultado("Elegí un resultado.");
      selectRef.current?.focus();
      return;
    }
    void onGuardar(resultado, nota.trim());
  }

  function alTeclear(e: KeyboardEvent) {
    if (e.key === "Escape" && !enviando) {
      e.stopPropagation();
      onCancelar();
    }
  }

  return (
    <div role="group" aria-label={`Registrar gestión de ${nombre}`} className="midia-form" onKeyDown={alTeclear}>
      <form onSubmit={enviar} noValidate className="midia-form-campos">
        {listo ? (
          <>
            <div className="midia-campo">
              <label htmlFor={`${idError}-resultado`} className="midia-etiqueta">
                Resultado
              </label>
              <select
                ref={selectRef}
                id={`${idError}-resultado`}
                className="midia-control"
                value={resultado}
                disabled={enviando}
                aria-invalid={errorResultado ? true : undefined}
                aria-describedby={errorResultado ? idError : undefined}
                onChange={(e) => {
                  setResultado(e.target.value);
                  setErrorResultado(null);
                }}
              >
                <option value="">Elegí el resultado</option>
                {lista.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {errorResultado && (
                <p id={idError} role="alert" className="midia-error">
                  {errorResultado}
                </p>
              )}
            </div>
            <div className="midia-campo midia-campo-nota">
              <label htmlFor={`${idError}-nota`} className="midia-etiqueta">
                Nota (opcional)
              </label>
              <input
                id={`${idError}-nota`}
                type="text"
                className="midia-control"
                value={nota}
                maxLength={MAX_NOTA}
                disabled={enviando}
                onChange={(e) => setNota(e.target.value)}
              />
            </div>
          </>
        ) : resultados.error ? (
          <p className="midia-error midia-form-mensaje">
            {resultados.error}{" "}
            <button type="button" className="midia-enlace" onClick={() => void cargar(cardCode)}>
              Reintentar
            </button>
          </p>
        ) : (
          <p className="midia-form-mensaje midia-muted">Cargando resultados...</p>
        )}
        <div className="midia-form-acciones">
          {listo && (
            <button type="submit" className="midia-boton midia-boton-primario" disabled={enviando}>
              {enviando ? "Guardando..." : "Guardar"}
            </button>
          )}
          <button type="button" className="midia-boton" disabled={enviando} onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="midia-error midia-form-mensaje">
          {error}
        </p>
      )}
    </div>
  );
}
