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
