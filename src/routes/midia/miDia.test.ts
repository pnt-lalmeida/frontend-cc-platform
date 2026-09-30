import { describe, expect, it } from "vitest";
import type { ClienteDelDia, PromesaMiDia, TareaMiDia } from "../../api/types";
import { armarParaHoy, armarVista, fechaEncabezado, nombreCliente, resumenGrupo, textoQuedan } from "./miDia";

function cliente(parcial: Partial<ClienteDelDia> = {}): ClienteDelDia {
  return {
    card_code: "C1-00001",
    nombre: "Ferretería Ejemplo",
    numero_sn: "00001",
    clave: "00001",
    moneda: "UYU",
    saldo: 1000,
    saldo_en_otra_moneda: false,
    tiene_vencido: false,
    canal: "manual",
    origen: "dia",
    gestionada_hoy: false,
    ...parcial,
  };
}

const SIN_RECIEN: ReadonlySet<string> = new Set();

describe("fechaEncabezado", () => {
  it("escribe el día de la semana y el mes en castellano rioplatense (setiembre)", () => {
    expect(fechaEncabezado("2026-09-30")).toBe("Miércoles 30 de setiembre");
    expect(fechaEncabezado("2026-10-01")).toBe("Jueves 1 de octubre");
    expect(fechaEncabezado("2026-10-03")).toBe("Sábado 3 de octubre");
  });
});

describe("textoQuedan", () => {
  it("dice cuánto falta, no cuántos hay", () => {
    expect(textoQuedan(47, 198)).toBe("Te quedan 47 de 198");
    expect(textoQuedan(1, 198)).toBe("Te queda 1 de 198");
  });
  it("cuando no queda ninguno lo dice", () => {
    expect(textoQuedan(0, 198)).toBe("No te queda ninguno de los 198 de hoy");
    expect(textoQuedan(0, 1)).toBe("Gestionaste el único cliente de hoy");
  });
});

describe("nombreCliente", () => {
  it("si no hay nombre muestra el código de cuenta", () => {
    expect(nombreCliente(cliente({ nombre: null }))).toBe("C1-00001");
    expect(nombreCliente(cliente({ nombre: "  " }))).toBe("C1-00001");
  });
});

describe("armarVista: grupos y orden", () => {
  it("Manual primero, Automáticos después, Mensuales al final, y se omiten los vacíos", () => {
    const v = armarVista(
      [
        cliente({ card_code: "C1-3", numero_sn: "3", canal: "mail", origen: "mensual" }),
        cliente({ card_code: "C1-2", numero_sn: "2", canal: "whatsapp" }),
        cliente({ card_code: "C1-1", numero_sn: "1", canal: "manual" }),
      ],
      { recienHechos: SIN_RECIEN, soloVencido: false }
    );
    expect(v.grupos.map((g) => g.clave)).toEqual(["manual", "automaticos", "mensuales"]);
    expect(v.grupos.map((g) => g.titulo)).toEqual(["Manual", "Automáticos", "Mensuales"]);
  });

  it("un mensual manual va a Mensuales, no a Manual (el origen manda sobre el canal)", () => {
    const v = armarVista([cliente({ origen: "mensual", canal: "manual" })], { recienHechos: SIN_RECIEN, soloVencido: false });
    expect(v.grupos.map((g) => g.clave)).toEqual(["mensuales"]);
  });

  it("Daniel y pagador central no se mezclan con los del equipo: grupo aparte entre Automáticos y Mensuales", () => {
    const v = armarVista(
      [
        cliente({ card_code: "C1-4", canal: "daniel" }),
        cliente({ card_code: "C1-5", canal: "pagador_central" }),
        cliente({ card_code: "C1-6", origen: "mensual" }),
        cliente({ card_code: "C1-7", canal: "mail" }),
      ],
      { recienHechos: SIN_RECIEN, soloVencido: false }
    );
    expect(v.grupos.map((g) => g.clave)).toEqual(["automaticos", "otros", "mensuales"]);
    expect(v.grupos[1].filas).toHaveLength(2);
  });

  it("dentro de cada grupo ordena por número de cliente, numéricamente, y los sin número al final por código", () => {
    const v = armarVista(
      [
        cliente({ card_code: "C1-x", numero_sn: null }),
        cliente({ card_code: "C1-a", numero_sn: "10" }),
        cliente({ card_code: "C1-b", numero_sn: "02" }),
        cliente({ card_code: "C1-c", numero_sn: "9" }),
      ],
      { recienHechos: SIN_RECIEN, soloVencido: false }
    );
    expect(v.grupos[0].filas.map((f) => f.cliente.card_code)).toEqual(["C1-b", "C1-c", "C1-a", "C1-x"]);
  });

  it("no muta la lista que recibe", () => {
    const entrada = [cliente({ card_code: "C1-b", numero_sn: "2" }), cliente({ card_code: "C1-a", numero_sn: "1" })];
    armarVista(entrada, { recienHechos: SIN_RECIEN, soloVencido: false });
    expect(entrada.map((c) => c.card_code)).toEqual(["C1-b", "C1-a"]);
  });
});

