# Plan — Cuentas Corrientes y Cobranzas

**Proyecto:** Automatización Empresarial con IA Agéntica — Pontyn
**Sector:** Cuentas Corrientes y Cobranzas
**Última actualización:** 16/09/2026 (motor de base confirmado + estrategia de validación técnica en paralelo — ver `Discovery.md` §15)
**Estado:** Roadmap vigente. Construcción del MVP en arranque — ver checklist de datos y accesos (`Pontyn_CC_Checklist_Datos_y_Accesos.md`).

> Para el detalle de hallazgos y evidencia que sustenta este plan, ver `Discovery.md`. Este archivo no repite esa evidencia — solo el alcance, la secuencia y las decisiones de ejecución.

## 1. Alcance vigente

Plataforma web complementaria a SAP (nunca lo reemplaza), con tres capas: Cliente 360, Workflow/CRM de autorización y cobranza, y Hub Omnicanal. Arquitectura de referencia: bandeja de aprobación tipo Contaduría (cola de trabajo → contexto → aprobar/rechazar/escalar → auditoría).

## 2. Orden de construcción confirmado del MVP

Definido con Stefano — supersede, para efectos de secuencia de construcción, al listado MVP 1–6 de la Sección 4 (que sigue vigente como visión de mediano plazo):

1. **Vista Cliente 360** — primero.
2. **Bandeja de Autorización de Pedidos**.
3. **Hub Omnicanal de comunicación**.

**Nota:** el CRM de Cobranza (contactos, promesas de pago, seguimiento) queda **pausado** por ahora. Ya existe un sistema de preventa llamado "POC" que hoy maneja parte de esta gestión, y no se quiere solapar esfuerzo hasta tener claro el alcance de cada uno. Retomar esta definición antes de iniciar la construcción del CRM.

Esto significa que en el Hub Omnicanal (Fase 3), la sección de "próxima acción sugerida" ligada a promesas de pago va a quedar más liviana hasta que se resuelva el punto anterior — no es un problema de alcance del MVP, solo una dependencia a tener presente.

## 3. Supuesto tecnológico preliminar

**SUPERADO 16/09/2026 — ver `Architecture.md`.** Esta sección se mantiene como snapshot histórico de lo que se asumía antes de la validación técnica real; el contrato confirmado (contrato de sesión, esquema de `BusinessPartners`/`Orders`/`Invoices`, fórmula propuesta de crédito disponible, y la lista completa de puntos abiertos) vive ahora en `Architecture.md`, Secciones 4 y 9.

- **Acceso a SAP:** Service Layer (API REST de SAP B1), mismo patrón que el proyecto `cfe-review` de Contaduría. **Motor de base: SAP HANA (confirmado).** Contrato de sesión y catálogo de entidades ya documentados por precedente técnico y por el `$metadata` real (ver `Discovery.md` §15) — pendiente de confirmar con Germán únicamente: qué IP es el ambiente de test vigente, habilitación real de `/SQLQueries`, y el mecanismo exacto de bloqueo por crédito en pedidos (candidato identificado: `AuthorizationStatus`).
- **Estrategia de validación:** en paralelo a lo que se le pregunta a Germán, validar contra el Service Layer real (Postman u otra herramienta HTTP) las hipótesis que no requieren escritura, para no bloquear el avance a la espera de una respuesta completa — detalle en `Discovery.md` §15.6.
- **WhatsApp:** Twilio.
- **Email:** Microsoft 365 / Graph API — a confirmar si reutiliza `email_sender.py` ya existente o requiere una nueva app registration.
- **Posible repo:** evaluar con Germán si esta integración se suma al proyecto GitLab `Sap_data_access` ya existente, en vez de crear un repo nuevo — pendiente de confirmación.
- **Línea base general:** se mantiene la Sección 1.1 de las instrucciones del proyecto (Azure Functions v2, Python 3.12, Entra ID/MSAL) salvo que surja justificación de excepción.

## 4. Plataforma web vs. automatizaciones puntuales

No existe una contradicción entre desarrollar quick wins y construir la plataforma.

Se recomienda trabajar con dos horizontes paralelos.

### Track A — Quick wins

Ejemplos:

- tolerancias;
- reporte de pedidos pendientes;
- adjuntos/cartas;
- template/reconciliación masiva cuando esté claramente definido;
- correcciones de comunicaciones;
- mejoras puntuales de datos.

### Track B — Plataforma Web

Construcción incremental:

#### MVP 1
Cliente 360 + pedidos bloqueados.

#### MVP 2
Workflow de autorización móvil y auditable.

#### MVP 3
CRM de cobranza + promesas de pago.

#### MVP 4
Hub Omnicanal.

#### MVP 5
Recuperación de deuda.

#### MVP 6
Integraciones operativas adicionales:
- resguardos;
- conciliaciones;
- depósitos;
- portales;
- adjuntos;
- tareas internas.

La plataforma debe crecer porque los workflows demuestran valor, no porque se intente anticipar todas las funciones futuras.

