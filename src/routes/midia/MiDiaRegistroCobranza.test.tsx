import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import type { ClienteDelDia, MiDiaResponse } from "../../api/types";
import type { FeatureNombre } from "../../features/features";
import { MiDiaPage } from "./MiDiaPage";

// Entrega 2: el registro rapido de Mi dia tambien pide la fecha acordada
// cuando el resultado es "Pago coordinado" y cobranza_programada esta
// habilitada. Sin el flag, la fila es la de siempre.

const featuresHabilitadas = new Set<FeatureNombre>();
const obtener = vi.fn();
const registrar = vi.fn();
const obtenerResultados = vi.fn();

vi.mock("../../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (nombre: FeatureNombre) => featuresHabilitadas.has(nombre),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: false,
  }),
}));
vi.mock("./useApiMiDia", () => ({
  useApiMiDia: () => ({
    obtener: () => obtener(),
    registro: {
      registrar: (...args: unknown[]) => registrar(...args),
      obtenerResultados: (...args: unknown[]) => obtenerResultados(...args),
    },
  }),
}));

function cliente(parcial: Partial<ClienteDelDia> = {}): ClienteDelDia {
  return {
    card_code: "C1-02928",
    nombre: "Dulces del Sur",
    numero_sn: "02928",
    clave: "02928",
    padre: null,
    cuentas: [{ card_code: "C1-02928", moneda: "UYU", saldo: 11360, tiene_vencido: false, saldo_en_otra_moneda: false }],
    tiene_vencido: false,
    canal: "manual",
    origen: "dia",
    gestionada_hoy: false,
    ...parcial,
  };
}

function respuesta(): MiDiaResponse {
  return {
    fecha: "2026-10-15",
    dia: "JUEVES",
    clientes_del_dia: {
      fecha: "2026-10-15",
      dia: "JUEVES",
      es_dia_habil: true,
      gestion_conocida: true,
      total: 2,
      gestionados_hoy: 0,
      pendientes: 2,
      zonas_no_reconocidas: [],
      clientes: [cliente(), cliente({ card_code: "C1-06527", numero_sn: "06527", clave: "06527", nombre: "Betabel Ejemplo" })],
    },
    tareas: [],
    promesas: [],
    alertas: { abiertas: 0, no_vistas: 0 },
    pedidos_bandeja: { pendientes: 0 },
    habilitadas: { promesas: false, alertas: false },
    errores: [],
  };
}

async function abrirRegistro(nombre = "Dulces del Sur") {
  render(
    <MemoryRouter>
      <MiDiaPage />
    </MemoryRouter>
  );
  fireEvent.click(await screen.findByRole("button", { name: `Registrar gestión de ${nombre}` }));
  const grupo = await screen.findByRole("group", { name: `Registrar gestión de ${nombre}` });
  await within(grupo).findByLabelText("Resultado");
  return grupo;
}

function elegir(grupo: HTMLElement, resultado: string) {
  fireEvent.change(within(grupo).getByLabelText("Resultado"), { target: { value: resultado } });
}

