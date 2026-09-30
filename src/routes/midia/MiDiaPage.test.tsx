import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClienteDelDia, ClientesDelDia, MiDiaResponse, PromesaMiDia, TareaMiDia } from "../../api/types";
import type { FeatureNombre } from "../../features/features";
import { MiDiaPage } from "./MiDiaPage";

// Fase 6 CRM: "Mi dia". Lista de trabajo: lo que falta, en orden de trabajo,
// con el registro de la gestion sin salir de la pantalla.

const featuresHabilitadas = new Set<FeatureNombre>();
let piloto = false;
const obtener = vi.fn();
const registrar = vi.fn();
const obtenerResultados = vi.fn();

vi.mock("../../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (nombre: FeatureNombre) => featuresHabilitadas.has(nombre),
    enPiloto: () => piloto,
    esSupervisor: false,
    cargando: false,
  }),
}));
const apiMock = {
  obtener: () => obtener(),
  registro: {
    registrar: (...args: unknown[]) => registrar(...args),
    obtenerResultados: (...args: unknown[]) => obtenerResultados(...args),
  },
};
vi.mock("./useApiMiDia", () => ({ useApiMiDia: () => apiMock }));

function cliente(parcial: Partial<ClienteDelDia> = {}): ClienteDelDia {
  return {
    card_code: "C1-02928",
    nombre: "Dulces del Sur",
    numero_sn: "02928",
    clave: "02928",
    moneda: "UYU",
    saldo: 11360,
    saldo_en_otra_moneda: false,
    tiene_vencido: false,
    canal: "manual",
    origen: "dia",
    gestionada_hoy: false,
    ...parcial,
  };
}

function clientesDelDia(clientes: ClienteDelDia[], parcial: Partial<ClientesDelDia> = {}): ClientesDelDia {
  const hechos = clientes.filter((c) => c.gestionada_hoy === true).length;
  return {
    fecha: "2026-09-30",
    dia: "MIERCOLES",
    es_dia_habil: true,
    gestion_conocida: true,
    total: clientes.length,
    gestionados_hoy: hechos,
    pendientes: clientes.length - hechos,
    zonas_no_reconocidas: [],
    clientes,
    ...parcial,
  };
}

function respuesta(parcial: Partial<MiDiaResponse> = {}): MiDiaResponse {
  return {
    fecha: "2026-09-30",
    dia: "MIERCOLES",
    clientes_del_dia: clientesDelDia([]),
    tareas: [],
    promesas: [],
    alertas: { abiertas: 0, no_vistas: 0 },
    pedidos_bandeja: { pendientes: 0 },
    habilitadas: { promesas: true, alertas: true },
    errores: [],
    ...parcial,
  };
}

function tarea(parcial: Partial<TareaMiDia> = {}): TareaMiDia {
  return {
    id: 1,
    descripcion: "Llamar por la factura",
    fecha_objetivo: "2026-09-28",
    estado: "pendiente",
    responsable: "rlopez@pontyn.com.uy",
    creada_por: "rlopez@pontyn.com.uy",
    creada_utc: "2026-09-25T12:00:00Z",
    completada_utc: null,
    numero_sn: "00001",
    cliente_nombre: "Pinturas Norte",
    es_mia: true,
    ...parcial,
  };
}

function promesa(parcial: Partial<PromesaMiDia> = {}): PromesaMiDia {
  return {
    id: 5,
    numero_sn: "00002",
    card_code: "C1-00002",
    fecha_prometida: "2026-09-30",
    importe: 45000,
    moneda: "UYU",
    canal: null,
    facturas: null,
    registrada_por: "rlopez@pontyn.com.uy",
    registrada_utc: "2026-09-25T12:00:00Z",
    estado: "vigente",
    estado_utc: null,
    importe_verificado: null,
    cliente_nombre: "Chocolates del Este",
    ...parcial,
  };
}

function montar() {
  return render(
    <MemoryRouter>
      <MiDiaPage />
    </MemoryRouter>
  );
}

