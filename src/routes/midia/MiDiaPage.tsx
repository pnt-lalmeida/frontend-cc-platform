import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Link } from "react-router-dom";
import type { ClientesDelDia, MiDiaResponse } from "../../api/types";
import { BadgePiloto } from "../../components/BadgePiloto";
import { useFeatures } from "../../features/FeaturesContext";
import { FilaMiDia } from "./FilaMiDia";
import {
  armarParaHoy,
  armarVista,
  fechaEncabezado,
  nombreCliente,
  resumenGrupo,
  textoQuedan,
  type ClaveGrupo,
  type ParaHoy,
  type VistaClientes,
} from "./miDia";
import { useApiMiDia } from "./useApiMiDia";
import { useMiDia } from "./useMiDia";
import { useRegistroMiDia } from "./useRegistroMiDia";

// Fase 6 CRM (30/09/2026): "Mi dia", la agenda diaria del equipo. Es una lista
// de trabajo, no un dashboard: arriba cuanto falta, despues el trabajo.
// Quien monta la ruta decide el gating (feature "mi_dia"): sin habilitar, ni
// se monta esta pagina ni se hace ningun fetch.

export function MiDiaPage() {
  const { habilitada, enPiloto } = useFeatures();
  const api = useApiMiDia();
  const { datos, cargando, error, recargar } = useMiDia(api.obtener);
  const registro = useRegistroMiDia(api.registro);
  const [soloVencido, setSoloVencido] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [formAbierto, setFormAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  // Cliente recien registrado desde el que hay que mover el foco (ver efecto).
  const [saltoDesde, setSaltoDesde] = useState<string | null>(null);
  const raizRef = useRef<HTMLDivElement>(null);
  const progresoRef = useRef<HTMLParagraphElement>(null);

  const { reiniciar } = registro;
  const actualizar = useCallback(async () => {
    const ok = await recargar();
    // Recien con los datos nuevos se sueltan los "recien gestionados": si la
    // recarga fallo, la pantalla sigue mostrando lo que el usuario ya hizo.
    if (ok) reiniciar();
    return ok;
  }, [recargar, reiniciar]);

  const puedeRegistrar = habilitada("bitacora");
  const clientesDelDia = datos?.clientes_del_dia ?? null;

  const vista = useMemo(
    () =>
      clientesDelDia && clientesDelDia.es_dia_habil
        ? armarVista(clientesDelDia.clientes, { recienHechos: registro.recienHechos, soloVencido, busqueda })
        : null,
    [clientesDelDia, registro.recienHechos, soloVencido, busqueda]
  );
  const paraHoy = useMemo(
    () => (datos ? armarParaHoy(datos.tareas ?? [], datos.promesas ?? [], datos.fecha) : null),
    [datos]
  );

  async function registrar(cardCode: string, resultado: string, nota: string): Promise<boolean> {
    const cliente = clientesDelDia?.clientes.find((c) => c.card_code === cardCode);
    const ok = await registro.registrar(cardCode, { resultado, ...(nota ? { nota } : {}) });
    if (ok && cliente) {
      const nombre = nombreCliente(cliente);
      setAviso(
        resultado === "No contactado"
          ? `Anotado: ${nombre} sigue pendiente`
          : `Gestión registrada: ${nombre}`
      );
    }
    if (ok) setSaltoDesde(cardCode);
    return ok;
  }

  // Al terminar una gestion el foco pasa al boton Registrar de la siguiente
  // fila pendiente (en el orden en que se ve, salteando las ya hechas): con
  // cientos de filas, bajar sin tocar el mouse es lo que hace rapido el dia.
  // Si no hay ninguna mas, lo dice y deja el foco en el progreso en vez de
  // perderlo. Espera a que el cliente figure como registrado para no decidir
  // con un progreso viejo.
  const { recienHechos, anotados } = registro;
  useEffect(() => {
    if (saltoDesde === null || !vista) return;
    if (!recienHechos.has(saltoDesde) && !anotados.has(saltoDesde)) return;
    const filas = Array.from(raizRef.current?.querySelectorAll<HTMLElement>("li.midia-fila[data-card-code]") ?? []);
    const indice = filas.findIndex((f) => f.dataset.cardCode === saltoDesde);
    const siguiente = filas.slice(indice + 1).find((f) => f.dataset.apagada !== "true");
    if (siguiente) {
      (siguiente.querySelector<HTMLElement>("button.midia-boton") ?? siguiente).focus();
    } else {
      (progresoRef.current ?? filas[indice])?.focus();
      const frase = vista.quedan === 0 ? "Era el último pendiente." : "No hay más pendientes debajo de este cliente.";
      setAviso((previo) => `${previo}. ${frase}`);
    }
    setSaltoDesde(null);
  }, [saltoDesde, vista, recienHechos, anotados]);

  return (
    <div className="midia" ref={raizRef}>
      <div role="status" aria-live="polite" className="sr-only">
        {aviso}
      </div>

      {!datos ? (
        error ? (
          <ErrorBloque texto={error} onReintentar={() => void actualizar()} />
        ) : (
          <p className="midia-muted">{cargando ? "Cargando Mi día..." : ""}</p>
        )
      ) : (
        <>
          <Encabezado
            datos={datos}
            vista={vista}
            clientes={clientesDelDia}
            piloto={enPiloto("mi_dia")}
            cargando={cargando}
            progresoRef={progresoRef}
            onActualizar={() => void actualizar()}
          />
          {error && <ErrorBloque texto={error} onReintentar={() => void actualizar()} compacto />}

          {paraHoy && (paraHoy.hayAlgo || datos.tareas === null || promesasFallaron(datos)) && (
            <SeccionParaHoy datos={datos} paraHoy={paraHoy} />
          )}

          <SeccionClientes
            clientes={clientesDelDia}
            vista={vista}
            soloVencido={soloVencido}
            onSoloVencido={() => setSoloVencido((v) => !v)}
            busqueda={busqueda}
            onBusqueda={setBusqueda}
            onReintentar={() => void actualizar()}
            renderFila={(cliente, apagada) => (
              <FilaMiDia
                key={cliente.card_code}
                cliente={cliente}
                apagada={apagada}
                anotada={registro.anotados.has(cliente.card_code)}
                puedeRegistrar={puedeRegistrar}
                abierta={formAbierto === cliente.card_code}
                enviando={registro.enviandoIds.includes(cliente.card_code)}
                error={registro.errores[cliente.card_code] ?? null}
                resultados={registro.resultados}
                onAbrir={(cardCode) => {
                  registro.limpiarError(cardCode);
                  setFormAbierto(cardCode);
                }}
                onCerrar={() => setFormAbierto(null)}
                onRegistrar={registrar}
              />
            )}
          />

          <Pie datos={datos} clientes={clientesDelDia} />
        </>
      )}
    </div>
  );
}

function promesasFallaron(datos: MiDiaResponse): boolean {
  return datos.promesas === null && datos.habilitadas.promesas;
}

function ErrorBloque({ texto, onReintentar, compacto }: { texto: string; onReintentar: () => void; compacto?: boolean }) {
  return (
    <div role="alert" className={compacto ? "midia-error-bloque midia-error-compacto" : "midia-error-bloque"}>
      <span>{texto}</span>
      <button type="button" className="midia-boton" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ encabezado */

function Encabezado({
  datos,
  vista,
  clientes,
  piloto,
  cargando,
  progresoRef,
  onActualizar,
}: {
  datos: MiDiaResponse;
  vista: VistaClientes | null;
  clientes: ClientesDelDia | null;
  piloto: boolean;
  cargando: boolean;
  progresoRef: RefObject<HTMLParagraphElement>;
  onActualizar: () => void;
}) {
  // Sin saber que se gestiono hoy no hay progreso que mostrar: fingirlo
  // ("Te quedan 198 de 198") seria peor que no decirlo.
  const progreso = vista && clientes?.gestion_conocida && vista.total > 0;
  return (
    <>
      <header className="midia-encabezado">
        <div className="midia-encabezado-fila">
          <h1 className="midia-titulo">{fechaEncabezado(datos.fecha)}</h1>
          {piloto && <BadgePiloto />}
          <span className="midia-espacio" />
          <button type="button" className="midia-boton" disabled={cargando} onClick={onActualizar}>
            {cargando ? (
              <>
                <span className="spinner" aria-hidden="true" /> Actualizando
              </>
            ) : (
              "Actualizar"
            )}
          </button>
        </div>
      </header>
      {/* El progreso es lo que distingue esta pantalla de una planilla: queda
          pegado arriba al hacer scroll (la fecha, no). */}
      {vista && vista.total > 0 && (
        <div className="midia-progreso">
          {progreso ? (
            <>
              <p className="midia-quedan" ref={progresoRef} tabIndex={-1}>
                {textoQuedan(vista.quedan, vista.total)}
              </p>
              <div
                role="progressbar"
                aria-label="Progreso de hoy"
                aria-valuemin={0}
                aria-valuemax={vista.total}
                aria-valuenow={vista.hechos}
                className="midia-barra"
              >
                <div className="midia-barra-relleno" style={{ width: `${(vista.hechos / vista.total) * 100}%` }} />
              </div>
            </>
          ) : (
            <p className="midia-quedan" ref={progresoRef} tabIndex={-1}>
              {vista.total === 1 ? "1 cliente hoy" : `${vista.total} clientes hoy`}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------- para hoy */

function SeccionParaHoy({ datos, paraHoy }: { datos: MiDiaResponse; paraHoy: ParaHoy }) {
  const otros = paraHoy.recordatoriosDeOtros;
  return (
    <section aria-labelledby="midia-para-hoy" className="midia-para-hoy">
      <h2 id="midia-para-hoy" className="midia-h2">
        Para hoy
      </h2>
      <ul className="midia-lista-simple">
        {paraHoy.promesas.map((p) => (
          <li key={`p${p.id}`}>
            <span>Promesa: </span>
            <strong>{p.cliente}</strong>
            <span className="midia-mono">, {p.importe}</span>
            <span className="midia-muted"> · {p.cuando}</span>
          </li>
        ))}
        {paraHoy.recordatoriosMios.map((t) => (
          <li key={`t${t.id}`}>
            <span className={t.vencido ? "midia-vencido-texto" : undefined}>
              {t.vencido ? "Recordatorio vencido:" : "Recordatorio de hoy:"}
            </span>{" "}
            <span>{t.descripcion}</span>
            {t.cliente && <strong> · {t.cliente}</strong>}
            <span className="midia-muted"> ({t.cuando})</span>
          </li>
        ))}
      </ul>
      {datos.tareas === null && <p className="midia-error midia-linea">No se pudieron cargar los recordatorios.</p>}
      {promesasFallaron(datos) && <p className="midia-error midia-linea">No se pudieron cargar las promesas.</p>}
      {otros.length > 0 && (
        <details className="midia-detalle">
          <summary>
            {otros.length === 1 ? "1 recordatorio de otras personas" : `${otros.length} recordatorios de otras personas`}
          </summary>
          <ul className="midia-lista-simple">
            {otros.map((t) => (
              <li key={`o${t.id}`}>
                <span>{t.descripcion}</span>
                {t.cliente && <strong> · {t.cliente}</strong>}
                <span className="midia-muted"> ({t.cuando})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- clientes */

function SeccionClientes({
  clientes,
  vista,
  soloVencido,
  onSoloVencido,
  busqueda,
  onBusqueda,
  onReintentar,
  renderFila,
}: {
  clientes: ClientesDelDia | null;
  vista: VistaClientes | null;
  soloVencido: boolean;
  onSoloVencido: () => void;
  busqueda: string;
  onBusqueda: (texto: string) => void;
  onReintentar: () => void;
  renderFila: (cliente: ClientesDelDia["clientes"][number], apagada: boolean) => JSX.Element;
}) {
  const [abiertos, setAbiertos] = useState<Partial<Record<ClaveGrupo, boolean>>>({});
  const [verHechos, setVerHechos] = useState(false);
  const campoRef = useRef<HTMLInputElement>(null);

  // Una lista vacia aca se leeria como "no hay nadie que contactar": cuando
  // el bloque fallo (null) se dice que no se pudo cargar.
  if (clientes === null) {
    return <ErrorBloque texto="No se pudo cargar la lista de clientes de hoy." onReintentar={onReintentar} />;
  }
  if (!vista || vista.total === 0) {
    return <p className="midia-vacio">Hoy no hay clientes de seguimiento.</p>;
  }

  // Buscando, los grupos con coincidencias se ven abiertos (el que llama
  // pregunta por UN cliente, no quiere ir abriendo grupos): pasan a ser un
  // titulo fijo hasta que se limpia la busqueda.
  const buscando = vista.coinciden !== null;
  const textoBusqueda = busqueda.trim();

  function limpiar() {
    onBusqueda("");
    campoRef.current?.focus();
  }

  return (
    <div className="midia-clientes">
      {!clientes.gestion_conocida && (
        <p className="midia-aviso" role="note">
          No se pudo saber cuáles ya gestionaste hoy: se muestran todos.
        </p>
      )}
      <div className="midia-barra-herramientas">
        <div className="midia-buscador">
          <input
            ref={campoRef}
            type="search"
            className="midia-control midia-buscar"
            aria-label="Buscar cliente"
            placeholder="Buscar por nombre o número"
            autoComplete="off"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && busqueda) {
                e.preventDefault();
                onBusqueda("");
              }
            }}
          />
          {busqueda && (
            <button type="button" className="midia-boton midia-limpiar" onClick={limpiar}>
              Limpiar búsqueda
            </button>
          )}
        </div>
        <button type="button" className="midia-filtro" aria-pressed={soloVencido} onClick={onSoloVencido}>
          Solo con vencido
        </button>
      </div>
      {/* Sin role="status": ya hay una region viva (la de avisos) y esta es
          solo el conteo, que se anuncia con cortesia. */}
      <p className="midia-conteo" aria-live="polite">
        {buscando ? `${vista.coinciden} de ${vista.total} clientes` : ""}
      </p>

      {buscando && vista.coinciden === 0 && <p className="midia-vacio">Ningún cliente coincide con «{textoBusqueda}».</p>}
      {!buscando && soloVencido && vista.grupos.length === 0 && vista.quedan > 0 && (
        <p className="midia-vacio">Ningún cliente pendiente tiene vencido.</p>
      )}

      {vista.grupos.map((grupo, indice) => {
        const abierto = buscando || (abiertos[grupo.clave] ?? indice === 0);
        const idLista = `midia-grupo-${grupo.clave}`;
        const titulo = `${grupo.titulo} · ${resumenGrupo(grupo.clave, grupo.pendientes)}`;
        return (
          <section key={grupo.clave} className="midia-grupo">
            <h2 className="midia-h2 midia-grupo-titulo">
              {buscando ? (
                <span className="midia-grupo-boton midia-grupo-fijo">{titulo}</span>
              ) : (
                <button
                  type="button"
                  className="midia-grupo-boton"
                  aria-expanded={abierto}
                  aria-controls={idLista}
                  onClick={() => setAbiertos((previos) => ({ ...previos, [grupo.clave]: !abierto }))}
                >
                  <span>{titulo}</span>
                  <span className="midia-grupo-accion" aria-hidden="true">
                    {abierto ? "ocultar" : "mostrar"}
                  </span>
                </button>
              )}
            </h2>
            {abierto && (
              <ul id={idLista} aria-label={`Clientes de ${grupo.titulo}`} className="midia-lista">
                {grupo.filas.map((fila) => renderFila(fila.cliente, fila.apagada))}
              </ul>
            )}
          </section>
        );
      })}

      {(buscando ? vista.hechosLista.length > 0 : vista.hechos > 0) && (
        <section className="midia-grupo midia-hechos">
          <h2 className="midia-h2 midia-grupo-titulo">
            {buscando ? (
              <span className="midia-grupo-boton midia-grupo-fijo">Hechos hoy · {vista.hechosLista.length}</span>
            ) : (
              <button
                type="button"
                className="midia-grupo-boton"
                aria-expanded={verHechos}
                aria-controls="midia-hechos-lista"
                onClick={() => setVerHechos((v) => !v)}
              >
                <span>Hechos hoy · {vista.hechos}</span>
                <span className="midia-grupo-accion" aria-hidden="true">
                  {verHechos ? "ocultar" : "mostrar"}
                </span>
              </button>
            )}
          </h2>
          {(buscando || verHechos) && (
            <ul id="midia-hechos-lista" aria-label="Clientes hechos hoy" className="midia-lista">
              {vista.hechosLista.map((cliente) => renderFila(cliente, true))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- pie */

function Pie({ datos, clientes }: { datos: MiDiaResponse; clientes: ClientesDelDia | null }) {
  const pedidos = datos.pedidos_bandeja;
  const alertas = datos.alertas;
  const zonas = clientes?.zonas_no_reconocidas ?? [];
  const lineas: JSX.Element[] = [];

  if (pedidos === null) {
    lineas.push(
      <li key="pedidos" className="midia-error">
        No se pudo cargar el conteo de pedidos de la Bandeja.
      </li>
    );
  } else if (pedidos.pendientes > 0) {
    lineas.push(
      <li key="pedidos">
        <Link to="/bandeja" className="midia-enlace-pie">
          {pedidos.pendientes === 1 ? "1 pedido pendiente en la Bandeja" : `${pedidos.pendientes} pedidos pendientes en la Bandeja`}
        </Link>
      </li>
    );
  }

  // Con alertas apagadas el backend manda null a proposito: no es un error.
  if (datos.habilitadas.alertas) {
    if (alertas === null) {
      lineas.push(
        <li key="alertas" className="midia-error">
          No se pudo cargar el conteo de alertas.
        </li>
      );
    } else if (alertas.abiertas > 0) {
      const abiertas = alertas.abiertas === 1 ? "1 alerta abierta" : `${alertas.abiertas} alertas abiertas`;
      lineas.push(<li key="alertas">{alertas.no_vistas > 0 ? `${abiertas}, ${alertas.no_vistas} sin ver` : abiertas}</li>);
    }
  }

  if (lineas.length === 0 && zonas.length === 0) return null;
  return (
    <footer className="midia-pie">
      {lineas.length > 0 && <ul className="midia-lista-simple midia-pie-lista">{lineas}</ul>}
      {zonas.length > 0 && (
        <details className="midia-detalle">
          <summary>
            {zonas.length === 1
              ? "1 cuenta con un día de seguimiento que no se pudo interpretar"
              : `${zonas.length} cuentas con un día de seguimiento que no se pudo interpretar`}
          </summary>
          <ul className="midia-lista-simple">
            {zonas.map((z) => (
              <li key={z.card_code}>
                <span className="midia-mono">{z.card_code}</span>
                <span className="midia-muted"> · zona: {z.zona ?? "(vacía)"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </footer>
  );
}
