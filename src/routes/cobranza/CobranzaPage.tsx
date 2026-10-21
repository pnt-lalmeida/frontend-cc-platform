import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { CobranzaProgramada } from "../../api/types";
import { BadgePiloto } from "../../components/BadgePiloto";
import { useFeatures } from "../../features/FeaturesContext";
import { hoyUruguay } from "../../utils/fechas";
import { esFechaValida, sumarDias } from "../cliente360/bitacora";
import { urlDeCliente } from "../cliente360/urlCliente";
import { fechaEncabezado } from "../midia/miDia";
import {
  MAX_DIRECCION,
  etiquetaDia,
  fraseOrigenDireccion,
  importeDeCobranza,
  nombreDeCobranza,
  textoCantidad,
  tituloImpresion,
  validarDireccion,
} from "./cobranza";
import { useAccionesCobranza } from "./useAccionesCobranza";
import { useApiCobranza } from "./useApiCobranza";
import { useCobranzaDia } from "./useCobranzaDia";
import { guardarArchivo, useExportarCobranza } from "./useExportarCobranza";

// Entrega 2 (15/10/2026): pestaña "Cobranza programada". Reemplaza el estado
// de cuenta impreso del cobrador: lo que hay que cobrar un dia, con la
// direccion a la vista. Pensada para el celular (una tarjeta por cobranza).
// Sin exportar ni imprimir (pedido aparte, por datos personales).

