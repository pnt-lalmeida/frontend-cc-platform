import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BitacoraResponse, PromesaPago, PromesasResponse } from "../../api/types";
import { BitacoraActividad } from "./BitacoraActividad";

const obtenerBitacora = vi.fn();
const obtenerEventos = vi.fn();
const obtenerPromesas = vi.fn();
const registrarPromesa = vi.fn();
const flags = new Set<string>();

vi.mock("./useApiBitacora", () => ({
  useApiBitacora: () => ({
    fuentes: { obtenerBitacora, obtenerEventos },
    api: { registrarGestion: vi.fn(), crearRecordatorio: vi.fn(), completarTarea: vi.fn() },
  }),
}));
vi.mock("./useApiPromesas", () => {
  const api = {
    obtener: (...args: unknown[]) => obtenerPromesas(...args),
    registrar: (...args: unknown[]) => registrarPromesa(...args),
  };
  return { useApiPromesas: () => api };
});
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
    motivos: ["Pago coordinado"],
    canales: ["Llamada", "WhatsApp"],
    equipo: [{ upn: USUARIO, nombre: "Rosina López" }],
    tareas: [],
    eventos: [],
    hay_mas: false,
    siguiente: null,
    resumen: { ultima_gestion: null, tareas_pendientes: 0, tareas_vencidas: 0 },
  };
}

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
    registrada_por: USUARIO,
    registrada_utc: "2026-09-29T14:00:00Z",
    estado: "vigente",
    estado_utc: null,
    importe_verificado: null,
    ...parcial,
  };
}

const RESPUESTA: PromesasResponse = { promesas: [], monedas: ["UYU", "USD", "EUR"] };

function montar() {
  return render(<BitacoraActividad cardCode="C1-17453" enPiloto={false} usuarioActual={USUARIO} />);
}

async function abrirPestañaPromesa() {
  const boton = await screen.findByRole("button", { name: "Promesa" });
  fireEvent.click(boton);
  return boton;
}

