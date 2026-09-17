# Handoff a Claude Code — Cuentas Corrientes y Cobranzas (Pontyn)

**Cómo usar este documento:** son dos repos, dos sesiones de Claude Code. Pegar la Sección 1 (común) en las dos, más la Sección 2 en el repo backend o la Sección 3 en el repo frontend según corresponda. La Sección 4 es para vos, no para Claude Code — qué adjuntar junto con el texto.

---

## 1. Instrucciones comunes (pegar en los dos repos)

Estás arrancando la construcción del MVP de una plataforma web complementaria a SAP Business One, para el sector de Cuentas Corrientes y Cobranzas de Pontyn (distribución minorista/mayorista, Uruguay). **SAP sigue siendo el sistema transaccional autoritativo — esta plataforma lee, decide dentro de una política, y ejecuta acciones controladas sobre SAP. Nunca lo reemplaza ni le duplica el rol de fuente de verdad.**

Antes de escribir una sola línea de código, leé completo `Architecture.md` (adjunto) — es la fuente de verdad técnica, con todo lo ya validado contra el Service Layer real de SAP (contrato de sesión, esquema de `BusinessPartners`/`Orders`/`Invoices`, una sección de "Gotchas ya pagados" que hay que respetar desde el día 1) y la lista explícita de lo que todavía no está confirmado. Leé también `Discovery.md` para el contexto de negocio y `Decisions.md` para el historial de decisiones — nunca asumas que algo "quedaría bien" sin chequear primero si ya se decidió ahí.

**Alcance de esta primera etapa — no construir nada fuera de esto sin preguntar:**
1. **Cliente 360** — completo, de solo lectura.
2. **Bandeja de Autorización de Pedidos** — completa, incluido el paso de escritura: registrar la decisión como Actividad de SAP (`POST /Activities`, tabla `OCLG`, nunca modificar `ORDR` — mecanismo confirmado por Germán, ver `Architecture.md` Sección 4.6), **pero detrás de un feature flag apagado por default** hasta que se resuelva la decisión de alcance (Sección 9, punto 2 de `Architecture.md`: ¿repo nuevo o extender `sap_data_access`?) y se valide contra un ambiente confirmado.

**No construir:** Hub Omnicanal (Twilio/M365 — checklist sin resolver), CRM de Cobranza (pausado), nada que escriba de verdad en SAP.

**Reglas de oro, sin excepción:**
- **Ante cualquier duda de nombre de campo, comportamiento de SAP, o regla de negocio no confirmada en `Architecture.md`/`Discovery.md`: no inventar ni asumir "lo más razonable".** Dejar un `TODO` explícito citando la sección del documento que lo marca como pendiente, y preguntar antes de seguir si bloquea el avance.
- **Nunca un secreto en el repo ni en variables de entorno planas** — todo a Key Vault, referenciado desde App Settings.
- **Nunca una herramienta de escritura genérica** (`execute_sql`, `run_python`, etc.) — funciones acotadas y nombradas por lo que hacen (`get_client_360`, `list_pending_orders`, nunca un `run_query(sql: str)`).
- **Nunca trabajar directo sobre `main`.** Rama de desarrollo, correr tests localmente, y pedir confirmación explícita antes de mergear/pushear a `main` — son dos decisiones distintas (¿el código está bien? / ¿es el momento de que salga?).
- **Toda escritura futura es idempotente por diseño** (clave de idempotencia clara) y **nunca se reintenta automáticamente** si no es un GET — ver "Gotchas ya pagados" en `Architecture.md`.

---

## 3. Instrucciones específicas — Repo Frontend

**Stack:** React + Vite, Azure Static Web Apps (tier Standard — necesario por VNet hacia el backend, no usar la API gestionada gratuita de SWA).

**Autenticación:** MSAL pidiendo el token para el scope específico de la API del backend (`api://<app-id>/access_as_user`), mandado en el header estándar `Authorization: Bearer <token>`. **Sin proxy intermedio** — la SPA llama directo al backend.

**Pantallas de esta etapa:**
- **Cliente 360:** ficha del cliente (crédito, canal, clasificación — mostrar todo ya normalizado, tal como lo entrega el backend), facturas abiertas/vencidas, pedidos.
- **Bandeja de Autorización:** cola de candidatos, vista de detalle/contexto de un pedido, acciones de aprobar/rechazar.

**Reglas de interacción, no negociables para la Bandeja:**
- **Sin UI optimista en aprobar/rechazar** — es una transición de estado real, no un toggle simple. Esperar la confirmación del backend antes de reflejar el cambio en pantalla.
- **Nunca reintentar automáticamente** una acción de aprobar/rechazar ante un error de red — puede duplicar la acción. Si hace falta reintentar, que sea una acción explícita del usuario.
- Si el backend responde que la decisión quedó registrada pero no ejecutada en SAP (flag apagado, ver Sección 2), mostrarlo con claridad en la UI — nunca como si el pedido ya estuviera liberado.

**Otros:**
- Reutilizar un solo componente de tabla (búsqueda/orden/paginación) si hay más de una lista — no reimplementarlo por pantalla.
- Cualquier campo booleano que llegue del backend ya viene normalizado (Sección 2) — si en algún punto ves algo que se comporta como string en vez de boolean real, es un bug del backend, no algo para parchear en el frontend.

