import { fireEvent, render, screen, within } from "@testing-library/react";
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

function expandir() {
  fireEvent.click(screen.getByRole("button", { name: /ver detalle/i }));
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

    expandir();
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
    expandir();
    expect(screen.getByText(/montos redondeados/i)).toBeTruthy();
  });

  it("sin saldo de más de 61 días no usa color de riesgo", () => {
    render(<BloqueAntiguedadSaldos {...base} filas={[fila({ vencimiento: "2026-09-20", saldo: 500 })]} />);
    expandir();
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
    expandir();
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

  describe("vista compacta (por defecto)", () => {
    it("cliente al día en dos monedas: una línea por moneda, 'Al día', sin ceros ni tramos", () => {
      const { container } = render(
        <BloqueAntiguedadSaldos
          {...base}
          filas={[
            fila({ moneda: "USD", vencimiento: "2026-10-20", saldo: 771 }),
            fila({ moneda: "UYU", vencimiento: "2026-10-20", saldo: 1762 }),
          ]}
        />
      );
      const usd = screen.getByTestId("resumen-USD");
      const uyu = screen.getByTestId("resumen-UYU");
      expect(usd.textContent).toContain("US$ 771");
      expect(usd.textContent).toMatch(/al día/i);
      expect(uyu.textContent).toContain("$ 1.762");
      expect(uyu.textContent).toMatch(/al día/i);
      expect(container.textContent).not.toMatch(/0-30|31-60|121\+|a vencer/i);
      expect(container.textContent).not.toMatch(/(^|[^\d.,])0(?![\d.,])/);
      expect(screen.queryByTestId("mayor-61-USD")).toBeNull();
    });

    it("con deuda de más de 61 días: total y el monto de +61 destacado en riesgo", () => {
      render(
        <BloqueAntiguedadSaldos
          {...base}
          filas={[
            fila({ vencimiento: "2026-07-01", saldo: 1500 }),
            fila({ vencimiento: "2026-09-20", saldo: 500 }),
          ]}
        />
      );
      const linea = screen.getByTestId("resumen-UYU");
      expect(linea.textContent).toContain("$ 2.000");
      const destacado = within(linea).getByTestId("mayor-61-compacto-UYU");
      expect(destacado.textContent).toContain("$ 1.500");
      expect(destacado.textContent).toMatch(/más de 61 días/i);
      expect(destacado.style.color).toBe("var(--color-risk)");
    });

    it("vencido pero nada de +61: total y vencido, sin alarma", () => {
      render(
        <BloqueAntiguedadSaldos
          {...base}
          filas={[
            fila({ vencimiento: "2026-09-20", saldo: 500 }),
            fila({ vencimiento: "2026-08-10", saldo: 300 }),
            fila({ vencimiento: "2026-10-10", saldo: 250 }),
          ]}
        />
      );
      const linea = screen.getByTestId("resumen-UYU");
      expect(linea.textContent).toContain("$ 1.050");
      expect(linea.textContent).toContain("$ 800 vencido");
      expect(linea.textContent).not.toMatch(/al día/i);
      expect(screen.queryByTestId("mayor-61-compacto-UYU")).toBeNull();
    });

    it("una sola moneda: una sola línea", () => {
      render(<BloqueAntiguedadSaldos {...base} filas={[fila({ vencimiento: "2026-10-20", saldo: 100 })]} />);
      expect(screen.getAllByTestId(/^resumen-/)).toHaveLength(1);
      expect(screen.queryByTestId("resumen-USD")).toBeNull();
    });

    it("moneda sin saldo no aparece", () => {
      render(
        <BloqueAntiguedadSaldos
          {...base}
          filas={[fila({ moneda: "USD", saldo: 0 }), fila({ moneda: "UYU", vencimiento: "2026-10-20", saldo: 100 })]}
        />
      );
      expect(screen.queryByTestId("resumen-USD")).toBeNull();
      expect(screen.getByTestId("resumen-UYU")).toBeTruthy();
    });
  });

  describe("expandir y colapsar", () => {
    const filas = [
      fila({ moneda: "UYU", vencimiento: "2026-10-20", saldo: 1762 }),
      fila({ moneda: "USD", vencimiento: "2026-10-20", saldo: 771 }),
    ];

    it("el botón arranca colapsado, dice qué hace y expone aria-expanded", () => {
      render(<BloqueAntiguedadSaldos {...base} filas={filas} />);
      const boton = screen.getByRole("button", { name: /ver detalle/i });
      expect(boton.getAttribute("aria-expanded")).toBe("false");
      expect(boton.getAttribute("aria-controls")).toBeTruthy();
      expect(boton.getAttribute("type")).toBe("button");
    });

    it("al expandir se ven los tramos de cada moneda y 'A vencer', y el botón pasa a 'Ver menos'", () => {
      render(<BloqueAntiguedadSaldos {...base} filas={filas} />);
      expandir();
      const boton = screen.getByRole("button", { name: /ver menos/i });
      expect(boton.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getAllByText("A vencer")).toHaveLength(2);
      expect(screen.getAllByText("121+ días")).toHaveLength(2);
      expect(screen.getByTestId("mayor-61-UYU")).toBeTruthy();
      expect(screen.getByTestId("mayor-61-USD")).toBeTruthy();
      expect(screen.getByText(/nunca se suman/i)).toBeTruthy();
    });

    it("al colapsar vuelve a la línea compacta", () => {
      render(<BloqueAntiguedadSaldos {...base} filas={filas} />);
      expandir();
      fireEvent.click(screen.getByRole("button", { name: /ver menos/i }));
      expect(screen.queryByText("A vencer")).toBeNull();
      expect(screen.getByTestId("resumen-UYU")).toBeTruthy();
    });

    it("sin saldos, cargando o con error no hay botón", () => {
      const { rerender } = render(<BloqueAntiguedadSaldos {...base} filas={[]} />);
      expect(screen.queryByRole("button")).toBeNull();
      rerender(<BloqueAntiguedadSaldos {...base} filas={filas} loading />);
      expect(screen.queryByRole("button")).toBeNull();
      rerender(<BloqueAntiguedadSaldos {...base} filas={filas} error="x" />);
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
