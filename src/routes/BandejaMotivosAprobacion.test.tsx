import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CandidatoBandeja } from "../api/types";
import { apiFetch } from "../api/client";
import { BandejaPage } from "./BandejaPage";

vi.mock("../api/client", () => ({ apiFetch: vi.fn() }));
vi.mock("../auth/useAccessToken", () => ({ useAccessToken: () => async () => "token" }));
vi.mock("../features/FeaturesContext", () => ({
  useFeatures: () => ({ habilitada: () => false, enPiloto: () => false, esSupervisor: false, cargando: false }),
}));

let candidatos: CandidatoBandeja[] = [];
vi.mock("./bandeja/useCandidatos", () => ({
  useCandidatos: () => ({ candidatos, loading: false, error: null, recargar: () => {} }),
}));

function cand(n: number): CandidatoBandeja {
  return {
    doc_entry: n, doc_num: 100 + n, doc_date: "2026-09-25", hora_pedido: null, card_code: `C1-${n}`,
    card_name: `Cliente ${n}`, nro_referencia_externa: null, moneda: "UYU", importe: 1000, vendedor: "V",
    cliente_suspendido: false, status_aprobacion: "Pendiente", condicion_pago: null, comentarios: null,
  };
}

const MOTIVOS_ACTUALES = ["Emitir", "Estado de cuenta", "Estado de cuenta/carta", "Etiqueta"];
const MOTIVOS_NUEVOS = ["Etiqueta/Carta", "Etiqueta/Estado de cuenta"];
const pdf = () => new File(["contenido"], "carta.pdf", { type: "application/pdf" });

function renderBandeja() {
  return render(
    <MemoryRouter>
      <BandejaPage />
    </MemoryRouter>
  );
}
const inputArchivo = (c: HTMLElement) => c.querySelector('input[type="file"]');
function abrirIndividual(c: HTMLElement) {
  fireEvent.click(c.querySelector('[data-doc-entry="1"]')!);
}
function abrirMultiple() {
  fireEvent.click(screen.getByLabelText("Seleccionar pedido 101"));
}
function radios(name: string) {
  return [...document.querySelectorAll(`input[type="radio"][name="${name}"]`)] as HTMLInputElement[];
}
function elegir(name: string, motivo: string) {
  fireEvent.click(radios(name).find((r) => r.value === motivo)!);
}
function bodyDelUltimoPost() {
  const llamadas = vi.mocked(apiFetch).mock.calls;
  return (llamadas[llamadas.length - 1][1] as { body: Record<string, unknown> }).body;
}

beforeEach(() => {
  candidatos = [cand(1), cand(2)];
  vi.mocked(apiFetch).mockReset();
  vi.mocked(apiFetch).mockResolvedValue({
    doc_entry: 1, decision: "approved", sap_status: "no_ejecutado", activity_code: null, timestamp: "x",
    adjunto_blob_path: null, resultados: [],
  } as never);
});

describe("Bandeja - motivos de aprobacion ACTUALES (caracterizacion)", () => {
  it("individual: el input de archivo aparece solo con 'Estado de cuenta/carta'", () => {
    const { container } = renderBandeja();
    abrirIndividual(container);
    expect(inputArchivo(container)).toBeNull();
    for (const m of MOTIVOS_ACTUALES) {
      elegir("opcion-aprobar", m);
      expect(!!inputArchivo(container), m).toBe(m === "Estado de cuenta/carta");
    }
  });

  it("multiple: el input de archivo aparece solo con 'Estado de cuenta/carta'", () => {
    const { container } = renderBandeja();
    abrirMultiple();
    for (const m of MOTIVOS_ACTUALES) {
      elegir("opcion-aprobar-multiple", m);
      expect(!!inputArchivo(container), m).toBe(m === "Estado de cuenta/carta");
    }
  });

  for (const m of MOTIVOS_ACTUALES) {
    it(`individual: se aprueba con '${m}' y el adjunto solo viaja con 'Estado de cuenta/carta'`, async () => {
      const { container } = renderBandeja();
      abrirIndividual(container);
      elegir("opcion-aprobar", m);
      if (m === "Estado de cuenta/carta") {
        fireEvent.change(inputArchivo(container)!, { target: { files: [pdf()] } });
      }
      fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
      await waitFor(() => expect(apiFetch).toHaveBeenCalled());
      const body = bodyDelUltimoPost();
      expect(body.motivo).toBe(m);
      expect(body.decision).toBe("approved");
      expect(!!body.adjunto).toBe(m === "Estado de cuenta/carta");
    });
  }

  it("individual: con un motivo sin adjunto, un archivo elegido antes no viaja", async () => {
    const { container } = renderBandeja();
    abrirIndividual(container);
    elegir("opcion-aprobar", "Estado de cuenta/carta");
    fireEvent.change(inputArchivo(container)!, { target: { files: [pdf()] } });
    elegir("opcion-aprobar", "Etiqueta");
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(bodyDelUltimoPost().adjunto).toBeUndefined();
  });

  it("multiple: se aprueba con cada motivo actual; el adjunto solo viaja con 'Estado de cuenta/carta'", async () => {
    for (const m of MOTIVOS_ACTUALES) {
      vi.mocked(apiFetch).mockClear();
      const { container, unmount } = renderBandeja();
      abrirMultiple();
      elegir("opcion-aprobar-multiple", m);
      if (m === "Estado de cuenta/carta") {
        fireEvent.change(inputArchivo(container)!, { target: { files: [pdf()] } });
      }
      fireEvent.click(screen.getByRole("button", { name: /^Aprobar 1/ }));
      await waitFor(() => expect(apiFetch).toHaveBeenCalled());
      const body = bodyDelUltimoPost();
      expect(body.motivo, m).toBe(m);
      expect(!!body.adjunto, m).toBe(m === "Estado de cuenta/carta");
      unmount();
    }
  });
});

