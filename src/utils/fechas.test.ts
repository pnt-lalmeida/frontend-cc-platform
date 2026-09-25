import { describe, expect, it } from "vitest";
import { diaCalendario, hoyUruguay } from "./fechas";

describe("hoyUruguay", () => {
  it("usa la fecha de Montevideo, no la de UTC", () => {
    // 22:00 del 25/09 en Uruguay (UTC-3) ya es 26/09 en UTC.
    expect(hoyUruguay(new Date("2026-09-26T01:00:00Z"))).toBe("2026-09-25");
    expect(hoyUruguay(new Date("2026-09-26T02:59:00Z"))).toBe("2026-09-25");
    expect(hoyUruguay(new Date("2026-09-26T03:00:00Z"))).toBe("2026-09-26");
  });
});

describe("diaCalendario", () => {
  it("toma el día de una fecha de SAP con o sin hora", () => {
    expect(diaCalendario("2026-09-25")).toBe(Date.UTC(2026, 8, 25));
    expect(diaCalendario("2026-09-25T00:00:00Z")).toBe(Date.UTC(2026, 8, 25));
  });

  it("una fecha inválida da null", () => {
    expect(diaCalendario("no-es-fecha")).toBeNull();
  });
});
