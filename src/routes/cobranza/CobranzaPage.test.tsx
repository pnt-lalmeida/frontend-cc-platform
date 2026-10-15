import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { CobranzaProgramada, CobranzaProgramadaResponse } from "../../api/types";
import { CobranzaPage } from "./CobranzaPage";

const obtener = vi.fn();
const guardarDireccion = vi.fn();
const anular = vi.fn();
const apiMock = {
  obtener: (...args: unknown[]) => obtener(...args),
  acciones: {
    guardarDireccion: (...args: unknown[]) => guardarDireccion(...args),
    anular: (...args: unknown[]) => anular(...args),
  },
};
vi.mock("./useApiCobranza", () => ({ useApiCobranza: () => apiMock }));

function cobranza(id: number, parcial: Partial<CobranzaProgramada> = {}): CobranzaProgramada {
  return {
    id,
    numero_sn: `0292${id}`,
    card_code: `C1-0292${id}`,
    cliente_nombre: `Cliente ${id}`,
    direccion: { texto: `Rivera ${id}000, Montevideo`, origen: "sap", editada_por: null, editada_utc: null },
    fecha_cobranza: "2026-10-15",
    horario: "14 a 16 h",
    importe: 45000,
    moneda: "UYU",
    registrada_por: "rlopez@pontyn.com.uy",
    registrada_utc: "2026-10-14T12:00:00Z",
    ...parcial,
  };
}

function respuesta(cobranzas: CobranzaProgramada[], parcial: Partial<CobranzaProgramadaResponse> = {}): CobranzaProgramadaResponse {
  return { fecha: "2026-10-15", cobranzas, errores: [], ...parcial };
}

function montar() {
  return render(
    <MemoryRouter>
      <CobranzaPage />
    </MemoryRouter>
  );
}

function tarjeta(nombre: string): HTMLElement {
  return screen.getByRole("article", { name: new RegExp(nombre) });
}

