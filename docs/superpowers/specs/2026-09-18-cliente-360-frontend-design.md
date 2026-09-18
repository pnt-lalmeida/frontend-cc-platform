# Diseño — Pantalla Cliente 360 (frontend-cc-platform)

**Fecha:** 18/09/2026
**Estado:** aprobado por Líber en chat (layout, búsqueda, pestañas de cuenta, resumen de riesgo, disposición de facturas/pedidos, y tres ajustes de diseño adicionales).
**Repo:** `frontend-cc-platform`.
**Basado en:** la fundación ya completa (`docs/superpowers/plans/2026-09-18-frontend-foundation.md`), `docs/Architecture.md` (contrato de API, gotchas), y las decisiones tomadas en chat el 18/09/2026.

## Contexto

Primera pantalla real del frontend, reemplaza el placeholder `Cliente360Page.tsx`. El backend (`cc-platform-api`) ya expone y tiene validados (fixtures + spike de auth + pruebas de integración opt-in contra SAP TEST real, 18/09/2026) los cuatro endpoints que esta pantalla necesita:

- `GET /api/clientes?q=<texto>` → `{ clientes: ClienteBusqueda[] }`
- `GET /api/clientes/{card_code}` → `FichaCliente` (objeto crudo, no envuelto)
- `GET /api/clientes/{card_code}/facturas` → `{ facturas: Factura[] }`
- `GET /api/clientes/{card_code}/pedidos` → `{ pedidos: Pedido[] }`

Los tipos `ClienteBusqueda`/`FichaCliente`/`Factura`/`Pedido` ya existen en `src/api/types.ts` (Tarea 3 de la fundación) y coinciden campo a campo con lo que el backend devuelve — verificado directamente contra `shared/cliente_360.py` y `shared/normalization.py`, no asumido.

## Alcance

**Incluye:**

- **Búsqueda con autocompletado** — input con debounce (~300ms), llama a `GET /api/clientes?q=`, dropdown con `card_code`/`card_name`/`moneda` de cada resultado.
- **Ficha del cliente seleccionado** — al elegir un resultado, `GET /api/clientes/{card_code}`, `GET /api/clientes/{card_code}/facturas` y `GET /api/clientes/{card_code}/pedidos` en paralelo.
- **Pestañas de cuenta relacionada** — si `ficha.cuentas_relacionadas` no está vacío, una fila de pestañas (una por cuenta, incluida la buscada) rotuladas por `moneda` (ej. "UYU" / "USD"). Cambiar de pestaña reconsulta ficha+facturas+pedidos de esa cuenta — **son cuentas distintas de SAP, no un filtro** (Architecture.md §5: nunca se suman saldos entre monedas). La pestaña activa lo deja explícito con una nota breve ("cuenta separada, sin sumar con las otras") para que el operador no lea "menos deuda en USD" como el panorama completo.
- **Resumen de riesgo** — fila de `StatusTag` arriba de la ficha: `bloqueado`/`congelado` (`payment_block`/`frozen`, variante `risk`), `sobre límite de crédito` (comparación simple `current_account_balance + open_orders_balance` vs `credit_limit`, solo si `!sin_limite`, variante `risk`), `sin límite` (si `sin_limite`, variante `ok`). La `clasificacion_cc` (A/B/C) se muestra en un `StatusTag` variante `neutral` — **nunca** verde/rojo — porque `Architecture.md` §6 documenta un caso real donde `"A"` no significa "mejor cliente" como parecería intuitivo; no se asume el significado hasta que Karen/Rosina lo confirmen.
- **Datos base de la ficha** — nombre, moneda, saldo cta cte, saldo pedidos abiertos, días de tolerancia — usando `formatMoney`/`formatDate` de la fundación.
- **Facturas y pedidos, apilados** — dos tablas (`Table` compartido) debajo de la ficha, ambas visibles a la vez. Cada fila de facturas con `StatusTag` `risk` si `doc_due_date < hoy`, `ok` si no. Cada fila de pedidos con `StatusTag` según `document_status`.
- **Estado vacío** — si `facturas`/`pedidos` es una lista vacía, la tabla se reemplaza por un mensaje explícito ("Sin facturas pendientes" / "Sin pedidos registrados"), nunca un encabezado de tabla sin filas.
- **Manejo de errores** — si cualquier fetch lanza `ApiError` (ej. `card_code` no encontrado), un mensaje claro en el lugar de la ficha, sin romper el buscador ni las otras secciones ya cargadas.