describe("Registro rápido de Mi día con 'Pago coordinado'", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
    featuresHabilitadas.clear();
    featuresHabilitadas.add("bitacora");
    obtener.mockReset().mockResolvedValue(respuesta());
    registrar.mockReset().mockResolvedValue({});
    obtenerResultados.mockReset().mockResolvedValue(["Pago coordinado", "Sin respuesta"]);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("sin cobranza_programada (como hoy)", () => {
    it("no pide fecha y el POST lleva solo resultado y nota", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      expect(within(grupo).queryByLabelText(/Fecha acordada/)).toBeNull();
      expect(within(grupo).queryByLabelText(/Horario/)).toBeNull();
      fireEvent.change(within(grupo).getByLabelText(/Nota/), { target: { value: "Paga el viernes" } });
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
      expect(registrar).toHaveBeenCalledWith("C1-02928", { resultado: "Pago coordinado", nota: "Paga el viernes" });
    });
  });

  describe("con cobranza_programada", () => {
    beforeEach(() => featuresHabilitadas.add("cobranza_programada"));

    it("con otro resultado no aparecen los campos", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Sin respuesta");
      expect(within(grupo).queryByLabelText(/Fecha acordada/)).toBeNull();
    });

    it("al elegir Pago coordinado aparecen fecha (con mínimo hoy), horario, importe y moneda", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      const fecha = within(grupo).getByLabelText("Fecha acordada") as HTMLInputElement;
      expect(fecha.type).toBe("date");
      expect(fecha.min).toBe("2026-10-15");
      expect(within(grupo).getByLabelText(/Horario/)).toBeTruthy();
      expect(within(grupo).getByLabelText(/Importe/)).toBeTruthy();
      expect(within(grupo).getByLabelText(/Moneda/)).toBeTruthy();
    });

    it("sin fecha no envía y el error queda junto al campo", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      const error = await within(grupo).findByText("Elegí la fecha acordada.");
      const campo = within(grupo).getByLabelText("Fecha acordada");
      expect(campo.getAttribute("aria-describedby")).toBe(error.id);
      expect(campo.getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(campo);
      expect(registrar).not.toHaveBeenCalled();
    });

    it("fecha anterior a hoy e importe inválido: errores junto a cada campo", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      fireEvent.change(within(grupo).getByLabelText("Fecha acordada"), { target: { value: "2026-10-14" } });
      fireEvent.change(within(grupo).getByLabelText(/Importe/), { target: { value: "abc" } });
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      expect(await within(grupo).findByText("La fecha no puede ser anterior a hoy.")).toBeTruthy();
      expect(within(grupo).getByText("El importe tiene que ser un número.")).toBeTruthy();
      expect(registrar).not.toHaveBeenCalled();
    });

    it("el POST suma fecha, horario, importe y moneda", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      fireEvent.change(within(grupo).getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
      fireEvent.change(within(grupo).getByLabelText(/Horario/), { target: { value: "14 a 16 h" } });
      fireEvent.change(within(grupo).getByLabelText(/Importe/), { target: { value: "45.000" } });
      fireEvent.change(within(grupo).getByLabelText(/Moneda/), { target: { value: "USD" } });
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
      expect(registrar).toHaveBeenCalledWith("C1-02928", {
        resultado: "Pago coordinado",
        fecha_cobranza: "2026-10-20",
        horario: "14 a 16 h",
        importe: 45000,
        moneda: "USD",
      });
    });

    it("solo con fecha, el POST no lleva horario, importe ni moneda", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      fireEvent.change(within(grupo).getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
      expect(registrar).toHaveBeenCalledWith("C1-02928", { resultado: "Pago coordinado", fecha_cobranza: "2026-10-20" });
    });

    it("si se cambia a otro resultado, lo cargado no viaja", async () => {
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      fireEvent.change(within(grupo).getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
      elegir(grupo, "Sin respuesta");
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect(registrar).toHaveBeenCalledTimes(1));
      expect(registrar).toHaveBeenCalledWith("C1-02928", { resultado: "Sin respuesta" });
    });

    it("mientras guarda, los campos nuevos quedan deshabilitados", async () => {
      registrar.mockReturnValue(new Promise(() => {}));
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      fireEvent.change(within(grupo).getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      await waitFor(() => expect((within(grupo).getByLabelText("Fecha acordada") as HTMLInputElement).disabled).toBe(true));
      for (const l of [/Horario/, /Importe/, /Moneda/]) {
        expect((within(grupo).getByLabelText(l) as HTMLInputElement).disabled).toBe(true);
      }
    });

    it("un 400 del backend se muestra en el formulario y conserva lo escrito", async () => {
      registrar.mockRejectedValue(new ApiError(400, { error: "La fecha de cobranza no es válida." }));
      const grupo = await abrirRegistro();
      elegir(grupo, "Pago coordinado");
      fireEvent.change(within(grupo).getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
      fireEvent.click(within(grupo).getByRole("button", { name: "Guardar" }));
      expect(await within(grupo).findByText("La fecha de cobranza no es válida.")).toBeTruthy();
      expect((within(grupo).getByLabelText("Fecha acordada") as HTMLInputElement).value).toBe("2026-10-20");
    });
  });
});