const LISTA_BASE = [
  cliente({ card_code: "C1-06527", numero_sn: "06527", nombre: "Fútbol Ejemplo", saldo: 8200 }),
  cliente({ card_code: "C1-02928", numero_sn: "02928", nombre: "Dulces del Sur", tiene_vencido: true }),
  cliente({ card_code: "C2-07094", numero_sn: "07094", nombre: "Betabel Ejemplo", moneda: "USD", saldo: 2100 }),
  cliente({ card_code: "C1-08001", numero_sn: "08001", nombre: "Correo Uno", canal: "mail" }),
  cliente({ card_code: "C1-08002", numero_sn: "08002", nombre: "Correo Dos", canal: "whatsapp", gestionada_hoy: true }),
  cliente({ card_code: "C1-09001", numero_sn: "09001", nombre: "Mensual Uno", origen: "mensual" }),
];

beforeEach(() => {
  featuresHabilitadas.clear();
  featuresHabilitadas.add("mi_dia");
  featuresHabilitadas.add("bitacora");
  piloto = false;
  obtener.mockReset();
  registrar.mockReset();
  obtenerResultados.mockReset();
  obtenerResultados.mockResolvedValue(["Gestionado", "No contactado", "Pago coordinado"]);
  registrar.mockResolvedValue({});
  obtener.mockResolvedValue(respuesta({ clientes_del_dia: clientesDelDia(LISTA_BASE) }));
});

describe("MiDiaPage: encabezado", () => {
  it("dice la fecha y cuánto falta, con la barra de progreso", async () => {
    montar();
    expect(await screen.findByRole("heading", { level: 1, name: "Miércoles 30 de setiembre" })).toBeTruthy();
    expect(screen.getByText("Te quedan 5 de 6")).toBeTruthy();
    const barra = screen.getByRole("progressbar", { name: "Progreso de hoy" });
    expect(barra.getAttribute("aria-valuenow")).toBe("1");
    expect(barra.getAttribute("aria-valuemax")).toBe("6");
  });

  it("mientras carga no muestra una lista vacía", () => {
    obtener.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByText("Cargando Mi día...")).toBeTruthy();
    expect(screen.queryByText(/Te quedan/)).toBeNull();
  });

  it("con la función en piloto lo indica", async () => {
    piloto = true;
    montar();
    await screen.findByText("Te quedan 5 de 6");
    expect(screen.getByText("Piloto")).toBeTruthy();
  });

  it("si falla la carga inicial dice qué pasó y deja reintentar", async () => {
    obtener.mockRejectedValueOnce(new Error("boom"));
    montar();
    expect(await screen.findByText("No se pudo cargar Mi día.")).toBeTruthy();
    expect(screen.queryByText("Cargando Mi día...")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Te quedan 5 de 6")).toBeTruthy();
  });

  it("Actualizar vuelve a pedir la pantalla", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(obtener).toHaveBeenCalledTimes(2));
  });
});

