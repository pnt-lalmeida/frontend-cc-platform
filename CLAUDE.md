# CLAUDE.md — Cuentas Corrientes y Cobranzas (Pontyn)

**Qué es:** plataforma web complementaria a SAP Business One para el sector de Cuentas Corrientes y Cobranzas — Cliente 360, autorización de pedidos bloqueados y comunicación omnicanal con clientes. SAP sigue siendo el sistema transaccional autoritativo; esta plataforma es la capa operativa.

**Estado actual (24/09/2026):** Cliente 360 y la Bandeja de Autorización están **construidos, testeados (211 tests backend, 84 frontend) y validados con escrituras reales contra SAP** — mecanismo de escritura confirmado por Germán (registrar Actividad SAP, `OCLG` — nunca modificar `ORDR`, `Architecture.md` Sección 4.6) e implementado en el repo backend (`cc-platform-api`), decisión de repo ya resuelta por Líber (Sección 9, punto 2/17 — nunca se extendió `sap_data_access`). Autenticación real con Entra ID/JWT ya implementada y en uso (`shared/auth.py` en el backend, MSAL en este repo), no queda como spike pendiente. Ambos repos están en `main` y desplegados a producción real — **el Function App real hoy apunta a SAP producción (no TEST), con `SAP_WRITE_ENABLED=true` y `SAP_USERNAME=manager`** (temporal, hasta que Germán habilite el permiso real de `PontynSL` para crear Actividades — `Architecture.md` punto 41; nunca dejarlo como config permanente). Sumado desde el 21/09: búsqueda de clientes case-insensitive (HANA directo), campo "Zona Ctas Ctes", adjuntos al aprobar/rechazar (individual y múltiple, con descarga desde Cliente 360), agrupación de la Bandeja por cliente, y fix de reconsiderar un pedido ya rechazado (`Architecture.md` puntos 43-45). Pendiente: checklist completo del Módulo 4 (Twilio/M365) antes de arrancar el Hub Omnicanal, y definición de superposición con el sistema "POC" antes de tocar el CRM de Cobranza.

**Orden de construcción:** 1) Cliente 360 → 2) Bandeja de Autorización de Pedidos → 3) Hub Omnicanal. Los dos primeros ya están construidos y validados; el Hub Omnicanal es el próximo hito grande. (CRM de Cobranza: pausado, ver `Decisions.md` 09/09/2026.)

**Principio rector:** Determinístico donde se pueda. Agéntico donde aporte valor. Humano donde sea consecuente.

## Dónde está cada cosa

Toda la documentación de fondo vive en `docs/` (movida desde la raíz el 17/09/2026 para dejar la raíz libre para el código). `CLAUDE.md` queda en la raíz.

- **`docs/Discovery.md`** — todo lo relevado: hallazgos, evidencia cuantitativa, candidatos de automatización, preguntas pendientes, datos sensibles. Se edita en el lugar, no se versiona.
- **`docs/Plan.md`** — alcance vigente, orden de construcción del MVP, supuesto tecnológico preliminar, backlog priorizado, roadmap por etapas.
- **`docs/Decisions.md`** — historial de decisiones, append-only. Consultar antes de asumir que algo "quedó abierto" — puede que ya se haya decidido acá.
- **`docs/Architecture.md`** — creado 16/09/2026, tras aviso explícito de madurez (I.4). Cubre Cliente 360 y Bandeja de Autorización, ambos ya con escritura real a SAP implementada y validada (no solo modo lectura); Hub Omnicanal sigue como esqueleto preliminar. Contiene el contrato técnico completo de SAP Service Layer ya validado (sesión, esquema de `BusinessPartners`/`Orders`/`Invoices`, fórmula propuesta de crédito disponible), la lista de gotchas reales ya pagados (Sección 10) y los puntos abiertos que quedan (Sección 9) — ninguno bloqueante hoy para Cliente 360/Bandeja.
- **`docs/Pontyn_CC_Handoff_ClaudeCode.md`** — texto de handoff original pegado al arrancar las dos sesiones de Claude Code (backend/frontend); snapshot histórico, ya incorporado a este `CLAUDE.md` y a `docs/Architecture.md`.
- **Fixtures y colección Postman** (`tests/fixtures/pontyn_cc_sap_fixtures.json`, `docs/Pontyn_CC_SAP_ServiceLayer_v6.postman_collection.json`) — viven en el repo backend (`cc-platform-api`), no en este; usar como referencia para tests y para el cliente de `shared/sap_gateway.py` desde el lado backend.
- **Demo HTML** (`Pontyn_CC_MVP_Maqueta_Demo.html`) — maqueta interactiva de validación de requerimientos. Se sigue ajustando versión a versión a medida que el descubrimiento avanza; no es el producto final. **`TO VERIFY`: no está presente en este repo, confirmar con Líber si vive en otro lado.**
- **Checklist de datos y accesos** (`Pontyn_CC_Checklist_Datos_y_Accesos.md`) — qué falta pedir a Germán/Stefano/Karen para empezar a construir, organizado por módulo y prioridad. **`TO VERIFY`: no está presente en este repo, confirmar con Líber si vive en otro lado.**

