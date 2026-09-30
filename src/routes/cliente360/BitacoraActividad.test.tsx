import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BitacoraResponse, EventoBitacora, PaginaEventosBitacora } from "../../api/types";
import { BitacoraActividad } from "./BitacoraActividad";
import { claveFiltroGuardado } from "./bitacora";

const obtenerBitacora = vi.fn();
const obtenerEventos = vi.fn();
vi.mock("./useApiBitacora", () => ({
  useApiBitacora: () => ({
    fuentes: { obtenerBitacora, obtenerEventos },
    api: { registrarGestion: vi.fn(), crearRecordatorio: vi.fn(), completarTarea: vi.fn() },
  }),
}));

const USUARIO = "rlopez@pontyn.com.uy";

function local(dia: number, hora: number, minuto = 0): string {
  return new Date(2026, 8, dia, hora, minuto).toISOString();
}

function manual(id: number, parcial: Partial<EventoBitacora> = {}): EventoBitacora {
  return {
    id,
    tipo: "manual",
    canal: "Llamada",
    resultado: "Pago coordinado",
    nota: "Paga el viernes por transferencia",
    origen: USUARIO,
    fecha_utc: local(22, 10),
    referencia: null,
    card_code: "C1-17453",
    ...parcial,
  };
}

function autorizado(n: number, fecha: string, origen = USUARIO): EventoBitacora {
  return {
    id: null,
    tipo: "automatico",
    canal: null,
    resultado: "Pedido autorizado",
    nota: `Motivo: Cliente al día ${n}`,
    origen,
    fecha_utc: fecha,
    referencia: `decision:${n}`,
    card_code: "C1-17453",
  };
}

function bitacora(parcial: Partial<BitacoraResponse> = {}): BitacoraResponse {
  return {
    cliente: { numero_sn: "17454" },
    motivos: ["Pago coordinado"],
    canales: ["Llamada"],
    equipo: [{ upn: USUARIO, nombre: "Rosina López" }],
    tareas: [],
    eventos: [],
    hay_mas: false,
    siguiente: null,
    resumen: { ultima_gestion: null, tareas_pendientes: 0, tareas_vencidas: 0 },
    ...parcial,
  };
}

function montar() {
  return render(<BitacoraActividad cardCode="C1-17453" enPiloto={false} usuarioActual={USUARIO} />);
}