export function CobranzaPage() {
  const { habilitada, enPiloto } = useFeatures();
  const { obtener, acciones, exportar } = useApiCobranza();
  const hoy = hoyUruguay();
  const [fecha, setFecha] = useState(hoy);
  const dia = useCobranzaDia(obtener, fecha);
  // Tras anular, la tarjeta desaparece y con ella el foco: va al titulo del dia,
  // y un aviso (leido por lectores de pantalla) dice que se anulo.
  const [aviso, setAviso] = useState<string | null>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (aviso) titulo.current?.focus();
  }, [aviso]);
  const estado = useAccionesCobranza(acciones, {
    alGuardarDireccion: dia.reemplazarDireccion,
    alAnular: dia.quitar,
    alRecargar: () => void dia.recargar(),
  });

  // Flag cobranza_exportar: sin el, nada de esto se muestra ni se pide.
  const puedeExportar = habilitada("cobranza_exportar");
  // La hoja y la marca de impresion existen SOLO entre el registro exitoso y el
  // cierre del dialogo de impresion (afterprint, tambien si se cancela): un
  // Ctrl+P sin pasar por "Imprimir / PDF" imprime la pantalla comun, sin hoja.
  const [hojaLista, setHojaLista] = useState(false);
  const exportacion = useExportarCobranza(exportar, fecha, { guardarArchivo, imprimir: () => setHojaLista(true) });
  useEffect(() => {
    if (!hojaLista) return;
    const cerrar = () => setHojaLista(false);
    window.addEventListener("afterprint", cerrar);
    window.print();
    return () => window.removeEventListener("afterprint", cerrar);
  }, [hojaLista]);
  const imprimible = puedeExportar && hojaLista;

  const cobranzas = dia.datos?.cobranzas ?? [];
  const sapFallo = dia.datos?.errores.includes("direcciones_sap") ?? false;
  const etiqueta = etiquetaDia(fecha, hoy);
  // Sin datos del dia (cargando o fallo) tampoco hay nada que exportar.
  const sinCobranzas = cobranzas.length === 0;
  const motivoDescargar = sinCobranzas ? (dia.datos ? "No hay cobranzas este día" : "Esperá a que carguen las cobranzas del día") : null;
  // Impresa sin las direcciones de SAP, la hoja le sirve de poco al cobrador:
  // se pide reintentar antes. La planilla si sale (el backend ya la rechaza si SAP no responde).
  const motivoImprimir = motivoDescargar ?? (sapFallo ? "No se pudieron traer las direcciones de SAP: reintentá antes de imprimir" : null);
  // Errores de anulacion de cobranzas que ya no estan en la lista (otra persona la anulo o
  // la reprogramo y la recarga la saco): sin esto el aviso se iria junto con la tarjeta.
  const idsVisibles = new Set(cobranzas.map((c) => c.id));
  const avisosAnular = Object.entries(estado.errorAnular).filter(([id]) => !idsVisibles.has(Number(id)));

  function elegirFecha(valor: string) {
    // Un campo de fecha borrado a medias entrega "": no cambia de dia.
    if (esFechaValida(valor)) cambiarDia(valor);
  }

  function cambiarDia(nuevo: string) {
    setAviso(null);
    setFecha(nuevo);
  }

  return (
    <div className="cobranza" data-imprimible={imprimible ? "" : undefined}>
      <header className="cobranza-encabezado">
        <div className="cobranza-dia">
          <button type="button" className="cobranza-flecha" aria-label="Día anterior" onClick={() => cambiarDia(sumarDias(fecha, -1))}>
            <span aria-hidden>‹</span>
          </button>
          <div className="cobranza-dia-texto">
            {etiqueta && <p className="cobranza-etiqueta-dia">{etiqueta}</p>}
            <h1 ref={titulo} tabIndex={-1} className="cobranza-titulo">
              {fechaEncabezado(fecha)}
            </h1>
            {dia.datos && (
              <p className="cobranza-cuenta">{cobranzas.length === 1 ? "1 cobranza" : `${cobranzas.length} cobranzas`}</p>
            )}
          </div>
          <button type="button" className="cobranza-flecha" aria-label="Día siguiente" onClick={() => cambiarDia(sumarDias(fecha, 1))}>
            <span aria-hidden>›</span>
          </button>
        </div>
        <div className="cobranza-herramientas">
          <label className="cobranza-ir">
            <span>Ir a otro día</span>
            <input type="date" className="cobranza-fecha" value={fecha} onChange={(e) => elegirFecha(e.target.value)} />
          </label>
          {fecha !== hoy && (
            <button type="button" className="cobranza-boton" onClick={() => cambiarDia(hoy)} aria-label="Ir a hoy">
              Hoy
            </button>
          )}
          {enPiloto("cobranza_programada") && <BadgePiloto />}
        </div>
        {puedeExportar && (
          <div className="cobranza-exportar">
            <div className="cobranza-exportar-botones">
              <button
                type="button"
                className="cobranza-boton"
                disabled={sinCobranzas || exportacion.descargando}
                title={motivoDescargar ?? undefined}
                onClick={() => void exportacion.descargar()}
              >
                {exportacion.descargando ? (
                  <>
                    <span className="spinner" aria-hidden /> Descargando…
                  </>
                ) : (
                  "Descargar planilla"
                )}
              </button>
              <button
                type="button"
                className="cobranza-boton"
                disabled={sinCobranzas || sapFallo || exportacion.imprimiendo}
                title={motivoImprimir ?? undefined}
                onClick={() => void exportacion.imprimir()}
              >
                {exportacion.imprimiendo ? (
                  <>
                    <span className="spinner" aria-hidden /> Preparando…
                  </>
                ) : (
                  "Imprimir / PDF"
                )}
              </button>
            </div>
            {sapFallo && !sinCobranzas && (
              <p className="cobranza-exportar-nota">Para imprimir hace falta que SAP devuelva las direcciones. Reintentá.</p>
            )}
            {exportacion.error && (
              <p role="alert" className="cobranza-error-campo cobranza-exportar-error">
                {exportacion.error}
              </p>
            )}
          </div>
        )}
      </header>

      {dia.error && (
        <div role="alert" className="cobranza-error">
          <span>{dia.error}</span>
          <button type="button" className="cobranza-boton" disabled={dia.cargando} onClick={() => void dia.recargar()}>
            Reintentar
          </button>
        </div>
      )}

      {dia.cargando && !dia.datos && (
        <p role="status" className="cobranza-cargando">
          <span className="spinner" aria-hidden /> Cargando cobranzas…
        </p>
      )}

      {dia.datos && sapFallo && (
        <p role="status" className="cobranza-aviso">
          No se pudieron traer las direcciones de SAP. Las que se editaron en la plataforma sí se ven.{" "}
          <button type="button" className="cobranza-enlace" onClick={() => void dia.recargar()}>
            Reintentar
          </button>
        </p>
      )}

      {aviso && (
        <p role="status" className="cobranza-aviso">
          {aviso}
        </p>
      )}

      {avisosAnular.map(([id, mensaje]) => (
        <p key={id} role="status" className="cobranza-aviso">
          {mensaje}{" "}
          <button type="button" className="cobranza-enlace" onClick={() => estado.limpiarErrorAnular(Number(id))}>
            Cerrar
          </button>
        </p>
      ))}

      {dia.datos && cobranzas.length === 0 && (
        <div className="cobranza-vacio">
          <p className="cobranza-vacio-titulo">No hay cobranzas programadas para este día.</p>
          <p>
            Se cargan desde Cliente 360, en Actividad, al registrar una gestión con el resultado “Pago coordinado” y la fecha
            acordada.
          </p>
        </div>
      )}

      {cobranzas.length > 0 && (
        <ul className="cobranza-lista">
          {cobranzas.map((c) => (
            <li key={c.id}>
              <TarjetaCobranza
                cobranza={c}
                sapFallo={sapFallo}
                guardandoDireccion={estado.guardando.has(c.card_code)}
                errorDireccion={estado.errorDireccion[c.card_code] ?? null}
                anulando={estado.anulando.has(c.id)}
                errorAnular={estado.errorAnular[c.id] ?? null}
                onGuardarDireccion={(texto) => estado.guardarDireccion(c.card_code, texto)}
                onAbrirEdicion={() => estado.limpiarErrorDireccion(c.card_code)}
                onAnular={async () => {
                  const ok = await estado.anular(c.id);
                  if (ok) setAviso(`Se anuló la cobranza de ${nombreDeCobranza(c)}.`);
                  return ok;
                }}
                onCerrarConfirmacion={() => estado.limpiarErrorAnular(c.id)}
              />
            </li>
          ))}
        </ul>
      )}
      {imprimible && cobranzas.length > 0 && <HojaImpresion fecha={fecha} cobranzas={cobranzas} />}
    </div>
  );
}

