import { describe, expect, it } from "vitest";
import type { Alerta } from "../../api/types";
import {
  destinoDeAlerta,
  docEntryDePedido,
  etiquetaTipoAlerta,
  haceCuanto,
  quienResolvio,
  textoBadge,
} from "./alertas";

function alerta(parcial: Partial<Alerta> = {}): Alerta {
  return {
    id: 7,
    tipo: "pedido_bloqueado",
    descripcion: "Pedido 1146083 de Cliente bloqueado por deuda vencida · $ 12.345,00",
    card_code: "C1-17453",
    numero_sn: null,
    entidad_ref: "pedido:1400895",
    fecha_utc: "2026-09-25T13:00:00+00:00",
    estado: "nueva",
    vista_por: null,
    vista_utc: null,
    resuelta_por: null,
    resuelta_utc: null,
    ...parcial,
  };
}

describe("etiquetaTipoAlerta", () => {
  it("nombra los tipos de esta fase", () => {
    expect(etiquetaTipoAlerta("pedido_bloqueado")).toBe("Pedido bloqueado");
    expect(etiquetaTipoAlerta("pedido_reabierto")).toBe("Pedido reautorizado");
  });

  it("tiene una etiqueta legible para los tipos de fases futuras", () => {
    expect(etiquetaTipoAlerta("riesgo_bloqueo")).toBe("Riesgo de bloqueo");
    expect(etiquetaTipoAlerta("promesa_incumplida")).toBe("Promesa incumplida");
  });

  it("un tipo desconocido no rompe", () => {
    expect(etiquetaTipoAlerta("otro" as Alerta["tipo"])).toBe("Alerta");
  });
});

describe("haceCuanto", () => {
  const ahora = new Date("2026-09-25T15:00:00Z");

  it("menos de un minuto es 'recién'", () => {
    expect(haceCuanto("2026-09-25T14:59:30+00:00", ahora)).toBe("recién");
  });

  it("minutos", () => {
    expect(haceCuanto("2026-09-25T14:59:00+00:00", ahora)).toBe("hace 1 min");
    expect(haceCuanto("2026-09-25T14:15:00+00:00", ahora)).toBe("hace 45 min");
  });

  it("horas", () => {
    expect(haceCuanto("2026-09-25T14:00:00+00:00", ahora)).toBe("hace 1 h");
    expect(haceCuanto("2026-09-25T02:00:00+00:00", ahora)).toBe("hace 13 h");
  });

  it("días", () => {
    expect(haceCuanto("2026-09-24T15:00:00+00:00", ahora)).toBe("hace 1 día");
    expect(haceCuanto("2026-09-20T10:00:00+00:00", ahora)).toBe("hace 5 días");
  });

  it("una fecha futura (reloj desfasado) se muestra como 'recién'", () => {
    expect(haceCuanto("2026-09-25T15:02:00+00:00", ahora)).toBe("recién");
  });

  it("fecha inválida o vacía", () => {
    expect(haceCuanto("no-es-fecha", ahora)).toBe("");
    expect(haceCuanto(null, ahora)).toBe("");
  });
});

describe("docEntryDePedido", () => {
  it("saca el doc_entry de 'pedido:<n>'", () => {
    expect(docEntryDePedido("pedido:1400895")).toBe(1400895);
  });

  it("otra entidad o valor raro devuelve null", () => {
    expect(docEntryDePedido(null)).toBeNull();
    expect(docEntryDePedido("tarea:3")).toBeNull();
    expect(docEntryDePedido("pedido:")).toBeNull();
    expect(docEntryDePedido("pedido:abc")).toBeNull();
  });
});

describe("destinoDeAlerta", () => {
  it("las de pedido van a la Bandeja con el pedido", () => {
    expect(destinoDeAlerta(alerta())).toBe("/bandeja?pedido=1400895");
    expect(destinoDeAlerta(alerta({ tipo: "pedido_reabierto" }))).toBe("/bandeja?pedido=1400895");
  });

  it("un pedido sin doc_entry abre la Bandeja normal", () => {
    expect(destinoDeAlerta(alerta({ entidad_ref: null }))).toBe("/bandeja");
  });

  it("un tipo sin destino conocido devuelve null", () => {
    expect(destinoDeAlerta(alerta({ tipo: "promesa_incumplida", entidad_ref: null }))).toBeNull();
  });
});

describe("textoBadge", () => {
  it("nada si no hay nuevas", () => {
    expect(textoBadge(0)).toBeNull();
  });

  it("el número hasta 99, después 99+", () => {
    expect(textoBadge(1)).toBe("1");
    expect(textoBadge(99)).toBe("99");
    expect(textoBadge(100)).toBe("99+");
  });
});

describe("quienResolvio", () => {
  const equipo = [
    { upn: "RLopez@pontyn.com.uy", nombre: "Rosina López" },
    { upn: "cgomez@pontyn.com.uy", nombre: "Claudia Gómez" },
  ];

  it("una persona del equipo: su nombre (sin importar mayúsculas)", () => {
    expect(quienResolvio(alerta({ resuelta_por: "rlopez@PONTYN.com.uy" }), equipo)).toBe("Resuelta por Rosina López");
  });

  it("una persona fuera del equipo: la parte antes del @", () => {
    expect(quienResolvio(alerta({ resuelta_por: "jperez@pontyn.com.uy" }), equipo)).toBe("Resuelta por jperez");
    expect(quienResolvio(alerta({ resuelta_por: "jperez@pontyn.com.uy" }), [])).toBe("Resuelta por jperez");
  });

  it("el sistema, en un pedido bloqueado: el pedido ya no está bloqueado", () => {
    expect(quienResolvio(alerta({ tipo: "pedido_bloqueado", resuelta_por: "sistema" }), equipo)).toBe(
      "El pedido ya no está bloqueado"
    );
  });

  it("el sistema, en otro tipo: resuelta automáticamente", () => {
    expect(quienResolvio(alerta({ tipo: "pedido_reabierto", resuelta_por: "sistema" }), equipo)).toBe(
      "Resuelta automáticamente"
    );
  });

  it("sin dato", () => {
    expect(quienResolvio(alerta({ resuelta_por: null }), equipo)).toBe("Resuelta");
  });
});
