import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BitacoraResponse } from "../../api/types";
import { BitacoraActividad } from "./BitacoraActividad";

// Entrega 2 (15/10/2026): "Pago coordinado" con fecha, detras de
// cobranza_programada. Primero: caracterizacion de lo que hace hoy el
// formulario Gestion con ese resultado (sin la funcionalidad).

const obtenerBitacora = vi.fn();
const obtenerEventos = vi.fn();
const registrarGestion = vi.fn();
const flags = new Set<string>();

vi.mock("./useApiBitacora", () => ({
  useApiBitacora: () => ({
    fuentes: { obtenerBitacora, obtenerEventos },
    api: {
      registrarGestion: (...args: unknown[]) => registrarGestion(...args),
      crearRecordatorio: vi.fn(),
      completarTarea: vi.fn(),
    },
  }),
}));
vi.mock("../../features/FeaturesContext", () => ({
  useFeatures: () => ({
    habilitada: (nombre: string) => flags.has(nombre),
    enPiloto: () => false,
    esSupervisor: false,
    cargando: false,
  }),
}));

const USUARIO = "rlopez@pontyn.com.uy";

function bitacora(): BitacoraResponse {
  return {
    cliente: { numero_sn: "17454" },
    motivos: ["Pago coordinado", "Sin respuesta"],
    canales: ["Llamada", "WhatsApp"],
    equipo: [{ upn: USUARIO, nombre: "Rosina López" }],
    tareas: [],
    eventos: [],
    hay_mas: false,
    siguiente: null,
    resumen: { ultima_gestion: null, tareas_pendientes: 0, tareas_vencidas: 0 },
  };
}

async function montar() {
  render(<BitacoraActividad cardCode="C1-17453" enPiloto={false} usuarioActual={USUARIO} />);
  await screen.findByRole("button", { name: "Registrar gestión" });
}

function elegirResultado(valor: string) {
  fireEvent.change(screen.getByLabelText("Resultado"), { target: { value: valor } });
}

describe("Gestión con 'Pago coordinado' sin cobranza_programada (como hoy)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
    flags.clear();
    obtenerBitacora.mockReset().mockResolvedValue(bitacora());
    obtenerEventos.mockReset();
    registrarGestion.mockReset().mockResolvedValue({});
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("no muestra fecha, horario, importe ni moneda", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    expect(screen.queryByLabelText(/Fecha acordada/)).toBeNull();
    expect(screen.queryByLabelText(/Horario/)).toBeNull();
    expect(screen.queryByLabelText(/Importe/)).toBeNull();
    expect(screen.queryByLabelText(/Moneda/)).toBeNull();
  });

  it("el POST lleva exactamente resultado, canal y nota", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.click(screen.getByRole("radio", { name: "Llamada" }));
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: "Paga el viernes" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    await waitFor(() => expect(registrarGestion).toHaveBeenCalledTimes(1));
    expect(registrarGestion).toHaveBeenCalledWith("C1-17453", {
      resultado: "Pago coordinado",
      canal: "Llamada",
      nota: "Paga el viernes",
    });
  });

  it("con solo el resultado, el POST lleva solo el resultado", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    await waitFor(() => expect(registrarGestion).toHaveBeenCalledTimes(1));
    expect(registrarGestion).toHaveBeenCalledWith("C1-17453", { resultado: "Pago coordinado" });
  });
});

