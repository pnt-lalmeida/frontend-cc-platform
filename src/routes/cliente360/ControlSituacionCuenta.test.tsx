import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SituacionCuentaResponse } from "../../api/types";
import { ControlSituacionCuenta } from "./ControlSituacionCuenta";

const apiFetch = vi.fn();
vi.mock("../../api/client", async (original) => ({
  ...(await original<typeof import("../../api/client")>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));
vi.mock("../../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));

const OPCIONES = ["Gestión CC", "Acuerdo CC", "Abogados", "Canje"];

function respuesta(parcial: Partial<SituacionCuentaResponse> = {}): SituacionCuentaResponse {
  return {
    situacion: null,
    actualizada_por: null,
    actualizada_por_nombre: null,
    actualizada_utc: null,
    opciones: OPCIONES,
    ...parcial,
  };
}

// Mientras carga hay un "Definir situación" deshabilitado: se espera al habilitado.
async function botonDefinirListo(): Promise<HTMLButtonElement> {
  return waitFor(() => {
    const boton = screen.getByRole("button", { name: /definir situación/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
    return boton;
  });
}

describe("ControlSituacionCuenta", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("sin situación muestra un control discreto para definirla", async () => {
    apiFetch.mockResolvedValue(respuesta());
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    expect(await botonDefinirListo()).toBeTruthy();
    expect(apiFetch).toHaveBeenCalledWith("/api/clientes/C1-17453/situacion", { token: "token" });
  });

  it("con situación muestra la etiqueta con quién y cuándo la actualizó", async () => {
    apiFetch.mockResolvedValue(
      respuesta({
        situacion: "Abogados",
        actualizada_por: "rlopez@pontyn.com.uy",
        actualizada_por_nombre: "Rosina López",
        actualizada_utc: "2026-09-25T13:00:00+00:00",
      })
    );
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    const boton = await screen.findByRole("button", { name: /situación: abogados/i });
    expect(boton.getAttribute("title")).toBe("Actualizada por Rosina López el 25/09/2026");
  });

  it("al elegir una opción la guarda con PUT sin pedir confirmación y cierra el selector", async () => {
    apiFetch.mockImplementation(async (_url: string, opciones: { method?: string }) =>
      opciones.method === "PUT" ? respuesta({ situacion: "Canje" }) : respuesta()
    );
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    fireEvent.click(await botonDefinirListo());
    expect(screen.getByRole("radio", { name: "Sin situación especial" }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Canje" }));

    await screen.findByRole("button", { name: /situación: canje/i });
    expect(apiFetch).toHaveBeenCalledWith("/api/clientes/C1-17453/situacion", {
      token: "token",
      method: "PUT",
      body: { situacion: "Canje" },
    });
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });

  it("'Sin situación especial' envía null", async () => {
    apiFetch.mockImplementation(async (_url: string, opciones: { method?: string }) =>
      opciones.method === "PUT" ? respuesta() : respuesta({ situacion: "Canje" })
    );
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    fireEvent.click(await screen.findByRole("button", { name: /situación: canje/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Sin situación especial" }));

    await botonDefinirListo();
    expect(apiFetch).toHaveBeenLastCalledWith("/api/clientes/C1-17453/situacion", {
      token: "token",
      method: "PUT",
      body: { situacion: null },
    });
  });

  it("elegir el valor vigente no hace PUT", async () => {
    apiFetch.mockResolvedValue(respuesta({ situacion: "Canje" }));
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    fireEvent.click(await screen.findByRole("button", { name: /situación: canje/i }));
    fireEvent.click(screen.getByRole("radio", { name: "Canje" }));

    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("si el guardado falla, el error queda visible en el selector", async () => {
    const { ApiError } = await import("../../api/client");
    apiFetch.mockImplementation(async (_url: string, opciones: { method?: string }) => {
      if (opciones.method === "PUT") throw new ApiError(500, undefined);
      return respuesta();
    });
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    fireEvent.click(await botonDefinirListo());
    fireEvent.click(screen.getByRole("radio", { name: "Abogados" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    expect(screen.getByRole("button", { name: /definir situación/i })).toBeTruthy();
  });

  it("en una cuenta hija avisa que la situación es compartida con el pagador central", async () => {
    apiFetch.mockResolvedValue(respuesta({ pagador_central: { card_code: "C1-17454", card_name: "Casa central" } }));
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    fireEvent.click(await botonDefinirListo());
    expect(screen.getByText(/compartida con el pagador central/i).textContent).toContain("C1-17454");
  });

  it("Escape cierra el selector", async () => {
    apiFetch.mockResolvedValue(respuesta());
    render(<ControlSituacionCuenta cardCode="C1-17453" />);

    fireEvent.click(await botonDefinirListo());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("radiogroup")).toBeNull());
  });

  it("mientras carga ocupa su lugar con el control deshabilitado (el encabezado no salta)", () => {
    apiFetch.mockReturnValue(new Promise(() => {}));
    render(<ControlSituacionCuenta cardCode="C1-17453" />);
    const boton = screen.getByRole("button", { name: /definir situación/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
  });

  it("teclado: una sola parada de Tab y flechas, Home y End para moverse", async () => {
    apiFetch.mockResolvedValue(respuesta({ situacion: "Acuerdo CC" }));
    render(<ControlSituacionCuenta cardCode="C1-17453" />);
    fireEvent.click(await screen.findByRole("button", { name: /situación: acuerdo cc/i }));

    const radios = screen.getAllByRole("radio");
    expect(radios[2].textContent).toContain("Acuerdo CC");
    expect(radios.filter((r) => r.getAttribute("tabindex") === "0")).toEqual([radios[2]]);
    expect(document.activeElement).toBe(radios[2]);

    fireEvent.keyDown(radios[2], { key: "ArrowDown" });
    expect(document.activeElement).toBe(radios[3]);
    expect(radios[3].getAttribute("tabindex")).toBe("0");
    expect(radios[2].getAttribute("tabindex")).toBe("-1");

    fireEvent.keyDown(radios[3], { key: "ArrowUp" });
    expect(document.activeElement).toBe(radios[2]);

    fireEvent.keyDown(radios[2], { key: "End" });
    expect(document.activeElement).toBe(radios[radios.length - 1]);
    fireEvent.keyDown(radios[radios.length - 1], { key: "ArrowDown" });
    expect(document.activeElement).toBe(radios[0]);
    fireEvent.keyDown(radios[0], { key: "ArrowUp" });
    expect(document.activeElement).toBe(radios[radios.length - 1]);
    fireEvent.keyDown(radios[radios.length - 1], { key: "Home" });
    expect(document.activeElement).toBe(radios[0]);

    // Mover el foco no guarda nada: solo Enter/Espacio o clic eligen.
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it("el selector se ancla a la izquierda del botón y a la derecha si no entra", async () => {
    apiFetch.mockResolvedValue(respuesta());
    const original = HTMLElement.prototype.getBoundingClientRect;
    let izquierda = 100;
    HTMLElement.prototype.getBoundingClientRect = function () {
      return { left: izquierda, right: izquierda + 110, top: 0, bottom: 20, width: 110, height: 20, x: izquierda, y: 0, toJSON: () => ({}) };
    };
    try {
      render(<ControlSituacionCuenta cardCode="C1-17453" />);
      const boton = await botonDefinirListo();
      fireEvent.click(boton);
      let panel = screen.getByRole("dialog");
      expect(panel.style.left).toBe("0px");
      expect(panel.style.right).toBe("");

      fireEvent.click(boton);
      izquierda = window.innerWidth - 120;
      fireEvent.click(boton);
      panel = screen.getByRole("dialog");
      expect(panel.style.right).toBe("0px");
      expect(panel.style.left).toBe("");
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
    }
  });

  it("si no se pudo cargar, lo dice sin romper", async () => {
    apiFetch.mockRejectedValue(new Error("500"));
    render(<ControlSituacionCuenta cardCode="C1-17453" />);
    expect(await screen.findByText(/situación no disponible/i)).toBeTruthy();
  });
});
