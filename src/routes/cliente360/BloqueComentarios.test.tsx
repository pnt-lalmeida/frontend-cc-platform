import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BloqueComentarios } from "./BloqueComentarios";

// Textos inventados: el campo real trae telefonos y nombres de contacto.
const CORTO = "Paga a 30 dias\nAvisar por WhatsApp";
const LARGO = Array.from({ length: 30 }, (_, i) => `Renglon inventado ${i + 1}`).join("\n");

describe("BloqueComentarios", () => {
  it("no dibuja nada si comentarios es null", () => {
    const { container } = render(<BloqueComentarios comentarios={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("no dibuja nada si comentarios es undefined (backend viejo)", () => {
    const { container } = render(<BloqueComentarios comentarios={undefined} />);
    expect(container.innerHTML).toBe("");
  });

  it("muestra el texto tal cual, respetando saltos de linea y sin monoespaciada", () => {
    render(<BloqueComentarios comentarios={CORTO} />);
    const texto = screen.getByTestId("comentarios-texto");
    expect(texto.textContent).toBe(CORTO);
    expect(texto.style.whiteSpace).toBe("pre-wrap");
    expect(texto.style.fontFamily).not.toContain("mono");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("no es editable: sin textbox ni contenteditable", () => {
    render(<BloqueComentarios comentarios={CORTO} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByTestId("comentarios-texto").getAttribute("contenteditable")).toBeNull();
  });

  it("recorta los largos y ofrece Ver mas con estado accesible", () => {
    render(<BloqueComentarios comentarios={LARGO} />);
    const texto = screen.getByTestId("comentarios-texto");
    expect(texto.textContent).not.toContain("Renglon inventado 30");
    const boton = screen.getByRole("button", { name: /ver más/i });
    expect(boton.getAttribute("aria-expanded")).toBe("false");
    expect(boton.getAttribute("aria-controls")).toBe(texto.id);
  });

  it("expande y vuelve a recortar", () => {
    render(<BloqueComentarios comentarios={LARGO} />);
    fireEvent.click(screen.getByRole("button", { name: /ver más/i }));
    expect(screen.getByTestId("comentarios-texto").textContent).toBe(LARGO);
    const boton = screen.getByRole("button", { name: /ver menos/i });
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(boton);
    expect(screen.getByTestId("comentarios-texto").textContent).not.toContain("Renglon inventado 30");
  });

  it("al cambiar de cliente vuelve a mostrarse recortado", () => {
    const { rerender } = render(<BloqueComentarios key="A" comentarios={LARGO} />);
    fireEvent.click(screen.getByRole("button", { name: /ver más/i }));
    rerender(<BloqueComentarios key="B" comentarios={LARGO} />);
    expect(screen.getByRole("button", { name: /ver más/i })).toBeTruthy();
  });
});
