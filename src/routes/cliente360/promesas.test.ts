import { describe, expect, it } from "vitest";
import type { PromesaPago } from "../../api/types";
import {
  MAX_FACTURAS,
  armarPromesaRequest,
  diasHastaVencimiento,
  etiquetaEstadoPromesa,
  fraseVencimiento,
  lineaPromesaBandeja,
  parsearImporte,
  textoRegistrada,
  validarPromesa,
  varianteEstadoPromesa,
  vigentesOrdenadas,
  type FormPromesa,
} from "./promesas";

function promesa(parcial: Partial<PromesaPago> = {}): PromesaPago {
  return {
    id: 1,
    numero_sn: "17454",
    card_code: "C1-17453",
    fecha_prometida: "2026-10-02",
    importe: 45000,
    moneda: "UYU",
    canal: null,
    facturas: null,
    registrada_por: "rlopez@pontyn.com.uy",
    registrada_utc: "2026-09-29T14:00:00Z",
    estado: "vigente",
    estado_utc: null,
    importe_verificado: null,
    ...parcial,
  };
}

describe("diasHastaVencimiento", () => {
  it("es 0 el mismo día, positivo hacia adelante y negativo hacia atrás", () => {
    expect(diasHastaVencimiento("2026-09-29", "2026-09-29")).toBe(0);
    expect(diasHastaVencimiento("2026-10-02", "2026-09-29")).toBe(3);
    expect(diasHastaVencimiento("2026-09-26", "2026-09-29")).toBe(-3);
  });

  it("cruza cambio de mes, de año y año bisiesto sin errores", () => {
    expect(diasHastaVencimiento("2026-10-01", "2026-09-30")).toBe(1);
    expect(diasHastaVencimiento("2026-09-30", "2026-10-01")).toBe(-1);
    expect(diasHastaVencimiento("2027-01-01", "2026-12-31")).toBe(1);
    expect(diasHastaVencimiento("2028-03-01", "2028-02-28")).toBe(2);
    expect(diasHastaVencimiento("2027-03-01", "2027-02-28")).toBe(1);
  });

  it("es exacta en tramos largos (usa solo días de calendario, sin horas)", () => {
    expect(diasHastaVencimiento("2026-11-01", "2026-03-01")).toBe(245);
  });
});

describe("fraseVencimiento", () => {
  const hoy = "2026-09-29";

  it("hoy y mañana", () => {
    expect(fraseVencimiento("2026-09-29", hoy)).toBe("vence hoy");
    expect(fraseVencimiento("2026-09-30", hoy)).toBe("vence mañana");
  });

  it("en N días", () => {
    expect(fraseVencimiento("2026-10-02", hoy)).toBe("vence en 3 días");
    expect(fraseVencimiento("2026-10-29", hoy)).toBe("vence en 30 días");
  });

  it("ayer y hace N días, siempre 'verificando'", () => {
    expect(fraseVencimiento("2026-09-28", hoy)).toBe("venció ayer, verificando");
    expect(fraseVencimiento("2026-09-26", hoy)).toBe("venció hace 3 días, verificando");
  });

  it("cambio de mes: el 30/09 visto desde el 01/10 es ayer; el 01/10 visto desde el 30/09 es mañana", () => {
    expect(fraseVencimiento("2026-09-30", "2026-10-01")).toBe("venció ayer, verificando");
    expect(fraseVencimiento("2026-10-01", "2026-09-30")).toBe("vence mañana");
  });

  it("cambio de año", () => {
    expect(fraseVencimiento("2026-12-31", "2027-01-01")).toBe("venció ayer, verificando");
    expect(fraseVencimiento("2027-01-02", "2026-12-31")).toBe("vence en 2 días");
  });

  it("una fecha inválida no rompe: devuelve null", () => {
    expect(fraseVencimiento("basura", hoy)).toBeNull();
    expect(fraseVencimiento("2026-13-40", hoy)).toBeNull();
  });
});

describe("vigentesOrdenadas", () => {
  it("deja solo vigente y vencida_a_verificar, por fecha prometida ascendente", () => {
    const lista = [
      promesa({ id: 1, fecha_prometida: "2026-10-05" }),
      promesa({ id: 2, fecha_prometida: "2026-09-30", estado: "cumplida" }),
      promesa({ id: 3, fecha_prometida: "2026-09-28", estado: "vencida_a_verificar" }),
      promesa({ id: 4, fecha_prometida: "2026-10-01" }),
      promesa({ id: 5, fecha_prometida: "2026-10-01", estado: "incumplida" }),
      promesa({ id: 6, fecha_prometida: "2026-10-01", estado: "renegociada" }),
      promesa({ id: 7, fecha_prometida: "2026-10-01", estado: "cumplida_parcial" }),
    ];
    expect(vigentesOrdenadas(lista).map((p) => p.id)).toEqual([3, 4, 1]);
  });

  it("con la misma fecha, la registrada primero va primero; no muta la entrada", () => {
    const lista = [
      promesa({ id: 10, registrada_utc: "2026-09-29T15:00:00Z" }),
      promesa({ id: 11, registrada_utc: "2026-09-29T12:00:00Z" }),
    ];
    expect(vigentesOrdenadas(lista).map((p) => p.id)).toEqual([11, 10]);
    expect(lista.map((p) => p.id)).toEqual([10, 11]);
  });

  it("sin promesas, lista vacía", () => {
    expect(vigentesOrdenadas([])).toEqual([]);
  });
});