describe("MiDiaPage: grupos y filas", () => {
  it("Manual abierto primero con su orden por número; los demás grupos, cerrados", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const titulos = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(titulos[0]).toMatch(/^Manual.*3 pendientes/);
    expect(titulos[1]).toMatch(/^Automáticos.*1 pendiente/);
    expect(titulos[2]).toMatch(/^Mensuales.*1 sin gestionar este mes/);

    const manual = screen.getByRole("list", { name: "Clientes de Manual" });
    const nombres = within(manual)
      .getAllByRole("listitem")
      .map((li) => within(li).getByTestId("midia-nombre").textContent);
    expect(nombres).toEqual(["Dulces del Sur", "Fútbol Ejemplo", "Betabel Ejemplo"]);
    expect(screen.queryByRole("list", { name: "Clientes de Automáticos" })).toBeNull();
  });

  it("cada grupo se abre y se cierra, y dice su estado", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const botonAuto = screen.getByRole("button", { name: /Automáticos/ });
    expect(botonAuto.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(botonAuto);
    expect(botonAuto.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("list", { name: "Clientes de Automáticos" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Manual/ }));
    expect(screen.queryByRole("list", { name: "Clientes de Manual" })).toBeNull();
  });

  it("el saldo va en la moneda de la cuenta, sin sumar monedas, y el vencido se marca sin inventar un importe", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const filas = within(screen.getByRole("list", { name: "Clientes de Manual" })).getAllByRole("listitem");
    expect(within(filas[0]).getByText("$ 11.360")).toBeTruthy();
    expect(within(filas[0]).getByText("vencido")).toBeTruthy();
    expect(within(filas[1]).queryByText("vencido")).toBeNull();
    expect(within(filas[2]).getByText("US$ 2.100")).toBeTruthy();
    // Ningun total mezclado.
    expect(screen.queryByText(/Total/i)).toBeNull();
  });

  it("un saldo en otra moneda se avisa con discreción", async () => {
    obtener.mockResolvedValue(
      respuesta({ clientes_del_dia: clientesDelDia([cliente({ saldo_en_otra_moneda: true })]) })
    );
    montar();
    await screen.findByText("Te queda 1 de 1");
    expect(screen.getByText("también en otra moneda")).toBeTruthy();
  });

  it("el filtro 'Solo con vencido' es opcional y no cambia el progreso", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const filtro = screen.getByRole("button", { name: "Solo con vencido" });
    expect(filtro.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(filtro);
    expect(filtro.getAttribute("aria-pressed")).toBe("true");
    const manual = screen.getByRole("list", { name: "Clientes de Manual" });
    expect(within(manual).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("Te quedan 5 de 6")).toBeTruthy();
  });

  it("si ningún pendiente tiene vencido, el filtro lo dice en vez de dejar la pantalla vacía", async () => {
    obtener.mockResolvedValue(respuesta({ clientes_del_dia: clientesDelDia([cliente()]) }));
    montar();
    await screen.findByText("Te queda 1 de 1");
    fireEvent.click(screen.getByRole("button", { name: "Solo con vencido" }));
    expect(screen.getByText("Ningún cliente pendiente tiene vencido.")).toBeTruthy();
  });
});

describe("MiDiaPage: hechos hoy", () => {
  it("los ya gestionados se cuentan en 'Hechos hoy', colapsado, y se pueden ver", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const boton = screen.getByRole("button", { name: /Hechos hoy · 1/ });
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Correo Dos")).toBeNull();
    fireEvent.click(boton);
    expect(screen.getByText("Correo Dos")).toBeTruthy();
  });

  it("sin ninguno hecho no muestra la sección", async () => {
    obtener.mockResolvedValue(respuesta({ clientes_del_dia: clientesDelDia([cliente()]) }));
    montar();
    await screen.findByText("Te queda 1 de 1");
    expect(screen.queryByRole("button", { name: /Hechos hoy/ })).toBeNull();
  });

  it("cuando no queda ninguno lo dice", async () => {
    obtener.mockResolvedValue(
      respuesta({ clientes_del_dia: clientesDelDia([cliente({ gestionada_hoy: true }), cliente({ card_code: "C1-2", gestionada_hoy: true })]) })
    );
    montar();
    expect(await screen.findByText("No te queda ninguno de los 2 de hoy")).toBeTruthy();
  });
});

