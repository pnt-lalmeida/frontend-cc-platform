import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PromesaPago } from "../../api/types";
import { PromesasVigentes } from "./PromesasVigentes";
import type { EstadoPromesas } from "./usePromesas";

const HOY = "2026-09-29";
const EQUIPO = [{ upn: "rlopez@pontyn.com.uy", nombre: "Rosina López" }];

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

function estado(parcial: Partial<EstadoPromesas> = {}): EstadoPromesas {
  return {
    datos: { promesas: [], monedas: ["UYU", "USD", "EUR"] },
    cargando: false,
    error: null,
    recargar: vi.fn().mockResolvedValue(undefined),
    enviando: false,
    errorRegistrar: null,
    registrar: vi.fn(),
    ...parcial,
  };
}

function montar(e: EstadoPromesas, enPiloto = false) {
  return render(<PromesasVigentes estado={e} equipo={EQUIPO} hoy={HOY} enPiloto={enPiloto} />);
}

describe("PromesasVigentes", () => {
  it("sin promesas invita a la acción en vez de informar de la nada", () => {
    montar(estado());
    expect(screen.getByRole("heading", { name: "Promesas de pago" })).toBeTruthy();
    expect(screen.getByText(/Sin promesas de pago vigentes\. Registrá una desde Registrar/)).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("cada promesa muestra primero cuándo vence, el importe con su moneda y la fecha exacta", () => {
    montar(estado({ datos: { promesas: [promesa()], monedas: ["UYU"] } }));
    const fila = screen.getByRole("listitem");
    expect(within(fila).getByText("Vence en 3 días")).toBeTruthy();
    expect(within(fila).getByText("$ 45.000,00")).toBeTruthy();
    expect(within(fila).getByText("02/10/2026")).toBeTruthy();
    expect(within(fila).getByText("Registrada por Rosina López el 29/09/2026")).toBeTruthy();
    // El importe usa la fuente mono (convención del proyecto para cifras).
    expect(within(fila).getByText("$ 45.000,00").style.fontFamily).toBe("var(--font-mono)");
  });

  it("muestra facturas y canal si están, y nada si no", () => {
    const { unmount } = montar(
      estado({ datos: { promesas: [promesa({ facturas: "A-1234, A-1240", canal: "WhatsApp" })], monedas: ["UYU"] } })
    );
    expect(screen.getByText("Facturas: A-1234, A-1240 · Por WhatsApp")).toBeTruthy();
    unmount();
    montar(estado({ datos: { promesas: [promesa()], monedas: ["UYU"] } }));
    expect(screen.queryByText(/Facturas:/)).toBeNull();
    expect(screen.queryByText(/Por /)).toBeNull();
  });

  it("solo vigentes y por fecha ascendente; las cumplidas no aparecen (viven en la bitácora)", () => {
    montar(
      estado({
        datos: {
          monedas: ["UYU"],
          promesas: [
            promesa({ id: 1, fecha_prometida: "2026-10-09", importe: 300 }),
            promesa({ id: 2, fecha_prometida: "2026-09-30", importe: 999, estado: "cumplida" }),
            promesa({ id: 3, fecha_prometida: "2026-10-01", importe: 100 }),
            promesa({ id: 4, fecha_prometida: "2026-10-01", importe: 888, estado: "incumplida" }),
          ],
        },
      })
    );
    const filas = screen.getAllByRole("listitem");
    expect(filas).toHaveLength(2);
    expect(filas[0].textContent).toContain("$ 100,00");
    expect(filas[1].textContent).toContain("$ 300,00");
  });

  it("vencida a verificar: dice 'verificando' y lleva su etiqueta", () => {
    montar(
      estado({ datos: { promesas: [promesa({ fecha_prometida: "2026-09-26", estado: "vencida_a_verificar" })], monedas: ["UYU"] } })
    );
    const fila = screen.getByRole("listitem");
    expect(within(fila).getByText("Venció hace 3 días, verificando")).toBeTruthy();
    expect(within(fila).getByText("Verificando")).toBeTruthy();
  });

  it("vigente cuya fecha ya pasó igual dice 'verificando', sin etiqueta duplicada", () => {
    montar(estado({ datos: { promesas: [promesa({ fecha_prometida: "2026-09-28" })], monedas: ["UYU"] } }));
    expect(screen.getByText("Venció ayer, verificando")).toBeTruthy();
    expect(screen.queryByText("Verificando")).toBeNull();
  });

  it("mientras carga ocupa el lugar del estado final y avisa que está ocupado", () => {
    const { container } = montar(estado({ datos: null, cargando: true }));
    expect(screen.getByText("Cargando promesas...")).toBeTruthy();
    expect(container.querySelector("section")?.getAttribute("aria-busy")).toBe("true");
  });

  it("si falla la carga no queda cargando: muestra el error y deja reintentar", () => {
    const recargar = vi.fn().mockResolvedValue(undefined);
    montar(estado({ datos: null, error: "No se pudieron cargar las promesas de pago.", recargar }));
    expect(screen.queryByText("Cargando promesas...")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("No se pudieron cargar las promesas de pago.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it("si falla una recarga conserva la lista y ofrece reintentar", () => {
    montar(
      estado({ datos: { promesas: [promesa()], monedas: ["UYU"] }, error: "No se pudieron cargar las promesas de pago." })
    );
    expect(screen.getByRole("listitem")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("marca el piloto solo si corresponde", () => {
    const { unmount } = montar(estado(), true);
    expect(screen.getByText(/piloto/i)).toBeTruthy();
    unmount();
    montar(estado(), false);
    expect(screen.queryByText(/piloto/i)).toBeNull();
  });
});
