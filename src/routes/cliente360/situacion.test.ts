import { describe, expect, it } from "vitest";
import { textoActualizada, varianteSituacion } from "./situacion";

describe("varianteSituacion", () => {
  it.each(["Abogados", "Incobrable", "Clearing"])("%s va en riesgo", (s) => {
    expect(varianteSituacion(s)).toBe("risk");
  });

  it.each(["Gestión CC", "Acuerdo CC", "Canje", "Negocio exterior"])("%s va neutro", (s) => {
    expect(varianteSituacion(s)).toBe("neutral");
  });
});

describe("textoActualizada", () => {
  it("usa el nombre si viene, con la fecha de Uruguay", () => {
    // 23:30 del 25/09 en Montevideo = 02:30 UTC del 26/09.
    expect(textoActualizada("Rosina López", "rlopez@pontyn.com.uy", "2026-09-26T02:30:00+00:00")).toBe(
      "Actualizada por Rosina López el 25/09/2026"
    );
  });

  it("sin nombre usa la parte del correo antes de la @", () => {
    expect(textoActualizada(null, "rlopez@pontyn.com.uy", "2026-09-26T02:30:00+00:00")).toBe(
      "Actualizada por rlopez el 25/09/2026"
    );
  });

  it("sin datos no dice nada", () => {
    expect(textoActualizada(null, null, null)).toBeNull();
  });

  it("solo con fecha", () => {
    expect(textoActualizada(null, null, "2026-09-25T13:00:00+00:00")).toBe("Actualizada el 25/09/2026");
  });
});
