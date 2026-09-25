import { describe, expect, it } from "vitest";
import { ApiError } from "../../api/client";
import type { EventoBitacora, MiembroEquipo, TareaBitacora } from "../../api/types";
import {
  agruparEventosPorDia,
  armarGestionRequest,
  armarRecordatorioRequest,
  clasificarTareas,
  describirVencimiento,
  esAutomatico,
  etiquetaEvento,
  fechaLocalISO,
  mensajeDeErrorApi,
  nombreDeUsuario,
  responsablePorDefecto,
  sumarDias,
  validarGestion,
  validarRecordatorio,
} from "./bitacora";

const HOY = "2026-09-25";

function tarea(parcial: Partial<TareaBitacora> = {}): TareaBitacora {
  return {
    id: 1,
    descripcion: "Llamar para confirmar pago",
    fecha_objetivo: HOY,
    estado: "pendiente",
    responsable: "rlopez@pontyn.com.uy",
    creada_por: "rlopez@pontyn.com.uy",
    creada_utc: "2026-09-20T13:00:00+00:00",
    completada_utc: null,
    ...parcial,
  };
}

function evento(parcial: Partial<EventoBitacora> = {}): EventoBitacora {
  return {
    id: 40,
    tipo: "manual",
    canal: "Llamada",
    resultado: "Pago coordinado",
    nota: "Paga el viernes",
    origen: "rlopez@pontyn.com.uy",
    fecha_utc: "2026-09-25T15:00:00+00:00",
    referencia: null,
    card_code: "C1-17453",
    ...parcial,
  };
}

const EQUIPO: MiembroEquipo[] = [
  { upn: "rlopez@pontyn.com.uy", nombre: "Rosina López" },
  { upn: "cflores@pontyn.com.uy", nombre: "Claudia Flores" },
];
const MOTIVOS = ["Consultamos por pago", "Pago coordinado", "Llamar"];
const CANALES = ["Llamada", "Email", "WhatsApp", "Visita", "Carta", "Otro"];