describe("MiDiaPage: registrar sin salir", () => {
  async function abrirFormulario(nombre = "Dulces del Sur") {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    fireEvent.click(screen.getByRole("button", { name: `Registrar gestión de ${nombre}` }));
    return await screen.findByRole("group", { name: `Registrar gestión de ${nombre}` });
  }

  it("sin la función de Bitácora no hay botón de registrar", async () => {
    featuresHabilitadas.delete("bitacora");
    montar();
    await screen.findByText("Te quedan 5 de 6");
    expect(screen.queryByRole("button", { name: /Registrar gestión de/ })).toBeNull();
    expect(obtenerResultados).not.toHaveBeenCalled();
  });

  it("abre un formulario compacto con la lista de resultados que ya viaja y le da el foco", async () => {
    const form = await abrirFormulario();
    const select = await within(form).findByLabelText("Resultado");
    expect(within(select as HTMLElement).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Elegí el resultado",
      "Gestionado",
      "No contactado",
      "Pago coordinado",
    ]);
    expect(obtenerResultados).toHaveBeenCalledWith("C1-02928");
    await waitFor(() => expect(document.activeElement).toBe(select));
  });

  it("sin elegir resultado muestra el error junto al campo y no llama a la API", async () => {
    const form = await abrirFormulario();
    await within(form).findByLabelText("Resultado");
    fireEvent.click(within(form).getByRole("button", { name: "Guardar" }));
    const error = within(form).getByText("Elegí un resultado.");
    expect(error.getAttribute("role")).toBe("alert");
    expect(within(form).getByLabelText("Resultado").getAttribute("aria-describedby")).toBe(error.id);
    expect(registrar).not.toHaveBeenCalled();
  });

  it("al guardar la fila se apaga en su lugar, sin desaparecer, y el progreso avanza", async () => {
    const form = await abrirFormulario();
    fireEvent.change(await within(form).findByLabelText("Resultado"), { target: { value: "Pago coordinado" } });
    fireEvent.change(within(form).getByLabelText("Nota (opcional)"), { target: { value: " Paga el viernes " } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar" }));

    await screen.findByText("Te quedan 4 de 6");
    expect(registrar).toHaveBeenCalledWith("C1-02928", { resultado: "Pago coordinado", nota: "Paga el viernes" });
    const manual = screen.getByRole("list", { name: "Clientes de Manual" });
    const filas = within(manual).getAllByRole("listitem");
    // Sigue en el mismo lugar: las de abajo no saltan.
    expect(within(filas[0]).getByTestId("midia-nombre").textContent).toBe("Dulces del Sur");
    expect(filas[0].getAttribute("data-apagada")).toBe("true");
    expect(within(filas[0]).getByText("Hecho")).toBeTruthy();
    expect(within(filas[0]).queryByRole("button", { name: /Registrar gestión/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/Gestión registrada: Dulces del Sur/);
    // No recarga toda la pantalla.
    expect(obtener).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("group", { name: /Registrar gestión de/ })).toBeNull();
  });

  it("'No contactado' queda anotado pero el cliente sigue pendiente", async () => {
    const form = await abrirFormulario();
    fireEvent.change(await within(form).findByLabelText("Resultado"), { target: { value: "No contactado" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar" }));

    await screen.findByText("Sin contactar");
    expect(screen.getByText("Te quedan 5 de 6")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registrar gestión de Dulces del Sur" })).toBeTruthy();
  });

  it("mientras guarda deshabilita sus controles (y solo esos)", async () => {
    let resolver: (v: unknown) => void = () => {};
    registrar.mockReturnValue(new Promise((r) => (resolver = r)));
    const form = await abrirFormulario();
    fireEvent.change(await within(form).findByLabelText("Resultado"), { target: { value: "Gestionado" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar" }));

    const guardar = await within(form).findByRole("button", { name: "Guardando..." });
    expect((guardar as HTMLButtonElement).disabled).toBe(true);
    expect((within(form).getByLabelText("Resultado") as HTMLSelectElement).disabled).toBe(true);
    expect((within(form).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(guardar);
    expect(registrar).toHaveBeenCalledTimes(1);
    // El resto de la pantalla sigue usable.
    expect((screen.getByRole("button", { name: "Registrar gestión de Fútbol Ejemplo" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Actualizar" }) as HTMLButtonElement).disabled).toBe(false);
    resolver({});
    await screen.findByText("Te quedan 4 de 6");
  });

  it("si falla deja el formulario abierto con el error junto a los botones y se puede reintentar", async () => {
    registrar.mockRejectedValueOnce(new Error("boom"));
    const form = await abrirFormulario();
    fireEvent.change(await within(form).findByLabelText("Resultado"), { target: { value: "Gestionado" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar" }));

    expect(await within(form).findByText("No se pudo registrar la gestión. Intentá de nuevo.")).toBeTruthy();
    expect(screen.getByText("Te quedan 5 de 6")).toBeTruthy();
    fireEvent.click(within(form).getByRole("button", { name: "Guardar" }));
    await screen.findByText("Te quedan 4 de 6");
  });

  it("Escape cierra el formulario y devuelve el foco al botón", async () => {
    const form = await abrirFormulario();
    await within(form).findByLabelText("Resultado");
    fireEvent.keyDown(within(form).getByLabelText("Resultado"), { key: "Escape" });
    expect(screen.queryByRole("group", { name: /Registrar gestión de/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Registrar gestión de Dulces del Sur" }));
  });

  it("si la lista de resultados no carga lo dice y deja reintentar", async () => {
    obtenerResultados.mockRejectedValueOnce(new Error("boom"));
    const form = await abrirFormulario();
    expect(await within(form).findByText("No se pudo cargar la lista de resultados.")).toBeTruthy();
    fireEvent.click(within(form).getByRole("button", { name: "Reintentar" }));
    expect(await within(form).findByLabelText("Resultado")).toBeTruthy();
  });

  it("tras Actualizar, los recién gestionados pasan a 'Hechos hoy' con los datos del servidor", async () => {
    const form = await abrirFormulario();
    fireEvent.change(await within(form).findByLabelText("Resultado"), { target: { value: "Gestionado" } });
    fireEvent.click(within(form).getByRole("button", { name: "Guardar" }));
    await screen.findByText("Te quedan 4 de 6");

    const lista = LISTA_BASE.map((c) => (c.card_code === "C1-02928" ? { ...c, gestionada_hoy: true } : c));
    obtener.mockResolvedValue(respuesta({ clientes_del_dia: clientesDelDia(lista) }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Hechos hoy · 2/ })).toBeTruthy());
    const manual = screen.getByRole("list", { name: "Clientes de Manual" });
    expect(within(manual).getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("MiDiaPage: bloques que fallaron o vacíos", () => {
  it("si la lista de clientes es null no se muestra como vacía ni como 'de 0'", async () => {
    obtener.mockResolvedValue(respuesta({ clientes_del_dia: null, errores: ["clientes_del_dia"] }));
    montar();
    expect(await screen.findByText("No se pudo cargar la lista de clientes de hoy.")).toBeTruthy();
    expect(screen.queryByText(/Te quedan/)).toBeNull();
    expect(screen.queryByText("Hoy no hay clientes de seguimiento.")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(obtener).toHaveBeenCalledTimes(2));
  });

  it("fin de semana: estado claro y el resto de la pantalla sigue", async () => {
    obtener.mockResolvedValue(
      respuesta({
        fecha: "2026-10-03",
        clientes_del_dia: clientesDelDia([], { es_dia_habil: false, fecha: "2026-10-03", dia: "SABADO" }),
        promesas: [promesa({ fecha_prometida: "2026-10-03" })],
        pedidos_bandeja: { pendientes: 2 },
      })
    );
    montar();
    expect(await screen.findByText("Hoy no hay clientes de seguimiento.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Sábado 3 de octubre" })).toBeTruthy();
    expect(screen.queryByText(/Te quedan/)).toBeNull();
    expect(screen.getByText(/Chocolates del Este/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "2 pedidos pendientes en la Bandeja" })).toBeTruthy();
  });

  it("si no se pudo saber qué se gestionó hoy, lo avisa y no finge un progreso", async () => {
    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia([cliente({ gestionada_hoy: null }), cliente({ card_code: "C1-2", gestionada_hoy: null })], {
          gestion_conocida: false,
        }),
        errores: ["gestionados"],
      })
    );
    montar();
    expect(await screen.findByText("2 clientes hoy")).toBeTruthy();
    expect(screen.getByText(/No se pudo saber cuáles ya gestionaste hoy/)).toBeTruthy();
    expect(screen.queryByText(/Te quedan/)).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("MiDiaPage: Para hoy", () => {
  it("sin nada no existe la sección", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    expect(screen.queryByRole("heading", { name: "Para hoy" })).toBeNull();
  });

  it("promesas que vencen y recordatorios vencidos van arriba, con importe en su moneda", async () => {
    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia(LISTA_BASE),
        promesas: [promesa(), promesa({ id: 6, moneda: "USD", importe: 2100, cliente_nombre: "Betabel Ejemplo" })],
        tareas: [tarea()],
      })
    );
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const seccion = screen.getByRole("region", { name: "Para hoy" });
    expect(within(seccion).getByText(/Chocolates del Este/)).toBeTruthy();
    expect(within(seccion).getByText(/\$ 45\.000/)).toBeTruthy();
    expect(within(seccion).getByText(/US\$ 2\.100/)).toBeTruthy();
    expect(within(seccion).getAllByText(/vence hoy/)).toHaveLength(2);
    expect(within(seccion).getByText(/Recordatorio vencido/)).toBeTruthy();
    expect(within(seccion).getByText(/Llamar por la factura/)).toBeTruthy();
    expect(within(seccion).getByText(/hace 2 d/)).toBeTruthy();
    // Esta antes que los grupos de clientes.
    const todo = document.body.innerHTML;
    expect(todo.indexOf("Para hoy")).toBeLessThan(todo.indexOf("Dulces del Sur"));
  });

  it("los recordatorios de otras personas van en un detalle aparte", async () => {
    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia(LISTA_BASE),
        tareas: [tarea({ id: 9, es_mia: false, descripcion: "Mandar estado de cuenta", responsable: "otra@pontyn.com.uy" })],
      })
    );
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const detalle = screen.getByText("1 recordatorio de otras personas");
    expect(detalle.closest("details")).not.toBeNull();
    expect(screen.getByText(/Mandar estado de cuenta/)).toBeTruthy();
  });

  it("si recordatorios o promesas son null lo dice en vez de omitirlos", async () => {
    obtener.mockResolvedValue(
      respuesta({ clientes_del_dia: clientesDelDia(LISTA_BASE), tareas: null, promesas: null, errores: ["tareas", "promesas"] })
    );
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const seccion = screen.getByRole("region", { name: "Para hoy" });
    expect(within(seccion).getByText("No se pudieron cargar los recordatorios.")).toBeTruthy();
    expect(within(seccion).getByText("No se pudieron cargar las promesas.")).toBeTruthy();
  });

  it("promesas null con la función de promesas apagada no es un error a mostrar", async () => {
    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia(LISTA_BASE),
        promesas: [],
        habilitadas: { promesas: false, alertas: true },
      })
    );
    montar();
    await screen.findByText("Te quedan 5 de 6");
    expect(screen.queryByText("No se pudieron cargar las promesas.")).toBeNull();
  });
});

describe("MiDiaPage: pie", () => {
  it("pedidos de la Bandeja como enlace chico y alertas como línea", async () => {
    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia(LISTA_BASE),
        pedidos_bandeja: { pendientes: 1 },
        alertas: { abiertas: 3, no_vistas: 1 },
      })
    );
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const enlace = screen.getByRole("link", { name: "1 pedido pendiente en la Bandeja" });
    expect(enlace.getAttribute("href")).toBe("/bandeja");
    expect(screen.getByText("3 alertas abiertas, 1 sin ver")).toBeTruthy();
  });

  it("sin pedidos ni alertas no muestra nada", async () => {
    montar();
    await screen.findByText("Te quedan 5 de 6");
    expect(screen.queryByRole("link", { name: /Bandeja/ })).toBeNull();
    expect(screen.queryByText(/alertas? abiertas?/)).toBeNull();
  });

  it("si fallaron esos conteos lo dice, y con alertas apagadas no avisa nada de alertas", async () => {
    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia(LISTA_BASE),
        pedidos_bandeja: null,
        alertas: null,
        errores: ["pedidos_bandeja", "alertas"],
      })
    );
    const { unmount } = montar();
    await screen.findByText("Te quedan 5 de 6");
    expect(screen.getByText("No se pudo cargar el conteo de pedidos de la Bandeja.")).toBeTruthy();
    expect(screen.getByText("No se pudo cargar el conteo de alertas.")).toBeTruthy();
    unmount();

    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia(LISTA_BASE),
        alertas: null,
        habilitadas: { promesas: true, alertas: false },
      })
    );
    montar();
    await screen.findByText("Te quedan 5 de 6");
    expect(screen.queryByText("No se pudo cargar el conteo de alertas.")).toBeNull();
  });

  it("las zonas que no se pudieron interpretar quedan a la vista en un detalle", async () => {
    obtener.mockResolvedValue(
      respuesta({
        clientes_del_dia: clientesDelDia(LISTA_BASE, {
          zonas_no_reconocidas: [
            { card_code: "C1-05555", zona: "MIERCOLES." },
            { card_code: "C1-05556", zona: "folio jueves" },
          ],
        }),
      })
    );
    montar();
    await screen.findByText("Te quedan 5 de 6");
    const resumen = screen.getByText("2 cuentas con un día de seguimiento que no se pudo interpretar");
    const detalle = resumen.closest("details") as HTMLElement;
    expect(within(detalle).getByText(/C1-05555/)).toBeTruthy();
    expect(within(detalle).getByText(/folio jueves/)).toBeTruthy();
  });
});