interface PropsTarjeta {
  cobranza: CobranzaProgramada;
  sapFallo: boolean;
  guardandoDireccion: boolean;
  errorDireccion: string | null;
  anulando: boolean;
  errorAnular: string | null;
  onGuardarDireccion: (texto: string) => Promise<boolean>;
  onAbrirEdicion: () => void;
  onAnular: () => Promise<boolean>;
  onCerrarConfirmacion: () => void;
}

function TarjetaCobranza({
  cobranza,
  sapFallo,
  guardandoDireccion,
  errorDireccion,
  anulando,
  errorAnular,
  onGuardarDireccion,
  onAbrirEdicion,
  onAnular,
  onCerrarConfirmacion,
}: PropsTarjeta) {
  const nombre = nombreDeCobranza(cobranza);
  const importe = importeDeCobranza(cobranza);
  const direccion = cobranza.direccion;
  const tieneDireccion = Boolean(direccion.texto);
  const idNombre = `cobranza-nombre-${cobranza.id}`;

  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const botonEditar = useRef<HTMLButtonElement>(null);
  const botonAnular = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const botonNo = useRef<HTMLButtonElement>(null);
  // Al cerrar un panel el foco vuelve al boton que lo abrio: con teclado no
  // se pierde el lugar.
  const devolverFoco = useRef<"editar" | "anular" | null>(null);

  useEffect(() => {
    if (editando) campo.current?.focus();
    else if (devolverFoco.current === "editar") botonEditar.current?.focus();
    if (!editando && devolverFoco.current === "editar") devolverFoco.current = null;
  }, [editando]);
  // Si guardar falla, el campo se habilita de nuevo: el foco vuelve a el para corregir.
  const habiaGuardando = useRef(false);
  useEffect(() => {
    if (habiaGuardando.current && !guardandoDireccion && editando) campo.current?.focus();
    habiaGuardando.current = guardandoDireccion;
  }, [guardandoDireccion, editando]);
  useEffect(() => {
    if (confirmando) botonNo.current?.focus();
    else if (devolverFoco.current === "anular") botonAnular.current?.focus();
    if (!confirmando && devolverFoco.current === "anular") devolverFoco.current = null;
  }, [confirmando]);

  function abrirEdicion() {
    setTexto(direccion.texto ?? "");
    setErrorLocal(null);
    onAbrirEdicion();
    setEditando(true);
  }

  function cerrarEdicion() {
    devolverFoco.current = "editar";
    setEditando(false);
  }

  async function guardar() {
    const problema = validarDireccion(texto);
    setErrorLocal(problema);
    if (problema) return;
    const ok = await onGuardarDireccion(texto.trim());
    if (ok) cerrarEdicion();
  }

  function cerrarConfirmacion() {
    devolverFoco.current = "anular";
    onCerrarConfirmacion();
    setConfirmando(false);
  }

  const errorCampo = errorLocal ?? errorDireccion;
  const idError = `cobranza-direccion-error-${cobranza.id}`;
  const idCampo = `cobranza-direccion-${cobranza.id}`;

  return (
    <article className="cobranza-tarjeta" aria-labelledby={idNombre}>
      <div className="cobranza-fila-cuando">
        <span className={cobranza.horario ? "cobranza-horario" : "cobranza-horario cobranza-sin-horario"}>
          {cobranza.horario ?? "Sin horario"}
        </span>
        {importe && <span className="cobranza-importe">{importe}</span>}
      </div>

      <div className="cobranza-cliente">
        <h2 id={idNombre} className="cobranza-nombre">
          {nombre}
        </h2>
        <span className="cobranza-numero">{cobranza.numero_sn}</span>
      </div>

      {editando ? (
        <div className="cobranza-edicion">
          <label htmlFor={idCampo} className="cobranza-etiqueta-campo">
            Dirección de cobranza
          </label>
          <textarea
            id={idCampo}
            ref={campo}
            className="cobranza-campo"
            rows={3}
            value={texto}
            disabled={guardandoDireccion}
            aria-invalid={Boolean(errorCampo)}
            aria-describedby={errorCampo ? idError : undefined}
            onChange={(e) => {
              setTexto(e.target.value);
              setErrorLocal(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !guardandoDireccion) {
                e.stopPropagation();
                cerrarEdicion();
              }
            }}
          />
          {texto.trim().length > MAX_DIRECCION - 50 && (
            <p className={texto.trim().length > MAX_DIRECCION ? "cobranza-contador cobranza-contador-excedido" : "cobranza-contador"}>
              {texto.trim().length}/{MAX_DIRECCION}
            </p>
          )}
          {errorCampo && (
            <p id={idError} className="cobranza-error-campo">
              {errorCampo}
            </p>
          )}
          <div className="cobranza-acciones">
            <button type="button" className="cobranza-boton cobranza-boton-primario" disabled={guardandoDireccion} onClick={() => void guardar()}>
              {guardandoDireccion ? (
                <>
                  <span className="spinner" aria-hidden /> Guardando…
                </>
              ) : (
                "Guardar"
              )}
            </button>
            <button type="button" className="cobranza-boton" disabled={guardandoDireccion} onClick={cerrarEdicion}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="cobranza-direccion">
          {tieneDireccion ? (
            <>
              <p className="cobranza-direccion-texto">{direccion.texto}</p>
              <p className="cobranza-direccion-origen">{fraseOrigenDireccion(direccion, sapFallo)}</p>
            </>
          ) : (
            <p className="cobranza-direccion-falta">{fraseOrigenDireccion(direccion, sapFallo)}</p>
          )}
        </div>
      )}

      {!editando && !confirmando && (
        <div className="cobranza-acciones">
          <Link to={urlDeCliente(cobranza.card_code)} className="cobranza-boton" aria-label={`Ver ficha de ${nombre}`}>
            Ver ficha
          </Link>
          <button
            type="button"
            ref={botonEditar}
            className={tieneDireccion ? "cobranza-boton" : "cobranza-boton cobranza-boton-destacado"}
            aria-label={`${tieneDireccion ? "Editar dirección" : "Cargar dirección"} de ${nombre}`}
            onClick={abrirEdicion}
          >
            {tieneDireccion ? "Editar dirección" : "Cargar dirección"}
          </button>
          <button
            type="button"
            ref={botonAnular}
            className="cobranza-boton cobranza-boton-riesgo"
            aria-label={`Anular cobranza de ${nombre}`}
            onClick={() => setConfirmando(true)}
          >
            Anular
          </button>
        </div>
      )}

      {!editando && confirmando && (
        <div className="cobranza-confirmar" role="group" aria-label={`Confirmar anulación de ${nombre}`}>
          <p>¿Anular la cobranza de {nombre}?</p>
          <div className="cobranza-acciones">
            <button type="button" className="cobranza-boton cobranza-boton-riesgo-lleno" disabled={anulando} onClick={() => void onAnular()}>
              {anulando ? (
                <>
                  <span className="spinner" aria-hidden /> Anulando…
                </>
              ) : (
                "Sí, anular"
              )}
            </button>
            <button
              type="button"
              ref={botonNo}
              className="cobranza-boton"
              disabled={anulando}
              onClick={cerrarConfirmacion}
              onKeyDown={(e) => {
                if (e.key === "Escape") cerrarConfirmacion();
              }}
            >
              No
            </button>
          </div>
        </div>
      )}

      {errorAnular && (
        <p role="alert" className="cobranza-error-campo">
          {errorAnular}
        </p>
      )}
    </article>
  );
}