describe("armarVista: progreso y hechos", () => {
  const lista = [
    cliente({ card_code: "C1-1", numero_sn: "1" }),
    cliente({ card_code: "C1-2", numero_sn: "2", gestionada_hoy: true }),
    cliente({ card_code: "C1-3", numero_sn: "3", gestionada_hoy: null }),
    cliente({ card_code: "C1-4", numero_sn: "4", gestionada_hoy: true, canal: "mail" }),
  ];

  it("cuenta quedan y total; un cliente con gestión desconocida cuenta como pendiente", () => {
    const v = armarVista(lista, { recienHechos: SIN_RECIEN, soloVencido: false });
    expect(v.total).toBe(4);
    expect(v.hechos).toBe(2);
    expect(v.quedan).toBe(2);
  });

  it("los hechos al cargar van a 'Hechos hoy' y no a los grupos", () => {
    const v = armarVista(lista, { recienHechos: SIN_RECIEN, soloVencido: false });
    expect(v.hechosLista.map((c) => c.card_code)).toEqual(["C1-2", "C1-4"]);
    expect(v.grupos.flatMap((g) => g.filas.map((f) => f.cliente.card_code))).toEqual(["C1-1", "C1-3"]);
  });

  it("uno recién gestionado se queda en su lugar, apagado, y ya no cuenta como pendiente", () => {
    const v = armarVista(lista, { recienHechos: new Set(["C1-1"]), soloVencido: false });
    const manual = v.grupos[0];
    expect(manual.filas.map((f) => [f.cliente.card_code, f.apagada])).toEqual([
      ["C1-1", true],
      ["C1-3", false],
    ]);
    expect(manual.pendientes).toBe(1);
    expect(v.hechos).toBe(3);
    expect(v.quedan).toBe(1);
    // No se duplica en la lista de hechos.
    expect(v.hechosLista.map((c) => c.card_code)).toEqual(["C1-2", "C1-4"]);
  });

  it("un grupo con solo hechos de antes no aparece, pero se cuentan", () => {
    const v = armarVista([cliente({ canal: "mail", gestionada_hoy: true })], { recienHechos: SIN_RECIEN, soloVencido: false });
    expect(v.grupos).toEqual([]);
    expect(v.hechos).toBe(1);
  });

  it("sin clientes: total 0 y sin grupos", () => {
    const v = armarVista([], { recienHechos: SIN_RECIEN, soloVencido: false });
    expect(v).toMatchObject({ total: 0, hechos: 0, quedan: 0, grupos: [], hechosLista: [] });
  });
});