describe("Bandeja - motivos de aprobacion NUEVOS", () => {
  it("individual: muestra los 6 motivos en orden", () => {
    const { container } = renderBandeja();
    abrirIndividual(container);
    expect(radios("opcion-aprobar").map((r) => r.value)).toEqual([...MOTIVOS_ACTUALES, ...MOTIVOS_NUEVOS]);
  });

  it("multiple: muestra los 6 motivos en orden", () => {
    renderBandeja();
    abrirMultiple();
    expect(radios("opcion-aprobar-multiple").map((r) => r.value)).toEqual([...MOTIVOS_ACTUALES, ...MOTIVOS_NUEVOS]);
  });

  it("individual: adjunto con 'Etiqueta/Carta' si, con 'Etiqueta/Estado de cuenta' no", () => {
    const { container } = renderBandeja();
    abrirIndividual(container);
    elegir("opcion-aprobar", "Etiqueta/Carta");
    expect(inputArchivo(container)).not.toBeNull();
    elegir("opcion-aprobar", "Etiqueta/Estado de cuenta");
    expect(inputArchivo(container)).toBeNull();
  });

  it("multiple: adjunto con 'Etiqueta/Carta' si, con 'Etiqueta/Estado de cuenta' no", () => {
    const { container } = renderBandeja();
    abrirMultiple();
    elegir("opcion-aprobar-multiple", "Etiqueta/Carta");
    expect(inputArchivo(container)).not.toBeNull();
    elegir("opcion-aprobar-multiple", "Etiqueta/Estado de cuenta");
    expect(inputArchivo(container)).toBeNull();
  });

  it("individual: aprueba con 'Etiqueta/Carta' mandando el adjunto", async () => {
    const { container } = renderBandeja();
    abrirIndividual(container);
    elegir("opcion-aprobar", "Etiqueta/Carta");
    fireEvent.change(inputArchivo(container)!, { target: { files: [pdf()] } });
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = bodyDelUltimoPost();
    expect(body.motivo).toBe("Etiqueta/Carta");
    expect(body.adjunto).toMatchObject({ nombreArchivo: "carta.pdf" });
  });

  it("individual: de 'Etiqueta/Carta' con archivo a 'Etiqueta/Estado de cuenta', el archivo no viaja", async () => {
    const { container } = renderBandeja();
    abrirIndividual(container);
    elegir("opcion-aprobar", "Etiqueta/Carta");
    fireEvent.change(inputArchivo(container)!, { target: { files: [pdf()] } });
    elegir("opcion-aprobar", "Etiqueta/Estado de cuenta");
    fireEvent.click(screen.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    const body = bodyDelUltimoPost();
    expect(body.motivo).toBe("Etiqueta/Estado de cuenta");
    expect(body.adjunto).toBeUndefined();
  });

  it("multiple: 'Etiqueta/Carta' manda adjunto; de ahi a 'Etiqueta/Estado de cuenta' no", async () => {
    const { container } = renderBandeja();
    abrirMultiple();
    elegir("opcion-aprobar-multiple", "Etiqueta/Carta");
    fireEvent.change(inputArchivo(container)!, { target: { files: [pdf()] } });
    fireEvent.click(screen.getByRole("button", { name: /^Aprobar 1/ }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(bodyDelUltimoPost().adjunto).toBeTruthy();
  });

  it("multiple: de 'Etiqueta/Carta' con archivo a 'Etiqueta/Estado de cuenta', el archivo no viaja", async () => {
    const { container } = renderBandeja();
    abrirMultiple();
    elegir("opcion-aprobar-multiple", "Etiqueta/Carta");
    fireEvent.change(inputArchivo(container)!, { target: { files: [pdf()] } });
    elegir("opcion-aprobar-multiple", "Etiqueta/Estado de cuenta");
    fireEvent.click(screen.getByRole("button", { name: /^Aprobar 1/ }));
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    const body = bodyDelUltimoPost();
    expect(body.motivo).toBe("Etiqueta/Estado de cuenta");
    expect(body.adjunto).toBeUndefined();
  });
});
