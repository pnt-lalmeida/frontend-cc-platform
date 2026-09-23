/**
 * Abre una URL en una pestaña nueva de forma confiable, incluso despues de
 * un `await` (ej. esperar la URL SAS del backend). `window.open(url)` en
 * ese punto ya no cuenta como resultado directo del click del usuario y el
 * navegador la bloquea en silencio o la deja en blanco - confirmado real
 * 23/09/2026 (mismo bug ya resuelto en frontend-cfe-review 07/08/2026). Un
 * <a target="_blank"> clickeado programaticamente no tiene esa restriccion.
 */
export function abrirEnNuevaPestana(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
