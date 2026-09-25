import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EstadoCuentaFila } from "../../api/types";
import { BloqueAntiguedadSaldos } from "./BloqueAntiguedadSaldos";

const HOY = "2026-09-25";

function fila(parcial: Partial<EstadoCuentaFila>): EstadoCuentaFila {
  return {
    folio: "1",
    tipo: "Factura",
    moneda: "UYU",
    vendedor: null,
    fecha: "2026-01-01",
    vencimiento: null,
    saldo: 0,
    saldo_corrido: 0,
    ...parcial,
  };
}

const base = { pagadorCentral: null, loading: false, error: null, enPiloto: false, hoy: HOY };

describe("BloqueAntiguedadSaldos", () => {
  it("destaca 'Más de 61 días' en color de riesgo y muestra tramos y total", () => {
    render(
      <BloqueAntiguedadSaldos
        {...base}
        filas={[
          fila({ vencimiento: "2026-07-01", saldo: 1500 }), // 86 días
          fila({ vencimiento: "2026-09-20", saldo: 500 }), // 5 días
          fila({ vencimiento: "2026-10-10", saldo: 250 }), // a vencer
        ]}
      />
    );

    const destacado = screen.getByTestId("mayor-61-UYU");
    expect(destacado.textContent).toBe("$ 1.500");
    expect(destacado.style.color).toBe("var(--color-risk)");
    expect(screen.getByText("Total").nextSibling?.textContent).toBe("$ 2.250");
    const tramo = screen.getByText("0-30 días").parentElement as HTMLElement;
    expect(within(tramo).getByText("$ 500")).toBeTruthy();
    expect(screen.getByText("A vencer")).toBeTruthy();
    expect(screen.getByText("121+ días")).toBeTruthy();
  });

  it("aclara que los montos van redondeados (pueden no sumar exacto)", () => {
    render(<BloqueAntiguedadSaldos {...base} filas={[fila({ vencimiento: "2026-09-20", saldo: 500.4 })]} />);
    expect(screen.getByText(/montos redondeados/i)).toBeTruthy();
  });

  it("sin saldo de más de 61 días no usa color de riesgo", () => {
    render(<BloqueAntiguedadSaldos {...base} filas={[fila({ vencimiento: "2026-09-20", saldo: 500 })]} />);
    expect(screen.getByTestId("mayor-61-UYU").style.color).not.toBe("var(--color-risk)");
  });

  it("una tarjeta por moneda, sin sumarlas", () => {
    render(
      <BloqueAntiguedadSaldos
        {...base}
        filas={[
          fila({ moneda: "UYU", vencimiento: "2026-06-01", saldo: 1000 }),
          fila({ moneda: "USD", vencimiento: "2026-06-01", saldo: 30 }),
        ]}
      />
    );
    expect(screen.getByTestId("mayor-61-UYU").textContent).toBe("$ 1.000");
    expect(screen.getByTestId("mayor-61-USD").textContent).toBe("US$ 30");
    expect(screen.getByText(/nunca se suman/i)).toBeTruthy();
  });

  it("avisa cuando el estado de cuenta es el consolidado del pagador central", () => {
    render(
      <BloqueAntiguedadSaldos
        {...base}
        pagadorCentral={{ card_code: "C1-17454", card_name: "Casa central" }}
        filas={[fila({ vencimiento: "2026-09-20", saldo: 500 })]}
      />
    );
    expect(screen.getByText(/pagador central/i).textContent).toContain("C1-17454");
  });

  it("estados de carga, error y vacío", () => {
    const { rerender } = render(<BloqueAntiguedadSaldos {...base} filas={[]} loading />);
    expect(screen.getByText(/cargando/i)).toBeTruthy();

    rerender(<BloqueAntiguedadSaldos {...base} filas={[]} error="No se pudo cargar el estado de cuenta." />);
    expect(screen.getByText("No se pudo cargar el estado de cuenta.")).toBeTruthy();

    rerender(<BloqueAntiguedadSaldos {...base} filas={[]} />);
    expect(screen.getByText(/sin saldos abiertos/i)).toBeTruthy();
  });

  it("muestra el badge de piloto si corresponde", () => {
    render(<BloqueAntiguedadSaldos {...base} enPiloto filas={[]} />);
    expect(screen.getByText("Piloto")).toBeTruthy();
  });
});
