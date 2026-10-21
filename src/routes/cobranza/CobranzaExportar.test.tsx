import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { CobranzaProgramada, CobranzaProgramadaResponse } from "../../api/types";
import type { FeatureNombre } from "../../features/features";
import { CobranzaPage } from "./CobranzaPage";

// Entrega "exportar" (21/10/2026): Descargar planilla e Imprimir / PDF, todo
// detrás de cobranza_exportar. Sin el flag la pantalla es la de siempre.

const habilitadas = new Set<FeatureNombre>();
vi.mock("../../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (n: FeatureNombre) => habilitadas.has(n),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: false,
  }),
}));

const obtener = vi.fn();
const descargarPlanilla = vi.fn();
const registrarImpresion = vi.fn();
const apiMock = {
  obtener: (...a: unknown[]) => obtener(...a),
  acciones: { guardarDireccion: vi.fn(), anular: vi.fn() },
  exportar: {
    descargarPlanilla: (...a: unknown[]) => descargarPlanilla(...a),
    registrarImpresion: (...a: unknown[]) => registrarImpresion(...a),
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
const impresion = (c: HTMLElement) => c.querySelector(".cobranza-impresion") as HTMLElement | null;
const boton = (nombre: string) => screen.getByRole("button", { name: nombre }) as HTMLButtonElement;
async function imprimirYEsperar() {
  fireEvent.click(boton("Imprimir / PDF"));
  await waitFor(() => expect(window.print).toHaveBeenCalled());
}

describe("Cobranza programada: exportar", () => {
  let print: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
    habilitadas.clear();
    obtener.mockReset().mockResolvedValue(respuesta([cobranza(1), cobranza(2, { horario: null, importe: 1200.5, moneda: "USD" })]));
    descargarPlanilla.mockReset().mockResolvedValue({ blob: new Blob(["x"]), nombre: "cobranza-2026-10-15.csv" });
    registrarImpresion.mockReset().mockResolvedValue({});
    print = vi.fn();
    vi.stubGlobal("print", print);
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    // jsdom no implementa la navegacion que dispara el clic de descarga.
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("sin el flag (caracterización)", () => {
    it("no hay acciones, ni vista de impresión, ni marca de imprimible, ni pedidos nuevos", async () => {
      habilitadas.add("cobranza_programada");
      const { container } = montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      expect(screen.queryByRole("button", { name: /Descargar planilla/ })).toBeNull();
      expect(screen.queryByRole("button", { name: /Imprimir/ })).toBeNull();
      expect(impresion(container)).toBeNull();
      expect(container.querySelector("[data-imprimible]")).toBeNull();
      expect(descargarPlanilla).not.toHaveBeenCalled();
      expect(registrarImpresion).not.toHaveBeenCalled();
    });
  });

  describe("con el flag", () => {
    beforeEach(() => {
      habilitadas.add("cobranza_programada");
      habilitadas.add("cobranza_exportar");
    });

    it("muestra las dos acciones habilitadas cuando el día tiene cobranzas", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      expect(boton("Descargar planilla").disabled).toBe(false);
      expect(boton("Imprimir / PDF").disabled).toBe(false);
    });

    it("descargar pide el día visible y baja el archivo", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Descargar planilla"));
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
      expect(descargarPlanilla).toHaveBeenCalledWith("2026-10-15");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake");
    });

    it("mientras descarga el botón se deshabilita y dice que está en curso", async () => {
      let resolver!: (v: unknown) => void;
      descargarPlanilla.mockReturnValue(new Promise((r) => (resolver = r)));
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Descargar planilla"));
      const enCurso = await screen.findByRole("button", { name: /Descargando/ });
      expect((enCurso as HTMLButtonElement).disabled).toBe(true);
      // El resto de la pantalla sigue usable.
      expect(boton("Día siguiente").disabled).toBe(false);
      resolver({ blob: new Blob(["x"]), nombre: null });
      await waitFor(() => expect(boton("Descargar planilla").disabled).toBe(false));
    });

    it("el 503 queda junto a las acciones: SAP no respondió, reintentar", async () => {
      descargarPlanilla.mockRejectedValue(new ApiError(503, { error: "x" }));
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Descargar planilla"));
      const alerta = await screen.findByRole("alert");
      expect(alerta.textContent).toMatch(/SAP no respondió/);
      expect(boton("Descargar planilla")).toBeTruthy();
    });

    it("imprimir registra y después abre la impresión", async () => {
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Imprimir / PDF"));
      await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
      expect(registrarImpresion).toHaveBeenCalledWith("2026-10-15");
    });

    it("si el registro falla no imprime y muestra el error", async () => {
      registrarImpresion.mockRejectedValue(new ApiError(500, undefined));
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Imprimir / PDF"));
      const alerta = await screen.findByRole("alert");
      expect(alerta.textContent).toMatch(/No se pudo imprimir/);
      expect(print).not.toHaveBeenCalled();
    });

    it("día sin cobranzas: las dos acciones deshabilitadas, con el motivo en el title", async () => {
      obtener.mockResolvedValue(respuesta([]));
      montar();
      await screen.findByText(/No hay cobranzas programadas/);
      for (const nombre of ["Descargar planilla", "Imprimir / PDF"]) {
        const b = boton(nombre);
        expect(b.disabled).toBe(true);
        expect(b.title).toMatch(/no hay cobranzas/i);
      }
    });

    it("mientras carga el día las acciones no se pueden usar", () => {
      obtener.mockReturnValue(new Promise(() => {}));
      montar();
      expect(boton("Descargar planilla").disabled).toBe(true);
    });

    it("si SAP falló al traer direcciones, imprimir se bloquea (saldría sin direcciones) pero la planilla no", async () => {
      obtener.mockResolvedValue(respuesta([cobranza(1)], { errores: ["direcciones_sap"] }));
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      const imprimir = boton("Imprimir / PDF");
      expect(imprimir.disabled).toBe(true);
      expect(imprimir.title).toMatch(/SAP/);
      // El motivo tambien es visible (en el celular no hay hover para ver el title).
      expect(screen.getByText(/Para imprimir hace falta/)).toBeTruthy();
      expect(boton("Descargar planilla").disabled).toBe(false);
    });

    it("al cambiar de día se limpia el error", async () => {
      descargarPlanilla.mockRejectedValue(new ApiError(503, undefined));
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Descargar planilla"));
      await screen.findByRole("alert");
      fireEvent.click(boton("Día siguiente"));
      await waitFor(() => expect(screen.queryByText(/SAP no respondió/)).toBeNull());
    });

    describe("vista de impresión", () => {
      it("título con día y cantidad, y una entrada por cobranza con lo que el cobrador necesita", async () => {
        const { container } = montar();
        await screen.findByRole("article", { name: /Cliente 1/ });
        await imprimirYEsperar();
        const v = impresion(container)!;
        expect(v).not.toBeNull();
        expect(within(v).getByRole("heading", { level: 1, name: "Cobranza programada — jueves 15/10/2026" })).toBeTruthy();
        expect(within(v).getByText("2 cobranzas")).toBeTruthy();
        const items = within(v).getAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(within(items[0]).getByText("14 a 16 h")).toBeTruthy();
        expect(within(items[0]).getByText("02921")).toBeTruthy();
        expect(within(items[0]).getByText("Cliente 1")).toBeTruthy();
        expect(within(items[0]).getByText("Rivera 1000, Montevideo")).toBeTruthy();
        expect(within(items[0]).getByText("$ 45.000,00")).toBeTruthy();
        expect(within(items[1]).getByText("Sin horario")).toBeTruthy();
        expect(within(items[1]).getByText(/US\$|USD/)).toBeTruthy();
      });

      it("sin dirección lo dice; no incluye origen ni quién editó", async () => {
        obtener.mockResolvedValue(
          respuesta([
            cobranza(1, { direccion: { texto: "Calle 5", origen: "plataforma", editada_por: "rlopez@pontyn.com.uy", editada_utc: "2026-10-14T12:00:00Z" } }),
            cobranza(2, { direccion: { texto: null, origen: "sap", editada_por: null, editada_utc: null } }),
          ])
        );
        const { container } = montar();
        await screen.findByRole("article", { name: /Cliente 1/ });
        await imprimirYEsperar();
        const v = impresion(container)!;
        expect(within(v).getByText("Sin dirección")).toBeTruthy();
        expect(v.textContent).not.toMatch(/Dirección de SAP|Editada|Ver ficha|Anular/);
      });

      it("no hay vista de impresión de un día vacío", async () => {
        obtener.mockResolvedValue(respuesta([]));
        const { container } = montar();
        await screen.findByText(/No hay cobranzas programadas/);
        expect(impresion(container)).toBeNull();
      });

      it("la pantalla se marca como imprimible solo durante la impresión", async () => {
        const { container } = montar();
        await screen.findByRole("article", { name: /Cliente 1/ });
        await imprimirYEsperar();
        expect(container.querySelector(".cobranza[data-imprimible]")).not.toBeNull();
      });

      it("sin clic en Imprimir (Ctrl+P) no existe la hoja ni la marca: sale la pantalla común y no hay POST", async () => {
        const { container } = montar();
        await screen.findByRole("article", { name: /Cliente 1/ });
        expect(impresion(container)).toBeNull();
        expect(container.querySelector("[data-imprimible]")).toBeNull();
        expect(registrarImpresion).not.toHaveBeenCalled();
      });

      it("si el registro falla, la hoja no se monta", async () => {
        registrarImpresion.mockRejectedValue(new ApiError(500, { error: "Error interno" }));
        const { container } = montar();
        await screen.findByRole("article", { name: /Cliente 1/ });
        fireEvent.click(boton("Imprimir / PDF"));
        await screen.findByRole("alert");
        expect(impresion(container)).toBeNull();
        expect(container.querySelector("[data-imprimible]")).toBeNull();
      });

      it("después de afterprint (también si cancela) la hoja desaparece", async () => {
        const { container } = montar();
        await screen.findByRole("article", { name: /Cliente 1/ });
        await imprimirYEsperar();
        expect(impresion(container)).not.toBeNull();
        fireEvent(window, new Event("afterprint"));
        await waitFor(() => expect(impresion(container)).toBeNull());
        expect(container.querySelector("[data-imprimible]")).toBeNull();
      });

      it("imprimir de nuevo después de afterprint vuelve a registrar y a imprimir", async () => {
        montar();
        await screen.findByRole("article", { name: /Cliente 1/ });
        await imprimirYEsperar();
        fireEvent(window, new Event("afterprint"));
        fireEvent.click(boton("Imprimir / PDF"));
        await waitFor(() => expect(print).toHaveBeenCalledTimes(2));
        expect(registrarImpresion).toHaveBeenCalledTimes(2);
      });
    });

    it("mientras se registra la impresión el botón queda deshabilitado y un segundo clic no repite el POST", async () => {
      let resolver!: (v: unknown) => void;
      registrarImpresion.mockReturnValue(new Promise((r) => (resolver = r)));
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Imprimir / PDF"));
      const enCurso = await screen.findByRole("button", { name: /Preparando/ });
      expect((enCurso as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(enCurso);
      expect(registrarImpresion).toHaveBeenCalledTimes(1);
      expect(boton("Día siguiente").disabled).toBe(false);
      resolver({});
      await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    });

    it("un 5xx con body.error del backend muestra el mensaje propio, no el interno", async () => {
      registrarImpresion.mockRejectedValue(new ApiError(500, { error: "Error interno" }));
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Imprimir / PDF"));
      const alerta = await screen.findByRole("alert");
      expect(alerta.textContent).toMatch(/No se pudo imprimir/);
      expect(alerta.textContent).not.toMatch(/Error interno/);
    });

    it("datos personales: nada en localStorage ni en la consola", async () => {
      const log = vi.spyOn(console, "log");
      const err = vi.spyOn(console, "error");
      const warn = vi.spyOn(console, "warn");
      montar();
      await screen.findByRole("article", { name: /Cliente 1/ });
      fireEvent.click(boton("Descargar planilla"));
      await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
      fireEvent.click(boton("Imprimir / PDF"));
      await waitFor(() => expect(print).toHaveBeenCalled());
      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
      expect(log).not.toHaveBeenCalled();
      expect(err).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
