# CLAUDE.md — Cuentas Corrientes y Cobranzas (Pontyn)

**Qué es:** plataforma web complementaria a SAP Business One para el sector de Cuentas Corrientes y Cobranzas — Cliente 360, autorización de pedidos bloqueados y comunicación omnicanal con clientes. SAP sigue siendo el sistema transaccional autoritativo; esta plataforma es la capa operativa.

**Estado actual (16/09/2026):** descubrimiento consolidado + validación técnica real contra SAP Service Layer (cuatro rondas de prueba) + mecanismo de escritura de la Bandeja confirmado por Germán (registrar Actividad SAP, `OCLG` — nunca modificar `ORDR`, ver `Architecture.md` Sección 4.6). Único punto bloqueante restante para el backend de la Bandeja: decidir si se reimplementa el patrón en un repo nuevo o se extiende `sap_data_access` (piloto existente que ya lo implementa) — a resolver con Stefano/Germán. Cliente 360 no tiene bloqueantes de este tipo. Pendiente también: checklist completo del Módulo 4 (Twilio/M365), spike de autenticación (JWT manual, no Easy Auth v1), y definición de superposición con el sistema "POC" antes de tocar el CRM de Cobranza.

**Orden de construcción:** 1) Cliente 360 → 2) Bandeja de Autorización de Pedidos → 3) Hub Omnicanal. (CRM de Cobranza: pausado, ver `Decisions.md` 09/09/2026.)

**Principio rector:** Determinístico donde se pueda. Agéntico donde aporte valor. Humano donde sea consecuente.

## Dónde está cada cosa

- **`Discovery.md`** — todo lo relevado: hallazgos, evidencia cuantitativa, candidatos de automatización, preguntas pendientes, datos sensibles. Se edita en el lugar, no se versiona.
- **`Plan.md`** — alcance vigente, orden de construcción del MVP, supuesto tecnológico preliminar, backlog priorizado, roadmap por etapas.
- **`Decisions.md`** — historial de decisiones, append-only. Consultar antes de asumir que algo "quedó abierto" — puede que ya se haya decidido acá.
- **`Architecture.md`** — creado 16/09/2026, tras aviso explícito de madurez (I.4). Cubre Cliente 360 y Bandeja de Autorización (modo lectura); Hub Omnicanal solo como esqueleto preliminar. Contiene el contrato técnico completo de SAP Service Layer ya validado (sesión, esquema de `BusinessPartners`/`Orders`/`Invoices`, fórmula propuesta de crédito disponible) y la lista de puntos abiertos, con el mecanismo de escritura a SAP marcado como bloqueante único.
- **Demo HTML** (`Pontyn_CC_MVP_Maqueta_Demo.html`) — maqueta interactiva de validación de requerimientos. Se sigue ajustando versión a versión a medida que el descubrimiento avanza; no es el producto final.
- **Checklist de datos y accesos** (`Pontyn_CC_Checklist_Datos_y_Accesos.md`) — qué falta pedir a Germán/Stefano/Karen para empezar a construir, organizado por módulo y prioridad.

## Personas clave

Stefano (Dirección) · Rosina y Claudia (supervisión) · Lorena, Sabrina, Monserrat (equipo operativo) · Karen (categorización, referencia manual) · Germán (estructura interna de SAP) · Nicolás (POC, cobranza) · Jorge (autoriza excepciones +60 días) · Alejandro (rediseño contable de resguardos) · María (referente de cartas).

## Snapshot histórico

El descubrimiento vivía antes en `Pontyn_Descubrimiento_Cuentas_Corrientes_Resumen_Ejecutivo_v2.md` (resumen ejecutivo tipo reporte). Ese archivo queda como snapshot al 08/09/2026; el contenido vigente y editable de acá en más es `Discovery.md`.