describe("estado -> color y etiqueta", () => {
  it("cumplida ok, parcial caution, incumplida risk, el resto neutral", () => {
    expect(varianteEstadoPromesa("cumplida")).toBe("ok");
    expect(varianteEstadoPromesa("cumplida_parcial")).toBe("caution");
    expect(varianteEstadoPromesa("incumplida")).toBe("risk");
    expect(varianteEstadoPromesa("vigente")).toBe("neutral");
    expect(varianteEstadoPromesa("vencida_a_verificar")).toBe("neutral");
    expect(varianteEstadoPromesa("renegociada")).toBe("neutral");
  });

  it("etiquetas legibles", () => {
    expect(etiquetaEstadoPromesa("vigente")).toBe("Vigente");
    expect(etiquetaEstadoPromesa("vencida_a_verificar")).toBe("Verificando");
    expect(etiquetaEstadoPromesa("cumplida_parcial")).toBe("Cumplida en parte");
    expect(etiquetaEstadoPromesa("incumplida")).toBe("Incumplida");
    expect(etiquetaEstadoPromesa("renegociada")).toBe("Renegociada");
    expect(etiquetaEstadoPromesa("cumplida")).toBe("Cumplida");
  });
});

describe("textoRegistrada", () => {
  const equipo = [{ upn: "rlopez@pontyn.com.uy", nombre: "Rosina López" }];

  it("usa el nombre del equipo y la fecha del día en Uruguay", () => {
    expect(textoRegistrada(promesa(), equipo)).toBe("Registrada por Rosina López el 29/09/2026");
  });

  it("sin nombre en el equipo, la parte del UPN antes de la @", () => {
    expect(textoRegistrada(promesa({ registrada_por: "csoto@pontyn.com.uy" }), equipo)).toBe(
      "Registrada por csoto el 29/09/2026"
    );
  });

  it("a las 23:30 en Uruguay (02:30Z del día siguiente) sigue siendo el día uruguayo", () => {
    expect(textoRegistrada(promesa({ registrada_utc: "2026-09-30T02:30:00Z" }), equipo)).toContain("el 29/09/2026");
  });

  it("sin fecha válida, omite la fecha", () => {
    expect(textoRegistrada(promesa({ registrada_utc: "" }), equipo)).toBe("Registrada por Rosina López");
  });
});

describe("lineaPromesaBandeja", () => {
  const hoy = "2026-09-29";

  it("una promesa vigente, con importe, fecha corta y cuándo vence", () => {
    expect(lineaPromesaBandeja([promesa()], hoy)).toBe("Prometió $ 45.000,00 para el 02/10 · vence en 3 días");
  });

  it("muestra la más próxima y cuenta las otras", () => {
    const lista = [
      promesa({ id: 1, fecha_prometida: "2026-10-10", importe: 100 }),
      promesa({ id: 2, fecha_prometida: "2026-10-02" }),
    ];
    expect(lineaPromesaBandeja(lista, hoy)).toBe("Prometió $ 45.000,00 para el 02/10 · vence en 3 días · 1 promesa más");
    expect(lineaPromesaBandeja([...lista, promesa({ id: 3, fecha_prometida: "2026-10-20" })], hoy)).toContain(
      "2 promesas más"
    );
  });

  it("USD con su símbolo y una fecha de otro año muestra el año", () => {
    expect(
      lineaPromesaBandeja([promesa({ moneda: "USD", importe: 1200.5, fecha_prometida: "2027-01-05" })], "2026-12-30")
    ).toBe("Prometió US$ 1.200,50 para el 05/01/2027 · vence en 6 días");
  });

  it("vencida a verificar sigue siendo contexto", () => {
    expect(
      lineaPromesaBandeja([promesa({ fecha_prometida: "2026-09-28", estado: "vencida_a_verificar" })], hoy)
    ).toBe("Prometió $ 45.000,00 para el 28/09 · venció ayer, verificando");
  });

  it("sin promesas vigentes, null (no se muestra nada)", () => {
    expect(lineaPromesaBandeja([], hoy)).toBeNull();
    expect(lineaPromesaBandeja([promesa({ estado: "cumplida" }), promesa({ estado: "incumplida" })], hoy)).toBeNull();
  });
});

