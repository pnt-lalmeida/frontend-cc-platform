import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import type { ClienteDelDia } from "../../api/types";
import { MAX_NOTA, hayErrores, type Errores } from "../cliente360/bitacora";
import {
  COBRANZA_VACIA,
  MAX_HORARIO,
  MONEDAS_COBRANZA,
  esPagoCoordinado,
  validarCobranza,
  type FormCobranza,
} from "../cliente360/pagoCoordinado";
import { hoyUruguay } from "../../utils/fechas";
import { urlDeCliente } from "../cliente360/urlCliente";
import { importesDeCliente, nombreCliente } from "./miDia";

// Una fila de la lista de trabajo = un CLIENTE (con una o varias cuentas).
// Densa y tocable: en escritorio todo en una linea; en celular el nombre
// arriba y, abajo, numero, importes y marcas, con las acciones a la derecha
// (minimo 44px). "Registrar" es la accion principal; "Ver ficha" es un
// enlace discreto al lado, para que no compitan.

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
  onRegistrar: (cardCode: string, resultado: string, nota: string, cobranza?: FormCobranza) => Promise<boolean>;
  // Entrega 2: con cobranza_programada, "Pago coordinado" pide la fecha acordada.
  conCobranza?: boolean;
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
  conCobranza = false,
}: PropsFila) {
  const nombre = nombreCliente(cliente);
  const botonRef = useRef<HTMLButtonElement>(null);
  const importes = importesDeCliente(cliente);

  function abrir() {
    if (abierta) return cerrar();
    onAbrir(cliente.card_code);
  }

  function cerrar() {
    onCerrar();
    botonRef.current?.focus();
  }

  async function registrar(resultado: string, nota: string, cobranza?: FormCobranza) {
    const ok = await onRegistrar(cliente.card_code, resultado, nota, cobranza);
    // El formulario desaparece: a donde va el foco lo decide la pantalla
    // (la siguiente fila pendiente), porque depende de toda la lista.
    if (ok) onCerrar();
  }

  return (
    <li tabIndex={-1} className="midia-fila" data-card-code={cliente.card_code} data-apagada={apagada ? "true" : undefined}>
      <div className="midia-fila-meta">
        <span className="midia-numero">{cliente.numero_sn ?? cliente.card_code}</span>
        <span className="midia-marcas">
          {cliente.tiene_vencido && (
            <span className="midia-vencido">
              <span aria-hidden="true">⚠</span> <span>vencido</span>
            </span>
          )}
          {cliente.cuentas.some((c) => c.saldo_en_otra_moneda) && (
            <span className="midia-otra-moneda">también en otra moneda</span>
          )}
          {apagada && <span className="midia-chip midia-chip-hecho">Hecho</span>}
          {anotada && !apagada && <span className="midia-chip">Sin contactar</span>}
        </span>
        <span className="midia-saldo">
          {importes.map((importe, i) => (
            <Fragment key={`${i}-${importe}`}>
              {i > 0 && (
                <span className="midia-sep" aria-hidden="true">
                  {" · "}
                </span>
              )}
              <span className="midia-importe">{importe}</span>
            </Fragment>
          ))}
        </span>
      </div>
      <span className="midia-nombre" data-testid="midia-nombre">
        {nombre}
      </span>
      <div className="midia-acciones">
        <Link to={urlDeCliente(cliente.card_code)} className="midia-ficha" aria-label={`Ver ficha de ${nombre}`}>
          Ver ficha
        </Link>
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
      </div>
      {abierta && puedeRegistrar && !apagada && (
        <FormularioRegistro
          cardCode={cliente.card_code}
          nombre={nombre}
          enviando={enviando}
          error={error}
          resultados={resultados}
          conCobranza={conCobranza}
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
  conCobranza,
  onCancelar,
  onGuardar,
}: {
  cardCode: string;
  nombre: string;
  enviando: boolean;
  error: string | null;
  resultados: EstadoResultadosFila;
  conCobranza: boolean;
  onCancelar: () => void;
  onGuardar: (resultado: string, nota: string, cobranza?: FormCobranza) => Promise<void>;
}) {
  const [resultado, setResultado] = useState("");
  const [nota, setNota] = useState("");
  const [errorResultado, setErrorResultado] = useState<string | null>(null);
  const [cobranza, setCobranza] = useState<FormCobranza>(COBRANZA_VACIA);
  const [erroresCobranza, setErroresCobranza] = useState<Errores<FormCobranza>>({});
  const conFecha = conCobranza && esPagoCoordinado(resultado);
  const fechaRef = useRef<HTMLInputElement>(null);
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
    if (conFecha) {
      const nuevos = validarCobranza(cobranza, hoyUruguay());
      setErroresCobranza(nuevos);
      if (hayErrores(nuevos)) {
        // El foco va al primer campo con error (la fecha es el que casi siempre falta).
        if (nuevos.fecha_cobranza) fechaRef.current?.focus();
        return;
      }
    }
    void onGuardar(resultado, nota.trim(), conFecha ? cobranza : undefined);
  }

  function cambiarCobranza(cambio: Partial<FormCobranza>) {
    setCobranza({ ...cobranza, ...cambio });
    setErroresCobranza({ ...erroresCobranza, ...Object.fromEntries(Object.keys(cambio).map((k) => [k, undefined])) });
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
            {conFecha && (
              <CamposCobranza
                id={idError}
                form={cobranza}
                errores={erroresCobranza}
                deshabilitado={enviando}
                fechaRef={fechaRef}
                onCambio={cambiarCobranza}
              />
            )}
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

// Entrega 2: fecha acordada del Pago coordinado, con horario e importe
// opcionales. Compacto: la fecha y el horario comparten linea, el importe y
// la moneda tambien; en celular cada campo ocupa el ancho.
function CamposCobranza({
  id,
  form,
  errores,
  deshabilitado,
  fechaRef,
  onCambio,
}: {
  id: string;
  form: FormCobranza;
  errores: Errores<FormCobranza>;
  deshabilitado: boolean;
  fechaRef: React.RefObject<HTMLInputElement>;
  onCambio: (cambio: Partial<FormCobranza>) => void;
}) {
  const campo = (clave: keyof FormCobranza) => ({
    "aria-invalid": errores[clave] ? (true as const) : undefined,
    "aria-describedby": errores[clave] ? `${id}-${clave}-error` : undefined,
    disabled: deshabilitado,
  });
  const error = (clave: keyof FormCobranza) =>
    errores[clave] ? (
      <p id={`${id}-${clave}-error`} className="midia-error">
        {errores[clave]}
      </p>
    ) : null;
  return (
    <>
      <div className="midia-campo midia-campo-cobranza">
        <label htmlFor={`${id}-fecha`} className="midia-etiqueta">
          Fecha acordada
        </label>
        <input
          ref={fechaRef}
          id={`${id}-fecha`}
          type="date"
          className="midia-control"
          value={form.fecha_cobranza}
          min={hoyUruguay()}
          onChange={(e) => onCambio({ fecha_cobranza: e.target.value })}
          {...campo("fecha_cobranza")}
        />
        {error("fecha_cobranza")}
      </div>
      <div className="midia-campo midia-campo-cobranza">
        <label htmlFor={`${id}-horario`} className="midia-etiqueta">
          Horario (opcional)
        </label>
        <input
          id={`${id}-horario`}
          type="text"
          className="midia-control"
          autoComplete="off"
          value={form.horario}
          maxLength={MAX_HORARIO + 20}
          placeholder="Ej: 14 a 16 h"
          onChange={(e) => onCambio({ horario: e.target.value })}
          {...campo("horario")}
        />
        {error("horario")}
      </div>
      <div className="midia-campo midia-campo-cobranza">
        <label htmlFor={`${id}-importe`} className="midia-etiqueta">
          Importe (opcional)
        </label>
        <input
          id={`${id}-importe`}
          type="text"
          inputMode="decimal"
          className="midia-control"
          autoComplete="off"
          value={form.importe}
          placeholder="Ej: 45.000"
          onChange={(e) => onCambio({ importe: e.target.value })}
          {...campo("importe")}
        />
        {error("importe")}
      </div>
      <div className="midia-campo midia-campo-moneda">
        <label htmlFor={`${id}-moneda`} className="midia-etiqueta">
          Moneda
        </label>
        <select
          id={`${id}-moneda`}
          className="midia-control"
          value={form.moneda}
          onChange={(e) => onCambio({ moneda: e.target.value })}
          {...campo("moneda")}
        >
          {MONEDAS_COBRANZA.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {error("moneda")}
      </div>
    </>
  );
}