function escribir(etiqueta: RegExp | string, valor: string) {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

describe("Promesas de pago en la pestaña Actividad", () => {
  beforeEach(() => {
    // 29/09/2026 12:00 en Montevideo.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-29T15:00:00Z"));
    flags.clear();
    obtenerBitacora.mockReset().mockResolvedValue(bitacora());
    obtenerEventos.mockReset();
    obtenerPromesas.mockReset().mockResolvedValue(RESPUESTA);
    registrarPromesa.mockReset().mockResolvedValue(promesa());
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("sin la funcionalidad habilitada no se ve nada y no se hace ningún fetch", async () => {
    montar();
    await screen.findByRole("button", { name: "Gestión" });
    expect(screen.queryByRole("button", { name: "Promesa" })).toBeNull();
    expect(screen.queryByText("Promesas de pago")).toBeNull();
    expect(obtenerPromesas).not.toHaveBeenCalled();
  });

  describe("habilitada", () => {
    beforeEach(() => flags.add("promesas"));

    it("muestra el bloque de vigentes arriba y trae las promesas del cliente", async () => {
      obtenerPromesas.mockResolvedValue({ ...RESPUESTA, promesas: [promesa()] });
      montar();
      expect(await screen.findByText("Vence en 3 días")).toBeTruthy();
      expect(obtenerPromesas).toHaveBeenCalledWith("C1-17453");
      const bloque = screen.getByRole("heading", { name: "Promesas de pago" });
      const titulo = screen.getByRole("heading", { name: "Bitácora de gestión" });
      // Arriba de la Bitácora.
      expect(bloque.compareDocumentPosition(titulo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("agrega la tercera pestaña Promesa junto a Gestión y Recordatorio", async () => {
      montar();
      const grupo = await screen.findByRole("group", { name: "Qué registrar" });
      expect(within(grupo).getAllByRole("button").map((b) => b.textContent)).toEqual(["Gestión", "Recordatorio", "Promesa"]);
    });

    it("el formulario ofrece las monedas del GET y los canales de la Bitácora", async () => {
      montar();
      await abrirPestañaPromesa();
      await waitFor(() => expect((screen.getByLabelText("Moneda") as HTMLSelectElement).options.length).toBe(3));
      const monedas = Array.from((screen.getByLabelText("Moneda") as HTMLSelectElement).options).map((o) => o.value);
      expect(monedas).toEqual(["UYU", "USD", "EUR"]);
      const canales = within(screen.getByRole("radiogroup", { name: /Canal/, hidden: false }))
        .getAllByRole("radio")
        .map((c) => c.textContent);
      expect(canales).toEqual(["Llamada", "WhatsApp"]);
    });

    it("no deja elegir fechas pasadas (min = hoy en Uruguay)", async () => {
      montar();
      await abrirPestañaPromesa();
      expect((screen.getByLabelText("Fecha prometida") as HTMLInputElement).min).toBe("2026-09-29");
    });

    it("enviar vacío muestra los errores junto a cada campo y no llama a la API", async () => {
      montar();
      await abrirPestañaPromesa();
      await waitFor(() => expect((screen.getByLabelText("Moneda") as HTMLSelectElement).options.length).toBe(3));
      fireEvent.click(screen.getByRole("button", { name: "Registrar promesa" }));

      expect(screen.getByText("Elegí la fecha en que va a pagar.")).toBeTruthy();
      expect(screen.getByText("Escribí el importe prometido.")).toBeTruthy();
      expect(screen.getByLabelText("Importe").getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByLabelText("Importe").getAttribute("aria-describedby")).toBe("promesa-importe-error");
      expect(registrarPromesa).not.toHaveBeenCalled();
    });

    it("registra la promesa, confirma con 'Promesa registrada.', limpia el formulario y actualiza el bloque y la bitácora", async () => {
      obtenerPromesas
        .mockResolvedValueOnce(RESPUESTA)
        .mockResolvedValueOnce({ ...RESPUESTA, promesas: [promesa({ importe: 45000.5 })] });
      montar();
      await abrirPestañaPromesa();
      await waitFor(() => expect((screen.getByLabelText("Moneda") as HTMLSelectElement).options.length).toBe(3));

      escribir("Fecha prometida", "2026-10-02");
      escribir("Importe", "45.000,50");
      fireEvent.click(screen.getByRole("radio", { name: "WhatsApp" }));
      escribir(/Facturas/, "A-1234");
      fireEvent.click(screen.getByRole("button", { name: "Registrar promesa" }));

      await waitFor(() => expect(screen.getByText("Promesa registrada.")).toBeTruthy());
      expect(registrarPromesa).toHaveBeenCalledWith("C1-17453", {
        fecha_prometida: "2026-10-02",
        importe: 45000.5,
        moneda: "UYU",
        canal: "WhatsApp",
        facturas: "A-1234",
      });
      expect((screen.getByLabelText("Importe") as HTMLInputElement).value).toBe("");
      expect(await screen.findByText("Vence en 3 días")).toBeTruthy();
      // La bitácora se recarga: el backend puede haber escrito un evento.
      await waitFor(() => expect(obtenerBitacora.mock.calls.length).toBeGreaterThanOrEqual(2));
    });

    it("mientras registra, el botón queda deshabilitado (no se dispara dos veces) y lo demás sigue usable", async () => {
      let terminar: (p: PromesaPago) => void = () => {};
      registrarPromesa.mockReturnValue(new Promise<PromesaPago>((r) => (terminar = r)));
      montar();
      await abrirPestañaPromesa();
      await waitFor(() => expect((screen.getByLabelText("Moneda") as HTMLSelectElement).options.length).toBe(3));
      escribir("Fecha prometida", "2026-10-02");
      escribir("Importe", "1000");
      fireEvent.click(screen.getByRole("button", { name: "Registrar promesa" }));

      const enviando = await screen.findByRole("button", { name: "Registrando…" });
      expect((enviando as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(enviando);
      expect(registrarPromesa).toHaveBeenCalledTimes(1);
      // El resto de la pantalla no se bloquea.
      expect((screen.getByRole("button", { name: "Gestión" }) as HTMLButtonElement).disabled).toBe(false);

      terminar(promesa());
      await waitFor(() => expect(screen.getByText("Promesa registrada.")).toBeTruthy());
    });

    it("si la API rechaza, muestra el motivo junto al botón y conserva lo escrito", async () => {
      const { ApiError } = await import("../../api/client");
      registrarPromesa.mockRejectedValue(new ApiError(400, { error: "El importe prometido no es válido." }));
      montar();
      await abrirPestañaPromesa();
      await waitFor(() => expect((screen.getByLabelText("Moneda") as HTMLSelectElement).options.length).toBe(3));
      escribir("Fecha prometida", "2026-10-02");
      escribir("Importe", "1000");
      fireEvent.click(screen.getByRole("button", { name: "Registrar promesa" }));

      expect((await screen.findByRole("alert")).textContent).toBe("El importe prometido no es válido.");
      expect((screen.getByLabelText("Importe") as HTMLInputElement).value).toBe("1000");
      expect((screen.getByRole("button", { name: "Registrar promesa" }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("cambiar de pestaña no pierde lo escrito", async () => {
      montar();
      await abrirPestañaPromesa();
      escribir("Importe", "777");
      fireEvent.click(screen.getByRole("button", { name: "Recordatorio" }));
      fireEvent.click(screen.getByRole("button", { name: "Promesa" }));
      expect((screen.getByLabelText("Importe") as HTMLInputElement).value).toBe("777");
    });

    it("el ajuste de tamaños en celular viaja con el flag: data-promesas solo con la funcionalidad", async () => {
      const { container, unmount } = montar();
      await screen.findByRole("button", { name: "Gestión" });
      expect(container.querySelector(".bitacora-registrar")?.getAttribute("data-promesas")).toBe("true");
      unmount();
      flags.delete("promesas");
      const sin = montar();
      await screen.findByRole("button", { name: "Gestión" });
      expect(sin.container.querySelector(".bitacora-registrar")?.hasAttribute("data-promesas")).toBe(false);
    });

    it("el grupo de pestañas puede pasar a otra línea (no desborda con zoom o tipografía grande)", async () => {
      montar();
      const grupo = await screen.findByRole("group", { name: "Qué registrar" });
      expect(grupo.style.flexWrap).toBe("wrap");
    });

    it("Promesa y Recordatorio ofrecen la misma fecha mínima: la de Montevideo, aun pasadas las 21 h", async () => {
      // 22:30 del 29/09 en Uruguay = 01:30Z del 30/09.
      vi.setSystemTime(new Date("2026-09-30T01:30:00Z"));
      montar();
      await abrirPestañaPromesa();
      expect((screen.getByLabelText("Fecha prometida") as HTMLInputElement).min).toBe("2026-09-29");
      expect((screen.getByLabelText("Para cuándo") as HTMLInputElement).min).toBe("2026-09-29");
    });

    it("si no se pudieron traer las monedas, lo dice junto al campo y deja reintentar", async () => {
      obtenerPromesas.mockRejectedValueOnce(new Error("500")).mockResolvedValue(RESPUESTA);
      montar();
      await abrirPestañaPromesa();
      const aviso = await screen.findByText("No se pudieron cargar las monedas.");
      expect(aviso.getAttribute("role")).toBe("alert");
      expect((screen.getByLabelText("Moneda") as HTMLSelectElement).disabled).toBe(true);
      fireEvent.click(within(aviso.parentElement as HTMLElement).getByRole("button", { name: "Reintentar" }));
      await waitFor(() => expect((screen.getByLabelText("Moneda") as HTMLSelectElement).disabled).toBe(false));
    });
  });
});