describe("parsearImporte", () => {
  it("número simple, con decimales y con separadores uruguayos", () => {
    expect(parsearImporte("45000")).toBe(45000);
    expect(parsearImporte("45000,50")).toBe(45000.5);
    expect(parsearImporte("45.000")).toBe(45000);
    expect(parsearImporte("45.000,50")).toBe(45000.5);
    expect(parsearImporte("1.234.567,89")).toBe(1234567.89);
  });

  it("acepta el punto decimal cuando es claramente decimal", () => {
    expect(parsearImporte("450.5")).toBe(450.5);
    expect(parsearImporte("1200.50")).toBe(1200.5);
  });

  it("ignora espacios y el símbolo $", () => {
    expect(parsearImporte(" $ 45.000 ")).toBe(45000);
  });

  it("redondea a 2 decimales", () => {
    expect(parsearImporte("10,006")).toBe(10.01);
  });

  it("devuelve null si no es un número", () => {
    expect(parsearImporte("")).toBeNull();
    expect(parsearImporte("abc")).toBeNull();
    expect(parsearImporte("12a")).toBeNull();
    expect(parsearImporte("1,2,3")).toBeNull();
    expect(parsearImporte("-5")).toBeNull();
    expect(parsearImporte("1..000")).toBeNull();
  });
});

describe("validarPromesa", () => {
  const hoy = "2026-09-29";
  const monedas = ["UYU", "USD", "EUR"];
  const canales = ["Llamada", "WhatsApp"];
  const ok: FormPromesa = { fecha_prometida: "2026-10-02", importe: "45000", moneda: "UYU", canal: "", facturas: "" };
  const validar = (f: Partial<FormPromesa>) => validarPromesa({ ...ok, ...f }, hoy, monedas, canales);

  it("un formulario correcto no tiene errores", () => {
    expect(validar({})).toEqual({});
    expect(validar({ fecha_prometida: hoy })).toEqual({});
    expect(validar({ canal: "Llamada", facturas: "A-123, A-124" })).toEqual({});
  });

  it("fecha: requerida, válida y no anterior a hoy", () => {
    expect(validar({ fecha_prometida: "" }).fecha_prometida).toBe("Elegí la fecha en que va a pagar.");
    expect(validar({ fecha_prometida: "2026-02-30" }).fecha_prometida).toBe("La fecha no es válida.");
    expect(validar({ fecha_prometida: "2026-09-28" }).fecha_prometida).toBe("La fecha no puede ser anterior a hoy.");
  });

  it("importe: requerido, numérico y mayor que cero", () => {
    expect(validar({ importe: "" }).importe).toBe("Escribí el importe prometido.");
    expect(validar({ importe: "abc" }).importe).toBe("El importe tiene que ser un número.");
    expect(validar({ importe: "0" }).importe).toBe("El importe tiene que ser mayor que cero.");
  });

  it("moneda: requerida y de la lista", () => {
    expect(validar({ moneda: "" }).moneda).toBe("Elegí la moneda.");
    expect(validar({ moneda: "BRL" }).moneda).toBe("Elegí una moneda de la lista.");
  });

  it("canal opcional pero de la lista", () => {
    expect(validar({ canal: "Paloma" }).canal).toBe("Elegí un canal de la lista.");
  });

  it("facturas: hasta 500 caracteres (sin contar espacios de los bordes)", () => {
    expect(validar({ facturas: "a".repeat(MAX_FACTURAS) })).toEqual({});
    expect(validar({ facturas: `  ${"a".repeat(MAX_FACTURAS)}  ` })).toEqual({});
    expect(validar({ facturas: "a".repeat(MAX_FACTURAS + 1) }).facturas).toBe(
      `Las facturas pueden tener hasta ${MAX_FACTURAS} caracteres (tiene ${MAX_FACTURAS + 1}).`
    );
  });
});

describe("armarPromesaRequest", () => {
  it("manda lo requerido y omite lo opcional vacío", () => {
    expect(
      armarPromesaRequest({ fecha_prometida: "2026-10-02", importe: "45.000,50", moneda: "UYU", canal: "", facturas: "  " })
    ).toEqual({ fecha_prometida: "2026-10-02", importe: 45000.5, moneda: "UYU" });
  });

  it("incluye canal y facturas (recortadas) si están", () => {
    expect(
      armarPromesaRequest({ fecha_prometida: "2026-10-02", importe: "100", moneda: "USD", canal: "Llamada", facturas: " A-1 " })
    ).toEqual({ fecha_prometida: "2026-10-02", importe: 100, moneda: "USD", canal: "Llamada", facturas: "A-1" });
  });
});