describe("BitacoraActividad — Bitácora v2", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 25, 12));
    obtenerBitacora.mockReset();
    obtenerEventos.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // Pedido de Claudia y Rosina (30/09/2026): el campo se llama "Resultado",
  // no "Motivo". El "Motivo:" que aparece en la nota de un evento automatico
  // es otra cosa (el motivo de autorizacion que escribe la Bandeja).
  it("el campo de la gestión se llama Resultado, no Motivo", async () => {
    obtenerBitacora.mockResolvedValue(bitacora());
    montar();

    expect(await screen.findByLabelText("Resultado")).toBeTruthy();
    expect(screen.queryByLabelText("Motivo")).toBeNull();
    expect(screen.getByRole("option", { name: "Elegí un resultado…" })).toBeTruthy();
  });

  it("muestra el resumen con la última gestión y los recordatorios vencidos", async () => {
    const g = manual(40);
    obtenerBitacora.mockResolvedValue(
      bitacora({ eventos: [g], resumen: { ultima_gestion: g, tareas_pendientes: 2, tareas_vencidas: 1 } })
    );
    montar();

    const resumen = await screen.findByRole("group", { name: "Resumen de actividad" });
    expect(resumen.textContent).toContain("Última gestión: hace 3 días — Pago coordinado (Rosina López)");
    expect(resumen.textContent).toContain("2 recordatorios pendientes (1 vencido)");
    // Cargada: se ofrece como enlace al historial.
    expect(within(resumen).getByRole("button", { name: /hace 3 días/ })).toBeTruthy();
  });

  it("sin gestiones lo dice, y si la última no está cargada no es un enlace", async () => {
    obtenerBitacora.mockResolvedValueOnce(bitacora());
    const { unmount } = montar();
    expect((await screen.findByRole("group", { name: "Resumen de actividad" })).textContent).toBe(
      "Todavía no hay gestiones registradas"
    );
    unmount();

    obtenerBitacora.mockResolvedValueOnce(
      bitacora({ resumen: { ultima_gestion: manual(1), tareas_pendientes: 0, tareas_vencidas: 0 } })
    );
    montar();
    const resumen = await screen.findByRole("group", { name: "Resumen de actividad" });
    expect(resumen.textContent).toContain("hace 3 días");
    expect(within(resumen).queryByRole("button")).toBeNull();
  });

  it("junta los automáticos del mismo día en una fila y se despliega con el detalle", async () => {
    obtenerBitacora.mockResolvedValue(
      bitacora({
        eventos: [autorizado(1, local(25, 21, 50)), autorizado(2, local(25, 18)), autorizado(3, local(25, 14, 49)), manual(9)],
      })
    );
    montar();

    const fila = await screen.findByRole("button", { name: /3 pedidos autorizados/ });
    expect(fila.textContent).toContain("Rosina López");
    expect(fila.textContent).toContain("14:49–21:50");
    expect(fila.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Motivo: Cliente al día 2")).toBeNull();

    fireEvent.click(fila);
    expect(fila.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Motivo: Cliente al día 2")).toBeTruthy();
    // La gestión sigue con su nota completa.
    expect(screen.getByText("Paga el viernes por transferencia")).toBeTruthy();
  });

  it("cambiar de filtro pide la primera página de ese filtro y lo recuerda", async () => {
    obtenerBitacora.mockResolvedValue(bitacora({ eventos: [manual(1)] }));
    obtenerEventos.mockResolvedValue({ eventos: [], hay_mas: false, siguiente: null } satisfies PaginaEventosBitacora);
    montar();
    await screen.findByText("Paga el viernes por transferencia");
    expect(obtenerBitacora).toHaveBeenCalledWith("C1-17453", "todo");

    fireEvent.click(screen.getByRole("button", { name: "Autorizaciones" }));

    await screen.findByText("No hay pedidos autorizados ni rechazados desde la Bandeja para este cliente.");
    expect(obtenerEventos).toHaveBeenCalledWith("C1-17453", { tipo: "autorizaciones" });
    expect(screen.getByRole("button", { name: "Autorizaciones" }).getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(claveFiltroGuardado(USUARIO))).toBe("autorizaciones");
  });

  it("arranca con el filtro guardado; si localStorage falla, con Todo", async () => {
    localStorage.setItem(claveFiltroGuardado(USUARIO), "situacion");
    obtenerBitacora.mockResolvedValue(bitacora());
    const { unmount } = montar();
    await waitFor(() => expect(obtenerBitacora).toHaveBeenCalledWith("C1-17453", "situacion"));
    unmount();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    montar();
    await waitFor(() => expect(obtenerBitacora).toHaveBeenLastCalledWith("C1-17453", "todo"));
    expect(screen.getByRole("button", { name: "Todo" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("si el usuario llega después (null al montar), aplica su filtro guardado", async () => {
    localStorage.setItem(claveFiltroGuardado(USUARIO), "gestiones");
    obtenerBitacora.mockResolvedValue(bitacora());
    obtenerEventos.mockResolvedValue({ eventos: [], hay_mas: false, siguiente: null });
    const { rerender } = render(<BitacoraActividad cardCode="C1-17453" enPiloto={false} usuarioActual={null} />);
    await waitFor(() => expect(obtenerBitacora).toHaveBeenCalledWith("C1-17453", "todo"));

    rerender(<BitacoraActividad cardCode="C1-17453" enPiloto={false} usuarioActual={USUARIO} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Gestiones" }).getAttribute("aria-pressed")).toBe("true")
    );
  });

  it("si la persona ya eligió un filtro antes de conocerse el usuario, no se pisa", async () => {
    localStorage.setItem(claveFiltroGuardado(USUARIO), "gestiones");
    obtenerBitacora.mockResolvedValue(bitacora());
    obtenerEventos.mockResolvedValue({ eventos: [], hay_mas: false, siguiente: null });
    const { rerender } = render(<BitacoraActividad cardCode="C1-17453" enPiloto={false} usuarioActual={null} />);
    fireEvent.click(await screen.findByRole("button", { name: "Situación" }));

    rerender(<BitacoraActividad cardCode="C1-17453" enPiloto={false} usuarioActual={USUARIO} />);

    expect(screen.getByRole("button", { name: "Situación" }).getAttribute("aria-pressed")).toBe("true");
    expect(localStorage.getItem(claveFiltroGuardado(USUARIO))).toBe("gestiones");
  });

  it("'Ver anteriores' agrega la página siguiente al final", async () => {
    obtenerBitacora.mockResolvedValue(bitacora({ eventos: [manual(2)], hay_mas: true, siguiente: "S1" }));
    obtenerEventos.mockResolvedValue({
      eventos: [manual(1, { resultado: "Llamar", nota: "Nota vieja", fecha_utc: local(10, 9) })],
      hay_mas: false,
      siguiente: null,
    });
    montar();

    fireEvent.click(await screen.findByRole("button", { name: "Ver anteriores" }));

    await screen.findByText("Nota vieja");
    expect(obtenerEventos).toHaveBeenCalledWith("C1-17453", { tipo: "todo", antesDe: "S1" });
    expect(screen.getByText("Paga el viernes por transferencia")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver anteriores" })).toBeNull();
  });
});
