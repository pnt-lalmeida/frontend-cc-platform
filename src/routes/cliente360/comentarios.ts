// Recorte del campo "Comentarios" de la ficha SAP para Cliente 360.
// Datos reales medidos (30/09/2026): promedio 159 caracteres, 68% multilinea
// (una linea por dato), pero hay casos de mas de 300 caracteres y el peor tiene
// 64 renglones. Sin recorte ese caso empuja toda la ficha fuera de la pantalla.
// El texto llega ya normalizado del backend (saltos como "\n"), no se limpia.

export interface OpcionesRecorte {
  maxRenglones?: number;
  maxCaracteres?: number;
}

export interface TextoRecortado {
  visible: string;
  recortado: boolean;
  // Renglones que quedaron fuera; sirve para decirle a la persona cuanto falta.
  renglonesOcultos: number;
}

const MAX_RENGLONES = 4;
const MAX_CARACTERES = 300;

export function recortarComentarios(texto: string, opciones: OpcionesRecorte = {}): TextoRecortado {
  const maxRenglones = opciones.maxRenglones ?? MAX_RENGLONES;
  const maxCaracteres = opciones.maxCaracteres ?? MAX_CARACTERES;
  const renglones = texto.split("\n");

  let visible = renglones.slice(0, maxRenglones).join("\n");
  let renglonesOcultos = Math.max(renglones.length - maxRenglones, 0);
  let recortado = renglonesOcultos > 0;

  if (visible.length > maxCaracteres) {
    recortado = true;
    const corte = visible.slice(0, maxCaracteres);
    // Corta en el ultimo espacio o salto para no partir una palabra, salvo que
    // quede demasiado poco texto (ej. un teléfono largo sin espacios).
    const ultimo = Math.max(corte.lastIndexOf(" "), corte.lastIndexOf("\n"));
    visible = ultimo > maxCaracteres / 2 ? corte.slice(0, ultimo) : corte;
    // Renglones que el corte por caracteres tambien dejo afuera.
    renglonesOcultos = Math.max(renglones.length - visible.split("\n").length, 0);
  }

  return { visible: recortado ? `${visible}…` : visible, recortado, renglonesOcultos };
}