**Explícitamente fuera de este paso:**

- **Datos de cheques** (pedido de Karen, 18/09/2026) — no hay endpoint ni esquema de SAP confirmado todavía; Karen está relevando la fuente real, el plazo exacto y si es por cuenta o por cliente consolidado. La estructura de "resumen de riesgo" ya deja lugar para sumar esto después (un `StatusTag` más en la fila) sin rediseñar la pantalla — no se construye nada de cheques ahora.
- La pantalla de Bandeja de Autorización — plan separado.
- Deploy a Azure Static Web Apps — plan separado, después de que esta pantalla tenga contenido real.

## Decisiones técnicas

- **Envolturas de respuesta que faltan en `types.ts`.** La fundación dejó `ClienteBusqueda`/`FichaCliente`/`Factura`/`Pedido` (los objetos) pero no `{ clientes: [] }`/`{ facturas: [] }`/`{ pedidos: [] }` (las envolturas que el backend realmente devuelve) — un hallazgo Minor diferido de la revisión final de la fundación. Este plan agrega esos tres tipos de envoltura a `src/api/types.ts` como parte de la Tarea 1.
- **Debounce sin librería nueva** — un `setTimeout`/`clearTimeout` manual en un hook chico (`useDebouncedValue` o directo en el componente), no se suma una dependencia solo para esto.
- **Las tres llamadas de la ficha seleccionada van en paralelo** (`Promise.all` o tres `useEffect` independientes) — facturas y pedidos no dependen del resultado de la ficha, solo del `card_code` elegido.
- **Comparación de vencimiento en el cliente, no en el backend** — `doc_due_date < hoy` se calcula en el componente al renderizar cada fila; el backend no agrega ya un flag `vencida` a `Factura` (no se le pide ese cambio en este plan, alcance mínimo).
- **`getAccessToken` (de la fundación) antes de cada fetch** — todas las llamadas de esta pantalla pasan por `useAccessToken` + `apiFetch`, igual que el resto de la fundación; nunca un fetch directo sin token.
- **Testing (alcance explícito):** se testea lógica pura y aislable — el debounce del buscador, la función que decide si una factura está vencida, la función que arma las `StatusTag` del resumen de riesgo a partir de una `FichaCliente`. No se testea la orquestación completa de fetches de la página (tres llamadas async + estado de carga) con un test de integración pesado — se verifica a mano con `npm run dev` contra el backend ya desplegado, igual que se hizo con el prompt de login en la fundación.

## Estructura de archivos

```
frontend-cc-platform/
  src/
    api/
      types.ts                     (modificado — 3 tipos de envoltura nuevos)
    routes/
      Cliente360Page.tsx            (reemplaza el placeholder)
      cliente360/
        useClienteSearch.ts         (nuevo — debounce + fetch de búsqueda)
        useClienteSearch.test.ts
        useFichaCliente.ts          (nuevo — orquesta ficha+facturas+pedidos en paralelo)
        riesgo.ts                   (nuevo — arma la lista de StatusTags del resumen de riesgo)
        riesgo.test.ts
        facturas.ts                 (nuevo — decide si una factura esta vencida)
        facturas.test.ts
  src/**/*.test.ts(x)
```

## Testing

- `useClienteSearch.test.ts`: el debounce no dispara el fetch antes de que pase el intervalo; dispara una sola vez tras varios cambios rápidos de texto.
- `riesgo.test.ts`: casos reales tomados de `Architecture.md` (bloqueado, congelado, sobre límite, sin límite, clasificación A/B/C siempre neutral) — entrada `FichaCliente` → lista esperada de `{variant, label}`.
- `facturas.test.ts`: `doc_due_date` pasado → vencida; `doc_due_date` futuro o de hoy → no vencida.

## Fuera de alcance / próximos pasos (no de este spec)

- Sumar datos de cheques al resumen de riesgo, una vez Karen confirme fuente/plazo/alcance.
- Plan de la Bandeja (frontend).
- Deploy a Azure Static Web Apps.