describe("CobranzaPage", () => {
  beforeEach(() => {
    // 15/10/2026 12:00 en Montevideo.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
    obtener.mockReset().mockResolvedValue(respuesta([cobranza(1)]));
    guardarDireccion.mockReset();
    anular.mockReset().mockResolvedValue({});
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("lista", () => {
    it("pide el día de hoy y muestra la cobranza con todos sus datos", async () => {
      montar();
      expect(await screen.findByRole("article", { name: /Cliente 1/ })).toBeTruthy();
      expect(obtener).toHaveBeenCalledWith("2026-10-15");
      const t = tarjeta("Cliente 1");
      expect(within(t).getByText("02921")).toBeTruthy();
      expect(within(t).getByText("Rivera 1000, Montevideo")).toBeTruthy();
      expect(within(t).getByText("Dirección de SAP")).toBeTruthy();
      expect(within(t).getByText("14 a 16 h")).toBeTruthy();
      expect(within(t).getByText("$ 45.000,00")).toBeTruthy();
      const ficha = within(t).getByRole("link", { name: /Ver ficha de Cliente 1/ });
      expect(ficha.getAttribute("href")).toBe("/cliente-360?cliente=C1-02921");
    });

    it("el encabezado dice el día y cuántas hay", async () => {
      obtener.mockResolvedValue(respuesta([cobranza(1), cobranza(2)]));
      montar();
      expect(await screen.findByRole("heading", { name: /jueves 15 de octubre/i })).toBeTruthy();
      expect(screen.getByText("Hoy")).toBeTruthy();
      expect(screen.getByText("2 cobranzas")).toBeTruthy();
    });

    it("sin horario ni importe lo dice o no inventa nada", async () => {
      obtener.mockResolvedValue(respuesta([cobranza(1, { horario: null, importe: null, moneda: null })]));
      montar();
      const t = await screen.findByRole("article", { name: /Cliente 1/ });
      expect(within(t).getByText("Sin horario")).toBeTruthy();
      expect(within(t).queryByText(/\$/)).toBeNull();
    });

    it("dirección editada en la plataforma: dice quién y cuándo", async () => {
      obtener.mockResolvedValue(
        respuesta([
          cobranza(1, {
            direccion: { texto: "Colonia 900", origen: "plataforma", editada_por: "clopez@pontyn.com.uy", editada_utc: "2026-10-14T15:00:00Z" },
          }),
        ])
      );
      montar();
      const t = await screen.findByRole("article", { name: /Cliente 1/ });
      expect(within(t).getByText("Colonia 900")).toBeTruthy();
      expect(within(t).getByText("Editada por clopez el 14/10/2026")).toBeTruthy();
    });

    it("sin dirección en SAP: lo dice y ofrece cargarla", async () => {
      obtener.mockResolvedValue(respuesta([cobranza(1, { direccion: { texto: null, origen: null, editada_por: null, editada_utc: null } })]));
      montar();
      const t = await screen.findByRole("article", { name: /Cliente 1/ });
      expect(within(t).getByText("Sin dirección en SAP")).toBeTruthy();
      expect(within(t).getByRole("button", { name: /Cargar dirección/ })).toBeTruthy();
      expect(within(t).queryByRole("button", { name: /Editar dirección/ })).toBeNull();
    });

    it("si fallaron las direcciones de SAP avisa, y la lista igual se ve", async () => {
      obtener.mockResolvedValue(
        respuesta([cobranza(1, { direccion: { texto: null, origen: null, editada_por: null, editada_utc: null } })], {
          errores: ["direcciones_sap"],
        })
      );
      montar();
      const t = await screen.findByRole("article", { name: /Cliente 1/ });
      expect(within(t).getByText("No se pudo traer la dirección de SAP")).toBeTruthy();
      expect(within(t).queryByText("Sin dirección en SAP")).toBeNull();
      expect(screen.getByText(/No se pudieron traer las direcciones de SAP/)).toBeTruthy();
    });

    it("día sin cobranzas: dice cómo se cargan", async () => {
      obtener.mockResolvedValue(respuesta([]));
      montar();
      expect(await screen.findByText("No hay cobranzas programadas para este día.")).toBeTruthy();
      expect(screen.getByText(/Actividad/)).toBeTruthy();
      expect(screen.getByText(/Pago coordinado/)).toBeTruthy();
    });

    it("error de carga: mensaje y Reintentar, nunca cargando para siempre", async () => {
      obtener.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(respuesta([cobranza(1)]));
      montar();
      const alerta = await screen.findByRole("alert");
      expect(alerta.textContent).toContain("No se pudieron cargar las cobranzas.");
      expect(screen.queryByText(/Cargando/)).toBeNull();
      fireEvent.click(within(alerta).getByRole("button", { name: "Reintentar" }));
      expect(await screen.findByRole("article", { name: /Cliente 1/ })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("no guarda datos de clientes en localStorage", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      expect(localStorage.length).toBe(0);
    });
  });

  describe("selector de día", () => {
    it("siguiente y anterior piden el día que corresponde", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      obtener.mockResolvedValue(respuesta([], { fecha: "2026-10-16" }));
      fireEvent.click(screen.getByRole("button", { name: "Día siguiente" }));
      await waitFor(() => expect(obtener).toHaveBeenLastCalledWith("2026-10-16"));
      expect(await screen.findByText("Mañana")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Día anterior" }));
      await waitFor(() => expect(obtener).toHaveBeenLastCalledWith("2026-10-15"));
    });

    it("elegir una fecha y volver a hoy", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      expect(screen.queryByRole("button", { name: "Ir a hoy" })).toBeNull();
      obtener.mockResolvedValue(respuesta([], { fecha: "2026-10-22" }));
      fireEvent.change(screen.getByLabelText("Ir a otro día"), { target: { value: "2026-10-22" } });
      await waitFor(() => expect(obtener).toHaveBeenLastCalledWith("2026-10-22"));
      expect(await screen.findByRole("heading", { name: /jueves 22 de octubre/i })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Ir a hoy" }));
      await waitFor(() => expect(obtener).toHaveBeenLastCalledWith("2026-10-15"));
    });

    it("una fecha vacía o inválida del selector no cambia de día", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      obtener.mockClear();
      fireEvent.change(screen.getByLabelText("Ir a otro día"), { target: { value: "" } });
      expect(obtener).not.toHaveBeenCalled();
    });

    it("la lista de un día no se ve bajo el título de otro", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      obtener.mockReturnValue(new Promise(() => {}));
      fireEvent.click(screen.getByRole("button", { name: "Día siguiente" }));
      expect(screen.queryByRole("article", { name: /Cliente 1/ })).toBeNull();
      expect(screen.getByText(/Cargando/)).toBeTruthy();
    });
  });

  describe("editar dirección", () => {
    const NUEVA = { texto: "Colonia 900, apto 2", origen: "plataforma" as const, editada_por: "rlopez@pontyn.com.uy", editada_utc: "2026-10-15T15:00:00Z" };

    async function abrirEdicion() {
      montar();
      const t = await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(within(t).getByRole("button", { name: /Editar dirección/ }));
      return t;
    }

    it("abre un campo con la dirección actual y el foco puesto", async () => {
      const t = await abrirEdicion();
      const campo = within(t).getByLabelText("Dirección de cobranza") as HTMLTextAreaElement;
      expect(campo.value).toBe("Rivera 1000, Montevideo");
      expect(document.activeElement).toBe(campo);
    });

    it("guarda, muestra la nueva dirección con su origen y devuelve el foco al botón", async () => {
      guardarDireccion.mockResolvedValue(NUEVA);
      const t = await abrirEdicion();
      fireEvent.change(within(t).getByLabelText("Dirección de cobranza"), { target: { value: "  Colonia 900, apto 2 " } });
      fireEvent.click(within(t).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(within(t).getByText("Colonia 900, apto 2")).toBeTruthy());
      expect(guardarDireccion).toHaveBeenCalledWith("C1-02921", "Colonia 900, apto 2");
      expect(within(t).getByText("Editada por rlopez el 15/10/2026")).toBeTruthy();
      expect(within(t).queryByLabelText("Dirección de cobranza")).toBeNull();
      expect(document.activeElement).toBe(within(t).getByRole("button", { name: /Editar dirección/ }));
    });

    it("mientras guarda, Guardar y Cancelar quedan deshabilitados (no hay doble envío)", async () => {
      guardarDireccion.mockReturnValue(new Promise(() => {}));
      const t = await abrirEdicion();
      fireEvent.change(within(t).getByLabelText("Dirección de cobranza"), { target: { value: "Colonia 900" } });
      fireEvent.click(within(t).getByRole("button", { name: "Guardar" }));
      const guardar = await within(t).findByRole("button", { name: /Guardando/ });
      expect((guardar as HTMLButtonElement).disabled).toBe(true);
      expect((within(t).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(guardar);
      expect(guardarDireccion).toHaveBeenCalledTimes(1);
    });

    it("mientras guarda, el campo de dirección también queda deshabilitado", async () => {
      guardarDireccion.mockReturnValue(new Promise(() => {}));
      const t = await abrirEdicion();
      fireEvent.change(within(t).getByLabelText("Dirección de cobranza"), { target: { value: "Colonia 900" } });
      fireEvent.click(within(t).getByRole("button", { name: "Guardar" }));
      await within(t).findByRole("button", { name: /Guardando/ });
      expect((within(t).getByLabelText("Dirección de cobranza") as HTMLTextAreaElement).disabled).toBe(true);
    });

    it("dirección vacía: error junto al campo y no llama a la API", async () => {
      const t = await abrirEdicion();
      fireEvent.change(within(t).getByLabelText("Dirección de cobranza"), { target: { value: "   " } });
      fireEvent.click(within(t).getByRole("button", { name: "Guardar" }));
      const error = within(t).getByText("Escribí la dirección.");
      expect(error.id).toBeTruthy();
      expect(within(t).getByLabelText("Dirección de cobranza").getAttribute("aria-describedby")).toContain(error.id);
      expect(guardarDireccion).not.toHaveBeenCalled();
    });

    it("error del servidor: mensaje junto al campo, el texto escrito se conserva", async () => {
      guardarDireccion.mockRejectedValue(new ApiError(500, {}));
      const t = await abrirEdicion();
      fireEvent.change(within(t).getByLabelText("Dirección de cobranza"), { target: { value: "Colonia 900" } });
      fireEvent.click(within(t).getByRole("button", { name: "Guardar" }));
      expect(await within(t).findByText("No se pudo guardar la dirección. Intentá de nuevo.")).toBeTruthy();
      expect((within(t).getByLabelText("Dirección de cobranza") as HTMLTextAreaElement).value).toBe("Colonia 900");
      expect((within(t).getByRole("button", { name: "Guardar" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("Cancelar y Escape cierran sin guardar", async () => {
      const t = await abrirEdicion();
      fireEvent.change(within(t).getByLabelText("Dirección de cobranza"), { target: { value: "otra" } });
      fireEvent.click(within(t).getByRole("button", { name: "Cancelar" }));
      expect(within(t).queryByLabelText("Dirección de cobranza")).toBeNull();
      expect(within(t).getByText("Rivera 1000, Montevideo")).toBeTruthy();
      fireEvent.click(within(t).getByRole("button", { name: /Editar dirección/ }));
      expect((within(t).getByLabelText("Dirección de cobranza") as HTMLTextAreaElement).value).toBe("Rivera 1000, Montevideo");
      fireEvent.keyDown(within(t).getByLabelText("Dirección de cobranza"), { key: "Escape" });
      expect(within(t).queryByLabelText("Dirección de cobranza")).toBeNull();
      expect(guardarDireccion).not.toHaveBeenCalled();
    });

    it("cargar la dirección cuando SAP no tiene: campo vacío", async () => {
      obtener.mockResolvedValue(respuesta([cobranza(1, { direccion: { texto: null, origen: null, editada_por: null, editada_utc: null } })]));
      montar();
      const t = await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(within(t).getByRole("button", { name: /Cargar dirección/ }));
      expect((within(t).getByLabelText("Dirección de cobranza") as HTMLTextAreaElement).value).toBe("");
    });

    it("editar una tarjeta no cierra ni toca la edición de otra", async () => {
      obtener.mockResolvedValue(respuesta([cobranza(1), cobranza(2)]));
      montar();
      const t1 = await screen.findByRole("article", { name: /Cliente 1/ });
      const t2 = screen.getByRole("article", { name: /Cliente 2/ });
      fireEvent.click(within(t1).getByRole("button", { name: /Editar dirección/ }));
      fireEvent.click(within(t2).getByRole("button", { name: /Editar dirección/ }));
      expect(within(t1).getByLabelText("Dirección de cobranza")).toBeTruthy();
      expect(within(t2).getByLabelText("Dirección de cobranza")).toBeTruthy();
    });
  });

  describe("anular", () => {
    async function pedirAnular() {
      obtener.mockResolvedValue(respuesta([cobranza(1), cobranza(2)]));
      montar();
      const t = await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(within(t).getByRole("button", { name: /^Anular/ }));
      return t;
    }

    it("pide confirmación antes de anular", async () => {
      const t = await pedirAnular();
      expect(within(t).getByText(/¿Anular la cobranza de Cliente 1\?/)).toBeTruthy();
      expect(anular).not.toHaveBeenCalled();
    });

    it("confirmar anula y saca la tarjeta; la otra sigue", async () => {
      const t = await pedirAnular();
      fireEvent.click(within(t).getByRole("button", { name: "Sí, anular" }));
      await waitFor(() => expect(screen.queryByRole("article", { name: /Cliente 1/ })).toBeNull());
      expect(anular).toHaveBeenCalledWith(1);
      expect(screen.getByRole("article", { name: /Cliente 2/ })).toBeTruthy();
    });

    it("tras anular, el foco va al título del día y un aviso dice qué pasó", async () => {
      const t = await pedirAnular();
      fireEvent.click(within(t).getByRole("button", { name: "Sí, anular" }));
      await waitFor(() => expect(screen.queryByRole("article", { name: /Cliente 1/ })).toBeNull());
      const titulo = screen.getByRole("heading", { level: 1 });
      await waitFor(() => expect(document.activeElement).toBe(titulo));
      expect(screen.getByText("Se anuló la cobranza de Cliente 1.")).toBeTruthy();
    });

    it("No deja todo como estaba", async () => {
      const t = await pedirAnular();
      fireEvent.click(within(t).getByRole("button", { name: "No" }));
      expect(within(t).queryByText(/¿Anular/)).toBeNull();
      expect(within(t).getByRole("button", { name: /^Anular/ })).toBeTruthy();
      expect(anular).not.toHaveBeenCalled();
    });

    it("en vuelo el botón queda deshabilitado: un doble clic anula una sola vez", async () => {
      anular.mockReturnValue(new Promise(() => {}));
      const t = await pedirAnular();
      fireEvent.click(within(t).getByRole("button", { name: "Sí, anular" }));
      const boton = await within(t).findByRole("button", { name: /Anulando/ });
      expect((boton as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(boton);
      expect(anular).toHaveBeenCalledTimes(1);
      // El resto de la pantalla sigue usable.
      expect((within(screen.getByRole("article", { name: /Cliente 2/ })).getByRole("button", { name: /^Anular/ }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("409: dice que ya fue anulada o reprogramada y recarga la lista", async () => {
      anular.mockRejectedValue(new ApiError(409, {}));
      const t = await pedirAnular();
      obtener.mockClear().mockResolvedValue(respuesta([cobranza(2)]));
      fireEvent.click(within(t).getByRole("button", { name: "Sí, anular" }));
      await waitFor(() => expect(obtener).toHaveBeenCalledTimes(1));
      expect(await screen.findByText("Ya fue anulada o reprogramada.")).toBeTruthy();
    });

    it("otro error: mensaje en la tarjeta, que sigue en la lista, y se puede reintentar", async () => {
      anular.mockRejectedValueOnce(new Error("red")).mockResolvedValueOnce({});
      const t = await pedirAnular();
      fireEvent.click(within(t).getByRole("button", { name: "Sí, anular" }));
      expect(await within(t).findByText("No se pudo anular. Intentá de nuevo.")).toBeTruthy();
      fireEvent.click(within(t).getByRole("button", { name: "Sí, anular" }));
      await waitFor(() => expect(screen.queryByRole("article", { name: /Cliente 1/ })).toBeNull());
      expect(anular).toHaveBeenCalledTimes(2);
    });
  });
});
