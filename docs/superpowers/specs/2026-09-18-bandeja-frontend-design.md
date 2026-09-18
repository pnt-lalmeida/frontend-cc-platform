# Diseño — Bandeja de Autorización (frontend-cc-platform)

**Fecha:** 18/09/2026
**Estado:** aprobado por Líber en chat (layout, colores de estado, panel de detalle, formulario de aprobar/rechazar sin UI optimista).
**Repo:** `frontend-cc-platform`.
**Basado en:** la fundación y Cliente 360 ya completos, `docs/Architecture.md` (contrato de API, comentarios de Actividad ya validados contra un conjunto cerrado), y las decisiones de esta sesión (18/09/2026).

## Contexto

Segunda pantalla real del frontend, reemplaza el placeholder `BandejaPage.tsx`. El backend (`cc-platform-api`) ya expone y tiene validados:

- `GET /api/bandeja/candidatos` → `{ candidatos: CandidatoBandeja[] }` (tipo ya existe en `src/api/types.ts`).
- `POST /api/bandeja/pedidos/{doc_entry}/decision` — body `{ cardCode: string, docNum: number, decision: "approved" | "rejected", motivo?: string }`, respuesta `DecisionResponse` (tipo ya existe).

**Regla de negocio confirmada esta sesión, crítica para este diseño:** el campo `motivo` de la Actividad no es texto libre. Al aprobar, debe ser exactamente uno de `"Emitir estado de cuenta"` / `"Estado de cuenta"` / `"Carta"` — cualquier otro valor recibe un `400` (`shared/activity_payload.py`, ya implementado y testeado). Al rechazar, el backend fija `"No autorizar"` automáticamente — el frontend **no** necesita mandar `motivo` en ese caso.

**Otra regla confirmada:** `"Rechazado"` no significa resuelto — es el estado por defecto de un pedido que ya se revisó una vez y volvió a quedar pendiente de una nueva revisión (Architecture.md §9.31). La UI no debe ocultarlo ni tratarlo como si ya estuviera cerrado.

## Alcance

**Incluye:**

- **Tabla de candidatos** (`Table` compartido) — columnas: N° pedido (`doc_num`), cliente (`card_name`/`card_code`), importe (`formatMoney(importe, moneda)`), vendedor, condición de pago, y un `StatusTag` de estado (`status_aprobacion`).
- **Colores de estado, nunca verde:** `"Pendiente"` → variante `caution` (nunca revisado); `"Rechazado"` → variante `risk` (ya se revisó una vez y volvió, más urgente que Pendiente, no menos). Ninguno de los dos es un estado resuelto.
- **Panel de detalle** — al hacer click en una fila de la tabla, se abre un panel debajo (mismo patrón que la ficha de Cliente 360: búsqueda arriba, detalle abajo) con los campos que la tabla no muestra: `cliente_suspendido` (StatusTag si es `true`), `nro_referencia_externa`, `comentarios` (Merc/Ronda), fecha y hora del pedido (`doc_date` + `hora_pedido`).
- **Formulario de decisión, sin UI optimista:**
  - Aprobar: 3 radio buttons con las opciones fijas exactas (`"Emitir estado de cuenta"`, `"Estado de cuenta"`, `"Carta"`) — nunca un textarea. El botón "Aprobar" solo se habilita cuando se eligió una opción.
  - Rechazar: un botón directo, sin formulario — el backend ya fija el comentario.
  - Mientras la request está en curso, el botón que se apretó queda deshabilitado con un texto de carga (ej. "Aprobando...") — la fila/candidato **no se remueve ni se marca como decidido hasta que la respuesta real del backend llega exitosamente**. Si falla, se muestra el error y el candidato queda exactamente como estaba.
  - Al confirmar una decisión con éxito, se vuelve a pedir la lista de candidatos (no se edita la lista localmente por adivinanza) y se cierra el panel de detalle.
- **Estado vacío** — si no hay candidatos, un mensaje explícito ("No hay pedidos pendientes de autorización."), nunca una tabla con encabezado vacío.
- **Manejo de errores** — igual criterio que Cliente 360: un error de carga de candidatos no rompe nada más; un error al decidir se muestra junto al formulario, sin perder la selección del candidato.

**Explícitamente fuera de este paso:**

- Cualquier cambio al backend — ya está completo y probado (112/112 tests).
- Habilitar `SAP_WRITE_ENABLED=true` — sigue en `false`, las decisiones se registran localmente pero no llegan a SAP real todavía (precondiciones documentadas en Architecture.md §9.18, sin resolver).
- Ordenamiento/priorización especial de la cola más allá del sort por columna que `Table` ya da gratis.

## Decisiones técnicas

- **Sin UI optimista, deliberado** (ya era un requisito explícito desde el diseño original de la Bandeja) — cualquier apuro visual de "ya se decidió" antes de la confirmación real del backend es exactamente el tipo de bug que este requisito busca evitar en una escritura a SAP.
- **El formulario de aprobar nunca permite texto libre** — los 3 valores son literales, no un input de texto. Esto no es una limitación de UX, es la regla de negocio real (Architecture.md §4.6/§9.25).
- **Tipos nuevos en `src/api/types.ts`:** `CandidatosResponse { candidatos: CandidatoBandeja[] }`, `DecisionRequest { cardCode: string; docNum: number; decision: "approved" | "rejected"; motivo?: string }` — `CandidatoBandeja`/`DecisionResponse` ya existen, no se tocan.
- **Testing (alcance explícito, mismo criterio que Cliente 360):** se testea lógica pura y aislable — la función que construye las columnas/estado no tiene lógica propia más allá de mapear datos ya normalizados por el backend, así que el foco de los tests está en: (a) que el formulario de aprobar exige una de las 3 opciones antes de habilitar el botón, (b) que rechazar nunca manda `motivo`, (c) que ninguna fila se remueve de la lista antes de una respuesta exitosa del backend. No se testea la orquestación completa de fetch con un test de integración pesado — verificación manual con `npm run dev` como el resto del proyecto.

## Estructura de archivos

```
frontend-cc-platform/
  src/
    api/
      types.ts                      (modificado — 2 tipos nuevos)
    routes/
      BandejaPage.tsx                (reemplaza el placeholder)
      bandeja/
        useCandidatos.ts             (fetch de la lista + refetch tras decidir)
        useDecision.ts               (POST de la decision, sin UI optimista)
        useDecision.test.ts
        estado.ts                    (mapea status_aprobacion -> StatusTagVariant)
        estado.test.ts
```

## Testing

- `estado.test.ts`: `"Pendiente"` → `caution`, `"Rechazado"` → `risk`, cualquier otro valor no listado → `neutral` (nunca inventa un color, nunca verde).
- `useDecision.test.ts`: aprobar sin elegir una opción no dispara la request; aprobar con una opción válida manda exactamente `{cardCode, docNum, decision: "approved", motivo: <opción elegida>}`; rechazar manda `{cardCode, docNum, decision: "rejected"}` sin `motivo`; mientras la request está en curso, `loading` es `true` y no se asume éxito hasta que la respuesta llega.

## Fuera de alcance / próximos pasos (no de este spec)

- Deploy a Azure Static Web Apps — siguiente paso después de este plan, con Cliente 360 y Bandeja ya listas juntas.
- Habilitar escritura real a SAP — precondiciones sin resolver (Architecture.md §9.18).