## Personas clave

Stefano (Dirección) · Rosina y Claudia (supervisión) · Lorena, Sabrina, Monserrat (equipo operativo) · Karen (categorización, referencia manual) · Germán (estructura interna de SAP) · Nicolás (POC, cobranza) · Jorge (autoriza excepciones +60 días) · Alejandro (rediseño contable de resguardos) · María (referente de cartas).

## Snapshot histórico

El descubrimiento vivía antes en `Pontyn_Descubrimiento_Cuentas_Corrientes_Resumen_Ejecutivo_v2.md` (resumen ejecutivo tipo reporte). Ese archivo queda como snapshot al 08/09/2026; el contenido vigente y editable de acá en más es `Discovery.md`.

## Flujo de cambios: MR (backend, GitLab) y PR (frontend, GitHub)

Reglas estables de Líber (23/10/2026). Aplican a **todo** cambio, en los dos repos.

**Repos y ramas**
- Backend: `gitlab.com/pontyn_automation/accounts_receivable/cc-platform-api`. CI de GitLab: el job `test` corre en las MR y en `main`; `deploy_production` corre **solo** en `main` cuando `test` pasa: **el merge del MR es la aprobación de Líber** (desde el 23/10/2026; antes era un clic manual). **Ojo:** que solo Líber mergee es un acuerdo de trabajo, no una restricción técnica: GitLab Free deja mergear y pushear a `main` a los 3 Maintainers (ver `Decisions.md` 23/10/2026). **Rollback:** reintentar un `deploy_production` exitoso anterior. Un push a `development` o a una rama de trabajo no crea pipeline.
- Frontend: `github.com/pnt-lalmeida/frontend-cc-platform`. GitHub Actions despliega **solo** al Static Web App en cada push a `main`.
- `main` = producción. **Nunca push a `main`.** Solo Líber mergea a `main`. Las credenciales de `glab` y `gh` las carga él en su entorno: nunca pedirlas por el chat.
- `development` es solo la rama de integración. Cada cambio va en una rama corta (`feat/<tema>`, `fix/<tema>`, `docs/<tema>`, `ci/<tema>`) creada desde `origin/development`, en un **worktree hermano** `../<repo>-<tema>` (no dentro de `.claude/`), para no pisar la carpeta principal. Nunca `git checkout` sobre trabajo sin commitear.

**Ciclo de un cambio**
1. TDD en la rama de trabajo. Si es un cambio de comportamiento: aditivo y detrás de un flag que por defecto deje todo igual que hoy (reglas de oro, `Decisions.md` 15/10/2026).
2. Controles completos antes de integrar. Backend: `pytest -q -m "not integration"`. Frontend: `npm run build` (incluye `tsc --noEmit`) y `npx vitest run`. **Hoy no hay lint ni formateo configurado en ninguno de los dos repos** (ver "Diferencias con la plantilla"). Revisión independiente del diff con el agente `validador` (solo lectura); resolver lo que encuentre.
3. Commit en la rama de trabajo. Merge a `development` con `--no-ff` y volver a correr las suites en `development`. Conflictos típicos, en listas compartidas: `shared/features.py`, rutas de `function_app.py`, `src/features/features.ts`, `src/App.tsx`. Hay que conservar las dos versiones.
4. Push de `development`.
5. **Antes de crear un MR o PR nuevo, avisar a Líber qué lleva y contra qué rama, y esperar su OK.**
6. Revisar si ya hay uno abierto de `development` a `main` (`glab mr list --source-branch development` / `gh pr list --head development`). Si existe, el push lo actualiza solo: no crear otro. Si no: `glab mr create --source-branch development --target-branch main --title "..." --description "..."` / `gh pr create --base main --head development --title "..." --body "..."`. La descripción dice qué entra, qué flags trae y en qué estado, si hay migración y el orden de merge, y termina con «🤖 Generated with Claude Code».
7. Líber mergea: **primero el backend, después el frontend** (el frontend usa las rutas nuevas). **Mergear el MR del backend ya despliega:** esperar a que el deploy termine y verificarlo antes de mergear el PR del frontend. Una migración de base se aplica en producción **antes** de mergear el código, solo con su OK, y primero en dry-run (dentro de una transacción con rollback; el DDL de SQL Server es transaccional).
- Al crear el MR de `development` a `main`, pasar siempre `--remove-source-branch=false`: el proyecto tiene activado borrar la rama de origen al mergear y se llevaría `development`.