describe("fechas", () => {
  it("fechaLocalISO usa la fecha local, no la UTC", () => {
    expect(fechaLocalISO(new Date(2026, 8, 25, 23, 30))).toBe("2026-09-25");
    expect(fechaLocalISO(new Date(2026, 0, 5, 0, 5))).toBe("2026-01-05");
  });

  it("sumarDias cruza fin de mes y de año", () => {
    expect(sumarDias("2026-09-25", 1)).toBe("2026-09-26");
    expect(sumarDias("2026-09-30", 1)).toBe("2026-10-01");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("clasificarTareas", () => {
  it("separa vencidas, pendientes y completadas respetando el orden recibido", () => {
    const vieja = tarea({ id: 1, fecha_objetivo: "2026-09-20" });
    const ayer = tarea({ id: 2, fecha_objetivo: "2026-09-24" });
    const hoy = tarea({ id: 3, fecha_objetivo: HOY });
    const futura = tarea({ id: 4, fecha_objetivo: "2026-10-01" });
    const hecha = tarea({ id: 5, estado: "completada", fecha_objetivo: "2026-09-01", completada_utc: "2026-09-02T12:00:00+00:00" });

    const r = clasificarTareas([vieja, ayer, hoy, futura, hecha], HOY);

    expect(r.vencidas.map((t) => t.id)).toEqual([1, 2]);
    expect(r.pendientes.map((t) => t.id)).toEqual([3, 4]);
    expect(r.completadas.map((t) => t.id)).toEqual([5]);
  });

  it("una completada con fecha pasada nunca cuenta como vencida", () => {
    const r = clasificarTareas([tarea({ estado: "completada", fecha_objetivo: "2026-01-01" })], HOY);
    expect(r.vencidas).toEqual([]);
  });
});

describe("describirVencimiento", () => {
  it("vencida hace varios días", () => {
    expect(describirVencimiento("2026-09-20", HOY)).toEqual({ texto: "Venció hace 5 días", variante: "vencida" });
  });
  it("vencida ayer", () => {
    expect(describirVencimiento("2026-09-24", HOY)).toEqual({ texto: "Venció ayer", variante: "vencida" });
  });
  it("hoy", () => {
    expect(describirVencimiento(HOY, HOY)).toEqual({ texto: "Hoy", variante: "hoy" });
  });
  it("mañana", () => {
    expect(describirVencimiento("2026-09-26", HOY)).toEqual({ texto: "Mañana", variante: "futura" });
  });
  it("más adelante muestra la fecha DD/MM/AAAA", () => {
    expect(describirVencimiento("2026-10-03", HOY)).toEqual({ texto: "03/10/2026", variante: "futura" });
  });
  it("cruza cambio de mes contando días reales", () => {
    expect(describirVencimiento("2026-08-31", "2026-09-02").texto).toBe("Venció hace 2 días");
  });
});

describe("nombreDeUsuario", () => {
  it("usa el nombre del equipo sin importar mayúsculas del UPN", () => {
    expect(nombreDeUsuario("RLopez@pontyn.com.uy", EQUIPO)).toBe("Rosina López");
  });
  it("si no está en el equipo, muestra la parte antes de la arroba", () => {
    expect(nombreDeUsuario("mgarcia@pontyn.com.uy", EQUIPO)).toBe("mgarcia");
  });
  it("sin usuario devuelve guion", () => {
    expect(nombreDeUsuario("", EQUIPO)).toBe("—");
  });
});

describe("responsablePorDefecto", () => {
  it("elige al usuario actual si está en el equipo, con el UPN tal cual viene del equipo", () => {
    expect(responsablePorDefecto("CFlores@Pontyn.com.uy", EQUIPO)).toBe("cflores@pontyn.com.uy");
  });
  it("si el usuario actual no está en el equipo, queda vacío (el backend usa el del token)", () => {
    expect(responsablePorDefecto("otro@pontyn.com.uy", EQUIPO)).toBe("");
    expect(responsablePorDefecto(null, EQUIPO)).toBe("");
  });
});

describe("eventos", () => {
  it("esAutomatico según el tipo", () => {
    expect(esAutomatico(evento())).toBe(false);
    expect(esAutomatico(evento({ tipo: "automatico" }))).toBe(true);
  });

  it("etiqueta de una gestión manual: el canal, o 'Gestión' si no tiene", () => {
    expect(etiquetaEvento(evento({ canal: "WhatsApp" }))).toBe("WhatsApp");
    expect(etiquetaEvento(evento({ canal: null }))).toBe("Gestión");
  });

  it("etiqueta de los automáticos según su referencia", () => {
    expect(etiquetaEvento(evento({ tipo: "automatico", canal: null, referencia: "decision:1400895" }))).toBe(
      "Bandeja de autorización"
    );
    expect(etiquetaEvento(evento({ tipo: "automatico", canal: null, referencia: "tarea:12" }))).toBe("Recordatorio");
    expect(etiquetaEvento(evento({ tipo: "automatico", canal: null, referencia: null }))).toBe("Sistema");
  });

  it("agrupa por día local con títulos Hoy / Ayer / fecha, conservando el orden", () => {
    const e1 = evento({ id: 1, fecha_utc: "2026-09-25T16:00:00+00:00" });
    const e2 = evento({ id: 2, fecha_utc: "2026-09-25T14:00:00+00:00" });
    const e3 = evento({ id: 3, fecha_utc: "2026-09-24T15:00:00+00:00" });
    const e4 = evento({ id: null, tipo: "automatico", fecha_utc: "2026-09-10T15:00:00+00:00" });

    const grupos = agruparEventosPorDia([e1, e2, e3, e4], HOY);

    expect(grupos.map((g) => g.titulo)).toEqual(["Hoy", "Ayer", "10/09/2026"]);
    expect(grupos[0].eventos.map((e) => e.id)).toEqual([1, 2]);
    expect(grupos[2].eventos).toEqual([e4]);
  });

  it("sin eventos no hay grupos", () => {
    expect(agruparEventosPorDia([], HOY)).toEqual([]);
  });
});

describe("validarGestion", () => {
  it("el motivo es obligatorio", () => {
    expect(validarGestion({ resultado: "", canal: "", nota: "" }, MOTIVOS, CANALES)).toEqual({
      resultado: "Elegí un motivo.",
    });
  });

  it("el motivo tiene que ser uno de la lista", () => {
    expect(validarGestion({ resultado: "Inventado", canal: "", nota: "" }, MOTIVOS, CANALES).resultado).toBe(
      "Elegí un motivo de la lista."
    );
  });

  it("el canal es opcional, pero si viene tiene que ser de la lista", () => {
    expect(validarGestion({ resultado: "Llamar", canal: "", nota: "" }, MOTIVOS, CANALES)).toEqual({});
    expect(validarGestion({ resultado: "Llamar", canal: "Fax", nota: "" }, MOTIVOS, CANALES).canal).toBe(
      "Elegí un canal de la lista."
    );
  });

  it("la nota admite hasta 1000 caracteres", () => {
    expect(validarGestion({ resultado: "Llamar", canal: "", nota: "a".repeat(1000) }, MOTIVOS, CANALES)).toEqual({});
    expect(validarGestion({ resultado: "Llamar", canal: "", nota: "a".repeat(1001) }, MOTIVOS, CANALES).nota).toBe(
      "La nota puede tener hasta 1000 caracteres (tiene 1001)."
    );
  });
});

describe("validarRecordatorio", () => {
  const valido = { descripcion: "Llamar", fecha_objetivo: "2026-09-26", responsable: "" };

  it("un recordatorio completo no tiene errores", () => {
    expect(validarRecordatorio(valido, HOY)).toEqual({});
  });

  it("la descripción es obligatoria (espacios no cuentan)", () => {
    expect(validarRecordatorio({ ...valido, descripcion: "   " }, HOY).descripcion).toBe("Escribí qué hay que hacer.");
  });

  it("la descripción admite hasta 500 caracteres", () => {
    expect(validarRecordatorio({ ...valido, descripcion: "a".repeat(501) }, HOY).descripcion).toBe(
      "La descripción puede tener hasta 500 caracteres (tiene 501)."
    );
  });

  it("la fecha es obligatoria y válida", () => {
    expect(validarRecordatorio({ ...valido, fecha_objetivo: "" }, HOY).fecha_objetivo).toBe("Elegí una fecha.");
    expect(validarRecordatorio({ ...valido, fecha_objetivo: "2026-02-30" }, HOY).fecha_objetivo).toBe(
      "La fecha no es válida."
    );
    expect(validarRecordatorio({ ...valido, fecha_objetivo: "25/09/2026" }, HOY).fecha_objetivo).toBe(
      "La fecha no es válida."
    );
  });

  it("la fecha puede ser hoy pero no anterior", () => {
    expect(validarRecordatorio({ ...valido, fecha_objetivo: HOY }, HOY)).toEqual({});
    expect(validarRecordatorio({ ...valido, fecha_objetivo: "2026-09-24" }, HOY).fecha_objetivo).toBe(
      "La fecha no puede ser anterior a hoy."
    );
  });
});

describe("armado de requests", () => {
  it("gestión: recorta espacios y omite canal y nota vacíos", () => {
    expect(armarGestionRequest({ resultado: "Llamar", canal: "", nota: "   " })).toEqual({ resultado: "Llamar" });
    expect(armarGestionRequest({ resultado: "Llamar", canal: "Email", nota: " Paga el viernes " })).toEqual({
      resultado: "Llamar",
      canal: "Email",
      nota: "Paga el viernes",
    });
  });

  it("recordatorio: omite el responsable vacío", () => {
    expect(armarRecordatorioRequest({ descripcion: " Llamar ", fecha_objetivo: "2026-09-26", responsable: "" })).toEqual({
      descripcion: "Llamar",
      fecha_objetivo: "2026-09-26",
    });
    expect(
      armarRecordatorioRequest({ descripcion: "Llamar", fecha_objetivo: "2026-09-26", responsable: "rlopez@pontyn.com.uy" })
    ).toEqual({ descripcion: "Llamar", fecha_objetivo: "2026-09-26", responsable: "rlopez@pontyn.com.uy" });
  });
});

describe("mensajeDeErrorApi", () => {
  it("usa el mensaje del backend si viene", () => {
    expect(mensajeDeErrorApi(new ApiError(400, { error: "El motivo no es válido." }), "fallback")).toBe(
      "El motivo no es válido."
    );
  });
  it("si no, usa el mensaje por defecto", () => {
    expect(mensajeDeErrorApi(new Error("red"), "No se pudo registrar la gestión.")).toBe(
      "No se pudo registrar la gestión."
    );
    expect(mensajeDeErrorApi(new ApiError(500, undefined), "x")).toBe("x");
  });
});