// Lo que sale en papel (o en el PDF): solo lo que el cobrador necesita en la
// calle. En pantalla esta oculta (display: none); @media print la muestra y
// oculta todo lo demas (cobranza.css). Usa los datos que la pantalla ya tiene.
function HojaImpresion({ fecha, cobranzas }: { fecha: string; cobranzas: CobranzaProgramada[] }) {
  return (
    <section className="cobranza-impresion" aria-label="Vista de impresión">
      <header className="cobranza-impresion-encabezado">
        <h1 className="cobranza-impresion-titulo">{tituloImpresion(fecha)}</h1>
        <p className="cobranza-impresion-cuenta">{textoCantidad(cobranzas.length)}</p>
      </header>
      <ol className="cobranza-impresion-lista">
        {cobranzas.map((c) => {
          const importe = importeDeCobranza(c);
          return (
            <li key={c.id} className="cobranza-impresion-item">
              <p className="cobranza-impresion-horario">{c.horario ?? "Sin horario"}</p>
              <div className="cobranza-impresion-datos">
                <p className="cobranza-impresion-cliente">
                  <span className="cobranza-impresion-nombre">{nombreDeCobranza(c)}</span>
                  <span className="cobranza-impresion-numero">{c.numero_sn}</span>
                </p>
                <p className={c.direccion.texto ? "cobranza-impresion-direccion" : "cobranza-impresion-direccion cobranza-impresion-sin-direccion"}>
                  {c.direccion.texto ?? "Sin dirección"}
                </p>
              </div>
              {importe && <p className="cobranza-impresion-importe">{importe}</p>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