---

## 5. Priorización preliminar actualizada

| Prioridad | Candidato | Evidencia / razón |
|---|---|---|
| **P0** | Corregir lógica de categorización / tolerancias | Puede reducir un universo de ~52.500 intervenciones/año |
| **P0** | Corregir reglas/preferencias de comunicación existentes | Evita comunicaciones incorrectas y reclamos |
| **P1** | Plataforma Web — Cliente 360 + pedidos bloqueados | Alto volumen + centralización + base para workflows futuros |
| **P1** | Workflow de autorización móvil/auditable | Simplifica las excepciones que permanezcan |
| **P1** | Resguardos | Dolor explícito; ~120/mes; alta carga manual |
| **P1-P2** | Reconciliación masiva de cadenas | Alto esfuerzo; pagos con cientos de documentos; reglas por cadena |
| **P2** | Identificación de depósitos | ~1.600/mes; ~34% sin aviso externo |
| **P2** | CRM cobranza + promesas | Centraliza seguimiento y permite automatización futura |
| **P2** | Recuperación deuda >60 días | Proceso estructurable y repetitivo |
| **P2** | Hub Omnicanal | Habilitador estratégico del CRM y comunicaciones |
| **Quick win** | Pedidos pendientes por vendedor | Simple, bajo riesgo, poco ahorro unitario |
| **Quick win** | Adjuntos/cartas en órdenes | Mejora pequeña, baja complejidad |
| **Posterior** | Conciliación bancaria | Requiere definir antes modelo de transferencias/cuenta puente |
| **Posterior** | Automatizar referencias comerciales | Falta baseline; costo de fuentes externas |
| **No priorizar** | Reconstruir planilla diaria de cobranza | Solo ~10 min de preparación y funciona razonablemente bien |
| **No priorizar** | Reconstruir control de caja actual | Ya fue simplificado y trabaja por excepción |

Esta priorización es todavía preliminar. El score definitivo requiere completar **tiempo activo, frecuencia, tasa de excepción y costo de error** para los candidatos principales.

---

## 6. Riesgo y autonomía inicial sugerida

| Acción | Riesgo | Nivel inicial |
|---|---|---|
| Consultar Cliente 360 | Bajo | A0/A4 |
| Calcular categoría | Bajo | A4 determinístico |
| Calcular tolerancia propuesta | Bajo | A4 determinístico |
| Aplicar nueva tolerancia | Medio-Alto | A3 |
| Mostrar contexto de pedido | Bajo | A0/A1 |
| Autorizar/desbloquear pedido | Alto | A3 |
| Priorizar cobranza | Bajo | A1/A4 |
| Crear tarea interna | Bajo | A4 |
| Detectar promesa potencial en mensaje | Bajo-Medio | A1 |
| Registrar promesa extraída de texto | Medio | A3 inicialmente |
| Redactar email/WhatsApp | Medio | A2 |
| Enviar comunicación | Medio | A3 inicialmente |
| Identificar depósito con alta confianza | Medio | A1/A3 inicialmente |
| Preparar reconciliación | Bajo-Medio | A2 |
| Ejecutar reconciliación en SAP | Medio-Alto | A3 |
| Preparar agrupación de resguardos | Bajo-Medio | A2 |
| Registrar/contabilizar en SAP | Alto | A3 |

---

## 7. Plan de acción — etapas del roadmap

### Paso 1 — Cerrar baseline de los candidatos principales

Medir específicamente autorizaciones, resguardos, reconciliación de cadenas e identificación de depósitos.

Para cada uno:

- volumen;
- minutos activos;
- excepciones;
- errores;
- reprocesos;
- dependencias.

### Paso 2 — Quick wins paralelos

Evaluar implementación inmediata de:

- reporte de pedidos pendientes del día anterior;
- prueba de adjuntos/cartas por orden;
- correcciones de reglas de comunicación;
- mejoras pequeñas ya identificadas.

### Paso 3 — Tolerancias en modo sombra

Corregir scoring y reglas.

Simular:

```text
pedido bloqueado hoy
vs.
resultado con nueva tolerancia
```

Medir reducción sin modificar SAP.

### Paso 4 — Prototipo de Cliente 360

Primera versión solo lectura con datos reales.

Validar con el equipo:

- información;
- orden;
- filtros;
- usabilidad móvil;
- explicación del bloqueo.

### Paso 5 — Workflow de autorización A3

Agregar aprobación/rechazo mediante herramienta controlada.

Verificar resultado en SAP y auditar.

### Paso 6 — Diseño detallado de resguardos

Mapear reglas antes de desarrollar.

No repetir el error de automatizar una carga masiva que multiplique recibos.

### Paso 7 — Piloto de reconciliación de una cadena

Elegir una cadena con reglas simples, construir el flujo completo y medir.

### Paso 8 — CRM + Hub Omnicanal

Incorporar progresivamente gestiones, promesas, tareas, comunicaciones, preferencias e historial.

---