describe("armarVista: el vencido marca y el filtro es opcional", () => {
  const lista = [
    cliente({ card_code: "C1-1", numero_sn: "1", tiene_vencido: true }),
    cliente({ card_code: "C1-2", numero_sn: "2", tiene_vencido: false }),
  ];
  it("sin filtro muestra todos", () => {
    const v = armarVista(lista, { recienHechos: SIN_RECIEN, soloVencido: false });
    expect(v.grupos[0].filas).toHaveLength(2);
  });
  it("con filtro muestra solo los que tienen vencido, pero el progreso sigue siendo el de todos", () => {
    const v = armarVista(lista, { recienHechos: SIN_RECIEN, soloVencido: true });
    expect(v.grupos[0].filas.map((f) => f.cliente.card_code)).toEqual(["C1-1"]);
    expect(v.grupos[0].pendientes).toBe(2);
    expect(v.quedan).toBe(2);
  });
  it("con filtro un recién hecho con vencido sigue apagado en su lugar", () => {
    const v = armarVista(lista, { recienHechos: new Set(["C1-1"]), soloVencido: true });
    expect(v.grupos[0].filas.map((f) => f.apagada)).toEqual([true]);
  });
  it("con filtro un grupo sin ningún vencido no se muestra", () => {
    const v = armarVista([cliente({ canal: "mail" })], { recienHechos: SIN_RECIEN, soloVencido: true });
    expect(v.grupos).toEqual([]);
  });
});

describe("resumenGrupo", () => {
  it("cuenta pendientes por grupo, y en Mensuales 'sin gestionar este mes'", () => {
    expect(resumenGrupo("manual", 31)).toBe("31 pendientes");
    expect(resumenGrupo("automaticos", 1)).toBe("1 pendiente");
    expect(resumenGrupo("mensuales", 12)).toBe("12 sin gestionar este mes");
    expect(resumenGrupo("mensuales", 1)).toBe("1 sin gestionar este mes");
  });
  it("cuando no queda nada lo dice", () => {
    expect(resumenGrupo("manual", 0)).toBe("todo hecho");
    expect(resumenGrupo("mensuales", 0)).toBe("todos gestionados");
  });
});

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
    cliente_nombre: "Ferretería Ejemplo",
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
    cliente_nombre: "Dulces Ejemplo",
    ...parcial,
  };
}

describe("armarParaHoy", () => {
  const HOY = "2026-09-30";

  it("promesas con el importe en su moneda y cuándo vencen", () => {
    const r = armarParaHoy([], [promesa(), promesa({ id: 6, moneda: "USD", importe: 2100, fecha_prometida: "2026-09-28" })], HOY);
    expect(r.promesas.map((p) => [p.cliente, p.importe, p.cuando])).toEqual([
      ["Dulces Ejemplo", "$ 45.000", "vence hoy"],
      ["Dulces Ejemplo", "US$ 2.100", "venció hace 2 d"],
    ]);
  });

  it("promesa sin nombre de cliente usa el código de cuenta", () => {
    const r = armarParaHoy([], [promesa({ cliente_nombre: null })], HOY);
    expect(r.promesas[0].cliente).toBe("C1-00002");
  });

  it("recordatorios: los míos aparte de los de otras personas, vencidos antes que los de hoy", () => {
    const r = armarParaHoy(
      [
        tarea({ id: 1, fecha_objetivo: "2026-09-30" }),
        tarea({ id: 2, fecha_objetivo: "2026-09-28" }),
        tarea({ id: 3, es_mia: false, responsable: "otra@pontyn.com.uy" }),
      ],
      [],
      HOY
    );
    expect(r.recordatoriosMios.map((t) => [t.id, t.vencido, t.cuando])).toEqual([
      [2, true, "hace 2 d"],
      [1, false, "hoy"],
    ]);
    expect(r.recordatoriosDeOtros.map((t) => t.id)).toEqual([3]);
  });

  it("un recordatorio de ayer dice 'hace 1 d'", () => {
    const r = armarParaHoy([tarea({ fecha_objetivo: "2026-09-29" })], [], HOY);
    expect(r.recordatoriosMios[0].cuando).toBe("hace 1 d");
  });

  it("hayAlgo es falso sin nada y verdadero con cualquier cosa", () => {
    expect(armarParaHoy([], [], HOY).hayAlgo).toBe(false);
    expect(armarParaHoy([tarea({ es_mia: false })], [], HOY).hayAlgo).toBe(true);
    expect(armarParaHoy([], [promesa()], HOY).hayAlgo).toBe(true);
  });
});