**Después del merge: verificar y reportar**
- Backend: el pipeline de `main` (`glab ci list`) con `test` en success. Con el deploy ya corrido por el merge (`deploy_production` arranca solo y publica): `DEPLOY_VERSION`, el historial real de deployments (ARM API) y `/api/health` en 200. Las rutas nuevas tienen que dar 401 sin token; como control, una ruta inexistente da 404. Un 404 en los primeros minutos puede ser el host arrancando.
- Frontend: `gh run list --branch main` hasta que termine en success, y después buscar en el bundle publicado un texto que solo exista en la versión nueva.
- Si algo falla: leer el log del job, encontrar la causa y arreglarla en una rama nueva. No relanzar a ciegas. Caso típico: un test que pasa local y falla en el CI porque depende de algo que la imagen no tiene (`git`, librerías nativas). Si se agotaron los minutos de CI (`ci_quota_exceeded`), avisar y no reintentar.
- Los flags nuevos quedan en `piloto` después del deploy. Pasarlos a `todos` es otra decisión, con OK de Líber.

**Commits, MR y PR**
- En español: `feat:`, `fix:`, `docs:` o `ci:` más qué cambia, y en el cuerpo el porqué. Los commits terminan con la línea de coautoría de Claude.
- Nunca saltear hooks ni la firma. Nunca secretos en commits, MR, PR ni logs.

**Documentación**
- Los 4 de `docs/` (`Architecture.md`, `Decisions.md`, `Discovery.md`, `Plan.md`) son **idénticos** entre los dos repos: editar en uno, copiar al otro y verificar con `diff`. **`CLAUDE.md` es propio de cada repo**, salvo esta sección, que es igual en los dos.
- Cada decisión es una entrada nueva al final de `Decisions.md`: nunca se reescribe la historia.

**Diferencias con la plantilla de Líber (23/10/2026), pendientes de decisión**
1. La `main` del frontend **no está protegida** en GitHub. La del backend sí: push y merge, solo Maintainers.
2. **No hay lint ni formateo** en ninguno de los dos repos. Sumarlos (por ejemplo `ruff` y `eslint`) es una tecnología nueva: necesita OK, y conviene hacerlo en un cambio aparte, porque el código existente va a tener observaciones.
3. El CI de GitLab **no tiene la optimización** de la plantilla (filtros por rutas, un único job `verificar`, cancelar pipelines viejos en las MR). Hoy un commit solo de docs que llega a `main` también corre `test`.
4. En el frontend, **un commit solo de docs que llega a `main` sí despliega**: el workflow no ignora rutas.
- Los worktrees de **agentes** siguen en `.claude/worktrees/` (se limpian al terminar cada fase); los de **cambios** son hermanos, fuera del repo, así Vitest no los toma.

## Notas operativas

- **Agentes formalizados** (28/09/2026) en `.claude/agents/`: `investigador` y `validador` (idénticos al repo backend `cc-platform-api`), `frontend` y `optimizador` (propios de este repo). Cada archivo trae solo las reglas duras y los patrones estables — la tarea puntual sigue viajando en un brief/contrato que se escribe fresco cada vez. `optimizador` es el único que combina lectura solo-lectura contra sistemas reales con permiso de escribir código, y se invoca a demanda, no en cada fase. Flujo completo y detalle de modelos (Opus/Sonnet) en el `CLAUDE.md` del repo backend y en `Decisions.md` 28/09/2026.
- **Solo el orquestador edita `.claude/agents/*.md` y los documentos vivos** (este `CLAUDE.md`, `docs/Architecture.md`, `docs/Decisions.md`, `docs/Discovery.md`, `docs/Plan.md`). Ningún agente los escribe — todos los leen al arrancar. Un subagente reporta en su mensaje final (o, angosto, en `docs/proposals/`); el orquestador decide qué queda documentado y lo escribe él mismo, en los dos repos.
- **Propuestas de agentes** (`docs/proposals/`, ver `docs/proposals/README.md`): un agente puede dejar como mucho un archivo corto ahí cuando encuentra algo reusable y ajeno a su tarea puntual. El orquestador las revisa y las borra al consolidarlas; el histórico de qué se decidió queda en `Decisions.md`.
- **Ritual de revisión:** antes de arrancar un módulo grande nuevo, releer los 6 archivos de `.claude/agents/` (los dos repos) y revisar `docs/proposals/` pendiente.

- **Limpiar los worktrees de agentes al terminar cada fase** (`git worktree remove` + `prune`, una vez mergeado). Están en `.gitignore`, así que git no los ve — **pero Vitest sí**: un worktree olvidado dentro del repo hace que la suite levante cada test dos veces (pasó el 29/09: 890 tests en vez de 445, el doble exacto). El número inflado pasa por "todo bien", y un test que falle en una sola de las dos copias es indescifrable.

**Estado del frontend (29/09/2026):** 445 tests. Además de Cliente 360 y la Bandeja, están construidos los frontends del CRM liviano — Bitácora, Centro de alertas, Situación de la cuenta, Antigüedad de saldos, Comportamiento de pago (todos liberados o en piloto) y **Promesas de pago** (Fase 4, en `development` con el flag en `off`). **Antes de prender `promesas` falta la revisión visual en navegador a ancho de teléfono**, que todavía no hizo nadie. El frontend de Riesgo de bloqueo (Fase 5) **no se construye** hasta que su modo pase de `sombra` a `activo`: hoy sería código muerto. El estado completo, siempre vigente, vive en el `CLAUDE.md` del backend y en `docs/Architecture.md` (puntos 47-60).
