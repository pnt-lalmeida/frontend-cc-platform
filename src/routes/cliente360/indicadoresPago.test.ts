import { describe, expect, it } from "vitest";
import type { IndicadoresPago } from "../../api/types";
import {
  describirAtraso,
  formatearDias,
  lineaBandeja,
  tagTendencia,
  textoAtrasoAnterior,
  textoFacturasConsideradas,
  textoHistorialInsuficiente,
} from "./indicadoresPago";

const base: IndicadoresPago = {
  ventana_meses: 6,
  historial_suficiente: true,
  minimo_facturas: 5,
  facturas_consideradas: 42,
  dias_para_cobrar: 34.2,
  dias_atraso: 9.1,
  tendencia: "empeora",
  anterior: { dias_para_cobrar: 30, dias_atraso: 5.5, facturas_consideradas: 38 },
};

const sinHistorial: IndicadoresPago = {
  ...base,
  historial_suficiente: false,
  facturas_consideradas: 3,
  dias_para_cobrar: null,
  dias_atraso: null,
  tendencia: null,
  anterior: null,
};

describe("tagTendencia", () => {
  it("mejora es ok, empeora es risk, estable es neutral", () => {
    expect(tagTendencia("mejora")).toEqual({ texto: "Mejora", variant: "ok" });
    expect(tagTendencia("empeora")).toEqual({ texto: "Empeora", variant: "risk" });
    expect(tagTendencia("estable")).toEqual({ texto: "Estable", variant: "neutral" });
  });

  it("sin tendencia no hay chip", () => {
    expect(tagTendencia(null)).toBeNull();
  });
});

describe("formatearDias", () => {
  it("usa coma decimal y un decimal como maximo", () => {
    expect(formatearDias(12.5)).toBe("12,5 días");
    expect(formatearDias(34.24)).toBe("34,2 días");
  });

  it("no muestra ,0 en numeros redondos", () => {
    expect(formatearDias(40)).toBe("40 días");
  });

  it("singular para un dia", () => {
    expect(formatearDias(1)).toBe("1 día");
  });

  it("sin dato muestra guion", () => {
    expect(formatearDias(null)).toBe("—");
  });
});

describe("describirAtraso", () => {
  it("atraso positivo: dias despues del vencimiento", () => {
    expect(describirAtraso(9.1)).toEqual({ valor: "9,1 días", detalle: "después del vencimiento" });
  });

  it("atraso negativo: paga antes del vencimiento, sin signo menos", () => {
    expect(describirAtraso(-3.2)).toEqual({ valor: "3,2 días", detalle: "antes del vencimiento" });
  });

  it("cero (o algo que redondea a cero) es pagar en fecha", () => {
    expect(describirAtraso(0)).toEqual({ valor: "En fecha", detalle: "paga el día del vencimiento" });
    expect(describirAtraso(-0.04)).toEqual({ valor: "En fecha", detalle: "paga el día del vencimiento" });
  });

  it("sin dato muestra guion", () => {
    expect(describirAtraso(null)).toEqual({ valor: "—", detalle: "" });
  });
});

describe("textoFacturasConsideradas", () => {
  it("indica cuantas facturas y que ventana", () => {
    expect(textoFacturasConsideradas(42, 6)).toBe("Sobre 42 facturas cobradas en los últimos 6 meses");
    expect(textoFacturasConsideradas(1, 12)).toBe("Sobre 1 factura cobrada en los últimos 12 meses");
  });
});

describe("lineaBandeja", () => {
  it("resume dias para cobrar, atraso y tendencia", () => {
    const linea = lineaBandeja(base);
    expect(linea.texto).toBe("Paga en 34,2 días prom. · 9,1 días de atraso prom.");
    expect(linea.tendencia).toEqual({ texto: "Empeora", variant: "risk" });
    expect(linea.completo).toBe("Paga en 34,2 días prom. · 9,1 días de atraso prom. · Empeora");
  });

  it("si paga antes del vencimiento lo dice asi", () => {
    const linea = lineaBandeja({ ...base, dias_atraso: -2, tendencia: null });
    expect(linea.texto).toBe("Paga en 34,2 días prom. · 2 días antes del vencimiento prom.");
    expect(linea.tendencia).toBeNull();
    expect(linea.completo).toBe(linea.texto);
  });

  it("si paga en fecha lo dice asi", () => {
    expect(lineaBandeja({ ...base, dias_atraso: 0, tendencia: "estable" }).texto).toBe(
      "Paga en 34,2 días prom. · en fecha"
    );
  });

  it("sin historial suficiente no inventa promedios", () => {
    const linea = lineaBandeja(sinHistorial);
    expect(linea.texto).toBe("Sin historial de pagos suficiente");
    expect(linea.tendencia).toBeNull();
  });
});

describe("textoAtrasoAnterior", () => {
  it("describe el atraso del periodo anterior sin signo menos", () => {
    expect(textoAtrasoAnterior(12.3)).toBe("Período anterior: 12,3 días de atraso");
    expect(textoAtrasoAnterior(-3)).toBe("Período anterior: 3 días antes del vencimiento");
    expect(textoAtrasoAnterior(0)).toBe("Período anterior: en fecha");
  });
});

describe("textoHistorialInsuficiente", () => {
  it("explica cuantas facturas hay y cuantas hacen falta", () => {
    expect(textoHistorialInsuficiente(3, 5, 6)).toBe(
      "Hay 3 facturas cobradas en los últimos 6 meses; se necesitan al menos 5."
    );
    expect(textoHistorialInsuficiente(1, 5, 12)).toBe(
      "Hay 1 factura cobrada en los últimos 12 meses; se necesitan al menos 5."
    );
    expect(textoHistorialInsuficiente(0, 5, 6)).toBe("No hay facturas cobradas en los últimos 6 meses.");
  });
});
