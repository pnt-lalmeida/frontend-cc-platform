import { BadgePiloto } from "../../components/BadgePiloto";
import { hoyUruguay } from "../../utils/fechas";
import { lineaPromesaBandeja } from "../cliente360/promesas";
import { useApiPromesas } from "../cliente360/useApiPromesas";
import { usePromesas } from "../cliente360/usePromesas";

// Contexto para decidir mejor, NUNCA parte de la decision: no filtra, no
// ordena la cola y no habilita ni bloquea Aprobar/Rechazar. Es una linea de
// texto: por eso no tiene ningun control. Se monta solo con la funcionalidad
// "promesas" habilitada (el gating vive en BandejaPage), asi sin habilitar no
// hay fetch.
//
// Mientras carga, o si el cliente no tiene promesas vigentes (lo mas comun),
// no se muestra nada: reservar el lugar dejaria un hueco en casi todos los
// pedidos. Si falla, un texto gris; la decision sigue igual.
export function LineaPromesaPago({
  cardCode,
  enPiloto,
  pegadaAIndicadores,
}: {
  cardCode: string;
  enPiloto: boolean;
  // Si la linea de comportamiento de pago esta justo arriba, esta se le acerca.
  pegadaAIndicadores: boolean;
}) {
  const api = useApiPromesas();
  const { datos, error } = usePromesas(api, cardCode);

  let texto: string | null = null;
  if (error && !datos) texto = "Promesas de pago no disponibles";
  else if (datos) texto = lineaPromesaBandeja(datos.promesas, hoyUruguay());
  if (texto === null) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        fontSize: 12.5,
        color: "var(--color-muted)",
        marginTop: pegadaAIndicadores ? -12 : -8,
        marginBottom: 20,
      }}
    >
      <span>{texto}</span>
      {enPiloto && <BadgePiloto />}
    </div>
  );
}