describe("Gestión con 'Pago coordinado' y cobranza_programada", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T15:00:00Z"));
    flags.clear();
    flags.add("cobranza_programada");
    obtenerBitacora.mockReset().mockResolvedValue(bitacora());
    obtenerEventos.mockReset();
    registrarGestion.mockReset().mockResolvedValue({});
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("con otro resultado no aparecen los campos", async () => {
    await montar();
    expect(screen.queryByLabelText(/Fecha acordada/)).toBeNull();
    elegirResultado("Sin respuesta");
    expect(screen.queryByLabelText(/Fecha acordada/)).toBeNull();
  });

  it("al elegir Pago coordinado aparecen fecha, horario, importe y moneda", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    const fecha = screen.getByLabelText("Fecha acordada") as HTMLInputElement;
    expect(fecha.type).toBe("date");
    expect(fecha.min).toBe("2026-10-15");
    expect(screen.getByLabelText(/Horario/)).toBeTruthy();
    expect(screen.getByLabelText(/Importe/)).toBeTruthy();
    expect(screen.getByLabelText(/Moneda/)).toBeTruthy();
  });

  it("sin fecha no envía y el error queda junto al campo", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    const error = await screen.findByText("Elegí la fecha acordada.");
    expect(error.id).toBe("gestion-fecha-error");
    expect(screen.getByLabelText("Fecha acordada").getAttribute("aria-describedby")).toBe("gestion-fecha-error");
    expect(registrarGestion).not.toHaveBeenCalled();
  });

  it("fecha anterior a hoy: error y no envía", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.change(screen.getByLabelText("Fecha acordada"), { target: { value: "2026-10-14" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    expect(await screen.findByText("La fecha no puede ser anterior a hoy.")).toBeTruthy();
    expect(registrarGestion).not.toHaveBeenCalled();
  });

  it("importe sin sentido: error junto al campo", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.change(screen.getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText(/Importe/), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    expect(await screen.findByText("El importe tiene que ser un número.")).toBeTruthy();
    expect(registrarGestion).not.toHaveBeenCalled();
  });

  it("el POST suma la fecha y no manda horario, importe ni moneda vacíos", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.change(screen.getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    await waitFor(() => expect(registrarGestion).toHaveBeenCalledTimes(1));
    expect(registrarGestion).toHaveBeenCalledWith("C1-17453", { resultado: "Pago coordinado", fecha_cobranza: "2026-10-20" });
  });

  it("el POST completo lleva fecha, horario, importe y moneda", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.change(screen.getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText(/Horario/), { target: { value: "14 a 16 h" } });
    fireEvent.change(screen.getByLabelText(/Importe/), { target: { value: "45.000" } });
    fireEvent.change(screen.getByLabelText(/Moneda/), { target: { value: "USD" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    await waitFor(() => expect(registrarGestion).toHaveBeenCalledTimes(1));
    expect(registrarGestion).toHaveBeenCalledWith("C1-17453", {
      resultado: "Pago coordinado",
      fecha_cobranza: "2026-10-20",
      horario: "14 a 16 h",
      importe: 45000,
      moneda: "USD",
    });
  });

  it("si se cambia a otro resultado, lo cargado no viaja", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.change(screen.getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText(/Horario/), { target: { value: "14 a 16 h" } });
    elegirResultado("Sin respuesta");
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    await waitFor(() => expect(registrarGestion).toHaveBeenCalledTimes(1));
    expect(registrarGestion).toHaveBeenCalledWith("C1-17453", { resultado: "Sin respuesta" });
  });

  it("un error del backend (400) se muestra y los campos conservan lo escrito", async () => {
    const { ApiError } = await import("../../api/client");
    registrarGestion.mockRejectedValue(new ApiError(400, { error: "La fecha de cobranza no es válida." }));
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.change(screen.getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    expect(await screen.findByText("La fecha de cobranza no es válida.")).toBeTruthy();
    expect((screen.getByLabelText("Fecha acordada") as HTMLInputElement).value).toBe("2026-10-20");
  });

  it("tras registrar, el formulario se limpia", async () => {
    await montar();
    elegirResultado("Pago coordinado");
    fireEvent.change(screen.getByLabelText("Fecha acordada"), { target: { value: "2026-10-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Registrar gestión" }));
    await waitFor(() => expect(screen.queryByLabelText("Fecha acordada")).toBeNull());
    expect((screen.getByLabelText("Resultado") as HTMLSelectElement).value).toBe("");
  });
});
