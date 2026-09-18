# Diseño — Fundación del frontend (frontend-cc-platform)

**Fecha:** 18/09/2026
**Estado:** aprobado por Líber en chat (stack, dirección visual vía maqueta en `https://claude.ai/artifact/4HeQs6UxmNw1qomd7iCoiA`, y esta spec).
**Repo:** `frontend-cc-platform`.
**Basado en:** `docs/Architecture.md` (contrato de API, auth), `docs/Decisions.md`, `guia-arquitectura-backend-frontend.md` (aportada por Líber), y el spike de auth exitoso del 18/09/2026 (backend `cc-platform-api` desplegado y validado de punta a punta).

## Contexto

Primer paso de construcción del frontend (`frontend-cc-platform`, hoy vacío salvo `docs/`). El backend (`cc-platform-api`) ya está completo para Cliente 360 y los fundamentos de la Bandeja, con el spike de autenticación ya validado contra un recurso real (`https://cc-platform-api.azurewebsites.net`). Este spec cubre solo la fundación compartida — las pantallas reales de Cliente 360 y de la Bandeja son planes separados, que dependen de esta fundación pero son independientes entre sí.

## Alcance

**Incluye:**
- Scaffold del proyecto: Vite + React 18 + TypeScript + react-router-dom, sin Refine (a diferencia de `frontend-cfe-review`) — nuestros endpoints no son un modelo CRUD de recursos genérico.
- Auth: MSAL (`@azure/msal-browser` + `@azure/msal-react`) contra el App Registration ya creado (`2095b6bc-db66-4b95-97ad-7c569800a4c9`, tenant `17af3ac8-4b4c-4703-b52f-2f902d63af82`, scope `access_as_user`), **sin proxy** — llamada directa SPA→Function con `Authorization: Bearer`, per `Architecture.md` §2-3.
- Cliente HTTP fino (`src/api/client.ts`): agrega el token, nunca reintenta automático, tipos TS calcados de lo que el backend ya normaliza.
- Sistema de diseño (`src/design/tokens.css` + `format.ts`): paleta/tipografía de la maqueta aprobada (papel gris-verdoso frío, teal profundo, ladrillo para vencido, ocre para tolerancia, `Fraunces`/`IBM Plex Sans`/`IBM Plex Mono`), formateo de moneda/fecha convención Uruguay (coma decimal, punto de miles, `DD/MM/AAAA`).
- Shell de navegación (`AppShell.tsx`): topbar liviana, sin sidebar oscuro (dirección aprobada) — nav entre Cliente 360 / Bandeja.
- Componente de tabla compartido (`Table.tsx`) — un solo lugar para el patrón "ledger row" (guía §5: "un solo hook/componente para tablas de listado").
- `StatusTag.tsx` — pills de categoría/estado (ok/caution/risk/neutral) usando los tokens.
- Rutas placeholder para Cliente 360 y Bandeja (contenido real en los próximos dos planes).

**Explícitamente fuera de este paso:**
- Las pantallas reales de Cliente 360 y de la Bandeja (datos, formularios de aprobar/rechazar, etc.) — planes separados.
- Deploy a Azure Static Web Apps — se decide cuando el frontend tenga contenido real.
- Cualquier lógica de negocio (normalización, cálculos) — eso ya vive en el backend; el frontend solo muestra lo que el backend ya normalizó.

## Decisiones técnicas

- **Sin proxy, sin Refine.** Ver `Architecture.md` §2-3 y el spike exitoso del 18/09/2026 — la llamada directa SPA→Function con JWT manual funciona.
- **`VITE_API_BASE_URL` apunta al backend ya desplegado** (`https://cc-platform-api.azurewebsites.net`) por default en `.env.example` — ya está funcionando (spike), más simple que levantar `func start` local mientras no haya necesidad de iterar el backend en paralelo. Se puede apuntar a `http://localhost:7071` cambiando la variable si se necesita.
- **Sin reintentos automáticos en el cliente HTTP**, ni siquiera en GET — simplicidad, consistente con "nunca reintentar sin que el llamador lo pida explícitamente" (guía §5).
- **`redirectUri: window.location.origin`** en la config de MSAL (no hardcodeado a `localhost:5173`) — funciona tanto en desarrollo como en producción una vez que se registre el dominio real de la Static Web App (los redirect URIs son aditivos, guía §10.9) — **`TO VERIFY` cuando exista esa URL real: agregarla al App Registration.**
- **Testing (alcance explícito, guía §6):** Vitest + Testing Library. Se testea lógica pura (`format.ts`, `client.ts` con `fetch` mockeado, el orden de `Table.tsx`) — no se testean páginas completas todavía (son placeholders). Se decide de nuevo el alcance cuando Cliente 360/Bandeja tengan contenido real.
- **Un flag booleano que llega del backend ya es un boolean real** (el backend ya normaliza `tYES`/`tNO`) — pero por las dudas, cualquier render condicional (`{flag && <X/>}`) se hace con `Boolean(flag)` explícito, per el gotcha de la guía §5 (0/1 truthy).

## Estructura del proyecto

```
frontend-cc-platform/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  .env.example
  .gitignore
  src/
    main.tsx
    App.tsx
    auth/
      msalConfig.ts
      AuthProvider.tsx
      RequireAuth.tsx
      useAccessToken.ts
    api/
      client.ts
      types.ts
    design/
      tokens.css
      format.ts
    components/
      AppShell.tsx
      Table.tsx
      StatusTag.tsx
    routes/
      Cliente360Page.tsx
      BandejaPage.tsx
  src/**/*.test.ts(x)
```

## Testing

- `format.test.ts`: `formatMoney`/`formatDate` contra casos reales (incluye `null`, sin límite, distintas monedas).
- `client.test.ts`: `apiFetch` agrega `Authorization: Bearer <token>`, arma la URL con `VITE_API_BASE_URL`, lanza `ApiError` con el status/body en un `!res.ok`, nunca reintenta.
- `Table.test.tsx`: ordena al hacer click en un header de columna, ambas direcciones.

## Fuera de alcance / próximos pasos (no de este spec)

- Plan de Cliente 360 (frontend): ficha, facturas, pedidos, búsqueda de clientes.
- Plan de la Bandeja (frontend): cola de candidatos, detalle, aprobar/rechazar (sin UI optimista).
- Deploy a Azure Static Web Apps + agregar su dominio real al App Registration.
