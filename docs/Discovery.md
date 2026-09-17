# Discovery — Cuentas Corrientes y Cobranzas

**Proyecto:** Automatización Empresarial con IA Agéntica — Pontyn
**Sector:** Cuentas Corrientes y Cobranzas
**Última actualización:** 16/09/2026 (aporte técnico de Líber — integración SAP Service Layer, incluye ronda 1 de validación real contra el ambiente productivo vía Postman, ver Sección 15; sin nueva reunión de relevamiento)
**Estado:** Descubrimiento en curso. MVP en arranque de construcción (ver `Plan.md`) — esto no cierra el descubrimiento, que sigue integrando ajustes según I.6 de las instrucciones del proyecto. La Sección 15 es un ejemplo de ese principio: investigación técnica entre reuniones, no derivada de una entrevista con el sector.

> Este archivo reemplaza a `Pontyn_Descubrimiento_Cuentas_Corrientes_Resumen_Ejecutivo_v2.md` como fuente consolidada. Esa versión queda como snapshot histórico; de acá en más, este archivo se edita en el lugar (no se versiona como v3, v4...).

## 1. Objetivo del relevamiento

El objetivo de las sesiones fue comprender cómo trabaja actualmente el sector de Cuentas Corrientes y Cobranzas, identificar tareas manuales y repetitivas, revisar automatizaciones ya existentes y detectar oportunidades concretas de mejora.

El relevamiento muestra un sector con procesos operativos relevantes distribuidos entre SAP Business One, Query Manager, SharePoint, carpetas de red, Excel, correo electrónico, WhatsApp, Teams, teléfono, portales web de clientes/cadenas, DGI y plataformas vinculadas a documentación fiscal/electrónica.

La intención no es automatizar indiscriminadamente cada tarea. El enfoque recomendado es:

> **eliminar primero trabajo repetitivo y de baja ambigüedad, centralizar la operación y reservar para humanos las decisiones financieras, crediticias o excepcionales.**

La segunda reunión agregó evidencia cuantitativa y permitió distinguir mejor entre procesos ya razonablemente optimizados, quick wins simples, workflows de alto volumen y oportunidades estratégicas que deberían converger en una plataforma web operativa.

---

## 2. Principales procesos identificados

1. Autorización de pedidos bloqueados por deuda vencida.
2. Categorización de clientes y definición de tolerancias.
3. Gestión diaria de cobranzas y seguimiento de deuda.
4. Gestión de compromisos o promesas de pago.
5. Recuperación de deuda de mayor antigüedad.
6. Atención de consultas de clientes, vendedores y camioneros.
7. Envío y gestión de estados de cuenta.
8. Identificación de depósitos y transferencias.
9. Preparación e ingreso de recibos.
10. Control de caja y conciliación con Tesorería.
11. Gestión e ingreso de resguardos.
12. Conciliación y análisis de cuentas de cadenas.
13. Reclamos en portales web de cadenas y seguimiento de notas de crédito.
14. Conciliaciones bancarias y cuentas puente.
15. Referencias comerciales y autorizaciones de crédito.
16. Gestión de cheques rechazados.
17. Reporte diario de pedidos pendientes de emitir por vendedor.
18. Reportes periódicos de cobranza, recuperación y morosidad.
19. Procesos de cierre, conciliación de mayores, circularización e incobrables.
20. Gestión de cartas/documentación asociada a pedidos.
21. Comunicación interna con vendedores para resolver excepciones.

---

## 3. Evidencia cuantitativa incorporada en la segunda reunión

### 3.1 Autorización de pedidos

**HECHO**

En un año móvil se registraron aproximadamente:

> **52.500 órdenes/pedidos bloqueados que requirieron interacción del sector para autorizar o rechazar.**

No representan el total de pedidos de la empresa, sino los casos que quedaron bloqueados y necesitaron intervención. La medición corresponde a un año móvil (aprox. 01/09 del año anterior al 30/08 de este año), tomado de un log de modificaciones de pedidos autorizados.

El tiempo por caso es muy variable: algunos casos requieren prácticamente un clic; otros requieren revisar antecedentes; múltiples órdenes del mismo cliente pueden resolverse en una misma evaluación; y determinados casos pueden requerir varios minutos o una investigación mayor.

**A CONFIRMAR — unidad de medida:** en la reunión se aclaró que "pedido" y "orden" no son sinónimos en este conteo: un mismo cliente puede tener varias órdenes bloqueadas que constituyen un solo "pedido", pero la interacción real son las liberaciones de cada orden. No quedó explícito si los 52.500 corresponden a pedidos (agrupados por cliente) o a liberaciones/órdenes individuales. Esto debe aclararse antes de fijar el KPI principal del proyecto, porque cambia sustancialmente la lectura del volumen.

**HECHO — estacionalidad:** las autorizaciones fuera de horario tienen un promedio de referencia de ~80 por mes durante el año, pero en diciembre del año anterior se registró un pico de ~300. Esto sugiere que la necesidad de cobertura fuera de horario no es constante, sino fuertemente estacional (fin de año).

**A CONFIRMAR:** en un momento de la reunión se mencionó también una cifra de ~59.000 (en el contexto de cuánto podría bajar con el día de tolerancia), que no coincide exactamente con las 52.500 reportadas formalmente. Podría tratarse de una aproximación informal sobre el mismo universo, o de un período/corte ligeramente distinto — se recomienda confirmar con el equipo cuál es la cifra de referencia correcta antes de fijarla como baseline.

**REFERENCIA INFORMAL (no es medición formal):** durante la reunión se hizo un cálculo aproximado en el momento — del orden de 3 minutos promedio por orden sobre 52.000 casos equivaldría a unas 300 jornadas laborales al año. Esta cuenta se ofreció como una forma rápida de dimensionar el orden de magnitud, no como una medición de tiempo activo real, que sigue siendo un dato pendiente (ver sección 15) dada la variabilidad ya señalada (de un clic a más de una hora por caso).

**INFERENCIA**

Aunque todavía falta medir tiempo activo promedio, el volumen confirma que este es uno de los procesos de mayor escala del sector.

La oportunidad no consiste únicamente en hacer más rápida la pantalla de aprobación, sino en:

1. **evitar bloqueos innecesarios mediante reglas de tolerancia;**
2. **presentar el contexto completo del cliente en una vista única;**
3. **convertir los casos restantes en un workflow de aprobación simple, móvil y auditable.**

---

### 3.2 Depósitos y transferencias

**HECHO**

Se reportaron aproximadamente:

- **1.600 depósitos/transferencias por mes**;
- **1.058 con aviso externo** de cliente o vendedor;
- aproximadamente **66% llegan con aviso**;
- por lo tanto, alrededor de un tercio requiere identificación o investigación adicional.

**INFERENCIA**

La identificación de depósitos tiene volumen suficiente para justificar un análisis específico de automatización.

La mejora debería enfocarse primero en matching determinístico por monto, fecha, banco, referencia, cliente, recibos y comportamiento histórico del pagador.

La IA solo debería intervenir, si fuese necesaria, para interpretar referencias textuales ambiguas.

---

### 3.3 Recibos de Tesorería

**HECHO**

Se informaron aproximadamente:

> **1.670 recibos mensuales provenientes de Tesorería que se procesan mediante template.**

El proceso ya cuenta con mejoras respecto del método anterior, por lo que no debe asumirse que todo el volumen representa trabajo manual.

---

### 3.4 Resguardos

**HECHO**

Se procesan aproximadamente:

> **120 resguardos por mes, considerando moneda local y moneda extranjera.**

El proceso continúa requiriendo comparación de retenciones, validación contra información fiscal, ingreso, tratamiento diferente según moneda, emisión manual de recibos y conciliación posterior.

Los resguardos en dólares requieren tratamiento individual por diferencias de tipo de cambio, mientras que en pesos pueden agruparse múltiples resguardos en un único recibo. También existen resguardos positivos y negativos que deben compensarse correctamente.

**CONCLUSIÓN**

El dolor no está solamente en “cargar masivamente” el resguardo. Una automatización mal diseñada puede aumentar el trabajo si genera un recibo por cada resguardo cuando hoy varios resguardos pueden consolidarse en uno.

Este proceso requiere primero modelar correctamente la lógica de negocio.

---

## 4. Hallazgos principales

### 4.1 Plataforma Web de Cuentas Corrientes — oportunidad estratégica confirmada

**PROPOSED / VALIDADA COMO DIRECCIÓN DE TRABAJO**

La segunda reunión refuerza la conveniencia de desarrollar una **Plataforma Web de Cuentas Corrientes y Cobranzas**, complementaria a SAP.

El objetivo no es reemplazar SAP B1. SAP debe continuar siendo el sistema financiero y transaccional autoritativo.

La plataforma web funcionaría como una:

> **capa operativa, CRM de cobranza, workflow de decisiones y hub de comunicaciones sobre SAP.**

La necesidad surge porque buena parte del proceso actual se encuentra distribuida entre SAP, Excel, SharePoint, carpetas, portales externos y canales de comunicación.

La plataforma permitiría incorporar funcionalidades de forma incremental sin intentar construir un nuevo ERP.

---

### 4.2 Arquitectura funcional propuesta

```text
                              SAP BUSINESS ONE
                                     │
                         Datos financieros autoritativos
                                     │
                                     ▼
                 PLATAFORMA WEB CUENTAS CORRIENTES
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
   CLIENTE 360                WORKFLOWS / CRM              HUB OMNICANAL
        │                            │                            │
 saldos / deuda               pedidos bloqueados            Email
 vencimientos                 autorizaciones                WhatsApp
 documentos                   promesas de pago              Teléfono*
 crédito                      recuperación de deuda         Portales**
 comportamiento               tareas                       historial
 categoría                    seguimiento                  preferencias
 tolerancia                   adjuntos                     comunicaciones
        │                            │                            │
        └────────────────────────────┼────────────────────────────┘
                                     ▼
                              MOTOR DE REGLAS
                  categorías / tolerancias / políticas
                                     │
                                     ▼
                     HERRAMIENTAS CONTROLADAS SOBRE SAP
```

\* Inicialmente una llamada puede registrarse como actividad sin integrar telefonía.  
\** Integrar portales de terceros únicamente donde sea estable, permitido y económicamente justificable.

La comunicación interna con vendedores por Teams puede vincularse al mismo workflow, pero debe tratarse como **colaboración interna**, separada del Hub Omnicanal orientado al cliente.

---

### 4.3 Primer MVP sugerido: Cliente 360 + Pedidos Bloqueados + Autorización

**RECOMENDACIÓN**

El primer MVP debería seguir siendo acotado:

> **Cliente 360 + cola de pedidos bloqueados + autorización.**

La ficha debería mostrar:

- cliente consolidado;
- deuda total;
- deuda vencida;
- antigüedad;
- documentos vencidos;
- condiciones de crédito;
- comportamiento histórico de pago;
- categoría;
- tolerancia;
- promesas de pago;
- gestiones recientes;
- pedidos bloqueados;
- adjuntos relevantes;
- explicación determinística del motivo del bloqueo.

Acciones iniciales:

- **Aprobar**
- **Rechazar**
- **Escalar**

Toda acción debe registrar usuario, fecha/hora, datos utilizados, regla aplicada, motivo, resultado, referencia en SAP y verificación.

La interfaz debe ser responsive para que el proceso no dependa de una sesión completa de SAP en una PC.

---

### 4.4 Categorización y tolerancias: primera palanca para reducir volumen

**HECHO**

La categorización de clientes y la definición de tolerancias ya habían sido trabajadas parcialmente.

La segunda reunión reafirmó que este punto puede generar una reducción directa de pedidos que hoy se bloquean sin necesidad real de intervención.

**RECOMENDACIÓN**

Antes de automatizar desbloqueos:

1. corregir la lógica de comportamiento de pago;
2. validar el tratamiento de notas de crédito;
3. consolidar correctamente las cuentas del mismo cliente;
4. comparar clasificación automática vs. evaluación manual;
5. ejecutar en modo sombra;
6. medir cuántos de los 52.500 casos se habrían evitado sin aumentar riesgo.

La categorización debe ser determinística, explicable, configurable y auditada. No debe ser una decisión opaca de un LLM.

**Actualización técnica 16/09/2026:** se identificaron dos UDFs concretos en `BusinessPartner` que podrían ser la base técnica de este punto — `U_ClasifClienteCC` (categoría) y `U_DiasToleranciaCC` (tolerancia). Todavía no confirmado si son la fuente activa o si están conectados a la lógica de bloqueo. Detalle y próximos pasos en Sección 15.7.

---

### 4.5 Regla crítica: consolidación C1 / C2

Toda lógica de Cuentas Corrientes a nivel cliente debe respetar la regla existente de Pontyn:

> **Los registros C1-, C2- y C3- correspondientes al mismo cliente deben consolidarse por `Numero_SN`.**

**ACTUALIZADO 16/09/2026 — CONFIRMADO por Líber:** `C3-` corresponde a moneda Euro, y sí participa de la consolidación por `Numero_SN` junto con C1- (pesos) y C2- (dólares). La regla queda en tres monedas, no dos — corregir cualquier lógica o documentación que asuma solo C1-/C2-.

La ficha Cliente 360 debe mostrar primero la exposición consolidada y permitir luego abrir el detalle por moneda/cuenta/documento.

Esta regla aplica especialmente a deuda, comportamiento de pago, categorización, tolerancia, promesas, priorización de cobranza, comunicaciones y acciones sobre el cliente.

**HECHO (16/09/2026, confirmado por Líber):** `C3-` es moneda Euro y participa de la consolidación por `Numero_SN` junto con C1-/C2- (ver corrección arriba). Sigue pendiente confirmar si hay más prefijos además de estos tres.

---

### 4.6 Gestión diaria de cobranza: proceso bastante optimizado, no primer candidato

**HECHO**

El equipo arma diariamente una planilla utilizando dos reportes de SAP y fórmulas ya preparadas.

La preparación de la planilla toma aproximadamente:

> **10 minutos como máximo.**

La herramienta ya centralizó información que anteriormente estaba distribuida en varias planillas y registros manuales.

Los clientes con estados de cuenta manuales son relativamente pocos y suelen permanecer manuales por condiciones específicas como día/hora particular, formato especial, necesidad de adjuntar notas de crédito, gestión por una persona determinada, pago diferido o exigencia de recibir el estado aunque no haya cambios.

**CONCLUSIÓN**

No conviene priorizar una reconstrucción completa de esta planilla únicamente para ahorrar esos minutos.

Sí conviene que, a largo plazo, sus datos y reglas migren a la plataforma web para preservar el historial, eliminar dependencia de Excel, alimentar el CRM, generar tareas y relacionar comunicaciones y promesas.

Es un buen ejemplo del principio:

> **no automatizar por automatizar una tarea que ya funciona razonablemente bien.**

---

### 4.7 CRM de cobranza y promesas de pago

**HECHO**

El sector registra observaciones de semanas anteriores, fechas coordinadas de pago, agenda de cobranzas, información que luego se entrega a Nicolás para organizar las cobranzas y seguimientos específicos por cliente.

Parte de esta información se traslada manualmente entre planillas.

**RECOMENDACIÓN**

La plataforma debería incorporar un objeto explícito de:

> **Gestión / Promesa de Pago**

con cliente, fecha del contacto, canal, responsable, compromiso, fecha prometida, importe/documentos, próxima acción, estado y resultado.

Esto permitiría automatizar:

```text
promesa registrada
      ↓
esperar fecha
      ↓
verificar pago
      ↓
cumplida → cerrar
incumplida → crear seguimiento
```

---

### 4.8 Recuperación de deuda >60 días

**HECHO**

Existe un circuito separado para clientes con más de 60 días de atraso.

Actualmente se utilizan reportes (elaborados junto con Karen), una línea de comunicación específica (un segundo teléfono dedicado), cartas predefinidas, acuerdos de pago, recordatorios semanales y escalamiento según antigüedad y situación.

El equipo ya utiliza comunicaciones diferenciadas según el nivel de atraso. Los casos de deuda vencida sin justificación pueden requerir una autorización puntual de excepción (se mencionó a Jorge como quien autoriza estas excepciones); se recomienda documentar explícitamente ese criterio para poder representarlo como regla en el futuro workflow.

**HECHO — evidencia reciente de volumen:** en una revisión reciente de este circuito, de las órdenes evaluadas para liberación por deuda +60 días, se identificaron del orden de 37 liberadas, de las cuales 7 requirieron una carta adjunta. La cifra exacta (si corresponde a "pedidos" u "órdenes") quedó ambigua en la conversación, pero confirma que es un circuito de bajo volumen absoluto — consistente con la recomendación de tratarlo como workflow acotado y no como prioridad de automatización masiva.

**OPORTUNIDAD**

Este proceso es un buen candidato para un workflow gobernado:

```text
detectar deuda según política
      ↓
excluir casos justificados/autorizados
      ↓
clasificar tramo
      ↓
mostrar antecedentes
      ↓
preparar comunicación
      ↓
aprobación cuando corresponda
      ↓
enviar
      ↓
registrar compromiso
      ↓
recheck
```

Inicialmente:

- detección: A4 determinístico;
- priorización: A1/A4;
- redacción: A2;
- envío externo: A3.

---

### 4.9 Hub Omnicanal de comunicación

**PROPOSED**

La plataforma debería incorporar progresivamente un **Hub Omnicanal**.

Su objetivo no es simplemente “enviar WhatsApps desde una web”, sino mantener una conversación operativa única por cliente.

Canales iniciales recomendados:

- email;
- WhatsApp;
- llamadas registradas;
- eventualmente integración con portales de clientes cuando exista valor claro.

Debe registrar mensajes enviados, respuestas, adjuntos, estados de cuenta, compromisos, responsable, próxima acción, preferencias y restricciones del canal.

La segunda reunión confirma que las reglas de comunicación varían significativamente entre clientes, por lo que deben existir políticas configurables por cliente.

---

### 4.10 Preferencias y reglas de comunicación

No todos los clientes deben recibir la misma comunicación de la misma forma.

La plataforma debería modelar, por ejemplo:

```text
Cliente X
Estado de cuenta automático: SÍ
Canal: Email
Día: lunes
Requiere envío aunque no haya cambios: SÍ

Cliente Y
Estado de cuenta automático: NO
Gestión: manual
Canal: teléfono
Día de cobro: miércoles

Cliente Z
Canal principal: WhatsApp
Enviar solo con deuda vencida: SÍ
```

La lógica de elegibilidad del envío debe ser determinística.

El LLM puede redactar o resumir, pero no decidir libremente a quién contactar ni por qué canal.

---

## 5. Segundo gran candidato: depósitos e identificación

### 5.1 Volumen

Con aproximadamente **1.600 depósitos mensuales**, y solo 66% acompañados por aviso externo, la identificación de depósitos presenta una oportunidad relevante.

### 5.2 Enfoque recomendado

No comenzar con un “agente”.

Primero construir matching determinístico y scoring de confianza:

```text
depósito bancario
     ↓
referencia / monto / fecha / banco
     ↓
buscar candidatos
     ↓
match fuerte → sugerir identificación
match ambiguo → enviar a revisión
sin match → depósitos sin identificar
```

Se puede utilizar comportamiento histórico del cliente para mejorar el matching, siempre de forma explicable.

---

## 6. Resguardos — candidato prioritario con reglas especiales

### 6.1 Problema actual

El proceso de resguardos combina obtención de información fiscal, comparación con lo registrado, validación de retenciones, tratamiento por moneda, compensaciones positivas/negativas, ingreso en SAP, emisión manual del recibo y conciliación mensual.

La fuente utilizada operativamente debe validarse por confiabilidad y oportunidad, porque se mencionaron diferencias o demoras entre plataformas.

**A CONFIRMAR — UNFE:** el equipo mencionó reclamos abiertos a UNFE (la plataforma externa vinculada a DGI donde deberían aparecer los resguardos/comprobantes electrónicos) por omisiones y demoras en la disponibilidad de la información. No quedó claro el alcance exacto de esos reclamos ni el tiempo de resolución esperado — se recomienda dar seguimiento explícito como ítem de riesgo, ya que cualquier automatización de resguardos depende de que esta fuente sea confiable y oportuna.

**Ejemplo real que ilustra el riesgo de agrupación (ver 6.2):** se mencionó el caso de un cliente que emite un resguardo por factura (del orden de 300 facturas/resguardos en un mes). Si la automatización generara un recibo por resguardo en lugar de agruparlos, este único cliente multiplicaría por sí solo el trabajo manual en vez de reducirlo.

Para rediseñar el tratamiento contable de resguardos (mientras sigan procesándose como cuenta y no como recibo electrónico) se identificó a Alejandro como referente a involucrar.

### 6.2 Riesgo de automatizar mal

**IMPORTANTE**

La automatización anterior basada en un template no generaba necesariamente ahorro.

Ejemplo:

- en moneda local pueden agruparse muchos resguardos en un recibo;
- si el template crea un recibo por cada resguardo, multiplica el trabajo;
- en moneda extranjera sí puede ser necesario separar por tipo de cambio;
- resguardos negativos requieren compensación.

Por lo tanto, el objetivo correcto no es:

> “subir resguardos masivamente”.

Es:

> **modelar una agrupación óptima y correcta de resguardos y generar la menor cantidad de recibos compatible con la lógica contable/fiscal.**

### 6.3 Próximo paso

Diseñar primero un algoritmo determinístico que responda qué resguardos pueden agruparse, cuáles deben separarse, cómo tratar moneda, tipo de cambio, positivos/negativos, qué cuentas utilizar, cuándo generar un recibo y cómo reconciliar.

Solo después construir la automatización.

---

## 7. Reconciliación de cadenas — candidato de alto valor

**HECHO**

La reconciliación de cadenas fue identificada por el sector como una tarea que consume tiempo.

Los pagos pueden incluir cientos de documentos — se mencionaron casos del orden de **500 documentos**.

El proceso actual incluye:

1. descargar información enviada por la cadena;
2. limpiar/formatear;
3. comparar contra SAP mediante planillas ya preparadas;
4. detectar diferencias;
5. reclamar cuando corresponde;
6. una vez limpia la información, reconciliar en SAP.

Parte del análisis ya está razonablemente resuelto con Excel.

El mayor trabajo residual puede estar en la **reconciliación/carga posterior en SAP**.

### 7.1 Complejidad

Cada cadena tiene reglas distintas: retenciones, notas de crédito, devoluciones, frecuencia de pago, formatos y diferencias esperables. Se mencionó, a modo de ejemplo, un caso de pago mensual de alto volumen y complejidad (una cadena grande, de pago único mensual, que consume bastante tiempo) frente a otras cadenas que pagan semanalmente con procesos más simples.

**RECOMENDACIÓN**

No construir un motor genérico desde el primer día. Evitar elegir como piloto la cadena de mayor volumen/complejidad (pago mensual grande); conviene partir de una cadena de pago semanal y reglas simples, y recién después escalar el patrón a los casos más pesados.

Seleccionar primero una cadena de comportamiento simple y repetible:

```text
cadena piloto
    ↓
normalizar archivo
    ↓
validar contra SAP
    ↓
resolver/excluir diferencias
    ↓
generar reconciliación masiva
    ↓
modo sombra
    ↓
ejecución aprobada
```

Luego reutilizar el patrón para otras cadenas.

---

## 8. Conciliaciones bancarias — oportunidad, pero con dependencia previa

**HECHO**

El sector realiza periódicamente análisis de movimientos pendientes y define cuáles deben pasar a cuentas de depósitos sin identificar.

Una parte importante del problema está relacionada con cobranzas de vendedores y agrupación de múltiples recibos en una transferencia.

**TO VERIFY / DEPENDENCIA**

Antes de automatizar es necesario definir el modelo operativo del recibo electrónico del vendedor:

- ¿una transferencia por recibo?
- ¿una transferencia por varios recibos?
- ¿depósito diario consolidado?
- ¿qué cuenta puente se utilizará?
- ¿cómo se relacionará el depósito con los recibos originales?

**RECOMENDACIÓN**

No automatizar la conciliación bancaria sobre una regla de negocio que todavía está abierta.

Primero definir el proceso futuro y luego automatizarlo.

---

## 9. Quick wins identificados

### 9.1 Pedidos pendientes de emitir por vendedor

**HECHO**

Todos los días se revisan pedidos pendientes, se separan por vendedor y se envía un correo.

El equipo indicó que la tarea es automatizable y no consume demasiado tiempo.

Regla importante:

> El reporte automático debe tomar únicamente lo pendiente del día anterior y ejecutarse después de las verificaciones de Tesorería.

**CLASIFICACIÓN**

Quick win de bajo riesgo y baja complejidad.

No es necesariamente el mayor ahorro del sector, pero puede implementarse rápidamente.

---

### 9.2 Adjuntar cartas/documentos al pedido

**HECHO**

Se planteó utilizar adjuntos de la orden para que Facturación pueda visualizar e imprimir una carta asociada al pedido sin volver a solicitarla al sector.

Las cartas son situaciones puntuales por orden, no atributos permanentes del cliente (ej. un cheque que el camionero debe cobrar puntualmente, no una condición general del cliente).

**HECHO — volumen:** son pocas las cartas que se emiten; en la revisión reciente del circuito de recuperación >60 días, sobre un lote de aproximadamente 37 órdenes liberadas, solo 7 requirieron carta adjunta. Confirma que es una mejora acotada, no un proceso de alto volumen.

**RECOMENDACIÓN**

Probar con una o pocas órdenes (piloto ya en marcha con un adjunto tipo Word) y validar carga, permisos, visualización, impresión y experiencia de Facturación. El referente para coordinar el armado de cartas es María — confirmar con ella el circuito antes de escalar el piloto.

Es una mejora pequeña y de bajo riesgo.

---

### 9.3 Fotos de cheques

Existe una prueba gradual de carga y visualización de fotos/comprobantes, hecha sobre una aplicación interna mencionada como **"POC"** (aparentemente una prueba de concepto ya en uso operativo, no solo una maqueta) que Nicolás utiliza para el seguimiento de cobranza y en la que también se está probando la carga de fotos de cheques.

**A CONFIRMAR:** el alcance exacto de "POC" —qué datos maneja hoy (fechas de pago acordadas, referencias de clientes, fotos de comprobantes), quién la mantiene y si es la base sobre la que debería construirse el Cliente 360/CRM, o una herramienta paralela a reemplazar— no quedó claro en la reunión y conviene relevarlo antes de avanzar con el MVP, para no duplicar esfuerzo.

Se recomendó continuar con pocas operaciones por día hasta confirmar tiempo de disponibilidad, permisos, visualización y estabilidad (se reportó que las fotos a veces tardan en aparecer, posiblemente por permisos o tiempos de carga).

No requiere una solución nueva mientras la prueba actual pueda validar el flujo.

---

## 10. Procesos que no conviene priorizar ahora

### 10.1 Preparación de la planilla diaria de cobranza

La preparación toma aproximadamente 10 minutos y el equipo considera que funciona bien.

No es buen candidato inmediato por ahorro.

### 10.2 Control de caja

El proceso ya fue simplificado de manera importante mediante cruces y fórmulas.

Ahora se revisan excepciones en lugar de controlar recibo por recibo.

Conviene preservar esta mejora y no reconstruirla salvo que aparezca una necesidad concreta de integración.

### 10.3 Referencias comerciales

Existe potencial de automatización de consultas externas, pero hay costo por consulta en determinadas fuentes, la consulta no elimina el criterio crediticio humano y el volumen/tiempo aún no están medidos.

Mantener en backlog hasta medir valor.

---

## 11. Qué debe ser determinístico, qué puede usar IA y qué debe quedar humano

### Determinístico

- saldos;
- vencimientos;
- antigüedad;
- condiciones de crédito;
- consolidación por `Numero_SN`;
- clasificación basada en reglas;
- cálculo de tolerancia;
- detección de pedido bloqueado;
- detección de promesa vencida;
- matching de depósitos;
- preparación de reconciliaciones;
- reglas de agrupación de resguardos;
- validación de preferencias de canal;
- controles de permisos;
- políticas de aprobación.

### IA / LLM

Solo donde agregue valor:

- resumir antecedentes;
- sintetizar conversaciones;
- redactar comunicaciones;
- interpretar texto libre;
- detectar una posible promesa de pago;
- sugerir próxima acción;
- priorizar una cola dentro de reglas;
- explicar excepciones complejas para revisión humana.

### Humano

Inicialmente:

- autorización sensible de pedidos;
- cambios de crédito;
- excepciones de tolerancia;
- decisiones de recuperación relevantes;
- acuerdos de pago no estandarizados;
- comunicaciones delicadas;
- resolución de diferencias no explicadas;
- contabilizaciones o cambios de alto impacto.

---

## 12. Preguntas pendientes

### Autorización y tolerancias

- ¿Qué porcentaje de los 52.500 casos corresponde a clientes repetidos?
- ¿Cuántos bloqueos se producen por pocos días de atraso?
- ¿Cuántos se autorizan finalmente?
- ¿Cuántos se rechazan?
- ¿Cuál es la distribución real del tiempo por caso?
- ¿Qué reglas permiten liberar sin intervención?
- ¿Qué monto/exposición obliga a aprobación?
- ¿La cifra de 52.500 corresponde a "pedidos" agrupados por cliente o a "órdenes"/liberaciones individuales? Definir la unidad de medida antes de fijarla como KPI base.
- ¿Cuál es la cifra correcta de referencia: 52.500 (reportada formalmente) o ~59.000 (mencionada informalmente)? ¿Son el mismo universo en períodos distintos?
- ¿A qué corresponde exactamente el "14%" mencionado junto con la posibilidad de reautorización? (contexto insuficiente en la reunión)
- Dado el pico de diciembre (~300 fuera de horario vs. ~80 promedio), ¿conviene una solución de cobertura estacional (ej. bandeja web temporal) en lugar de dimensionar todo el año para el pico?
- ¿Qué autoridad/criterio exacto aplica Jorge para autorizar excepciones en deuda sin justificación, y puede convertirse en una regla explícita?
- ¿El campo/mecanismo que marca un pedido como "bloqueado por crédito" en SAP corresponde a `AuthorizationStatus` (Procedimientos de Aprobación estándar) o a otra lógica? Hipótesis técnica y evidencia de esquema en Sección 15 — a confirmar con Germán o probando contra el ambiente real.

### Resguardos

- ¿Cuál es la fuente autoritativa y más oportuna?
- ¿Qué campos se requieren para automatizar el ingreso?
- ¿Cómo agrupar resguardos en pesos?
- ¿Cómo separar los de dólares por tipo de cambio?
- ¿Cómo compensar positivos y negativos?
- ¿Puede evitarse la emisión manual del recibo?
- ¿Qué cambios contables o de configuración serían necesarios? (coordinar con Alejandro)
- ¿Qué parte puede resolverse con template y qué parte exige desarrollo?
- ¿Cuál es el estado y plazo esperado del reclamo abierto con UNFE por omisiones/demoras?

### Cadenas

- ¿Qué cadenas tienen proceso más simple?
- ¿Qué formatos entrega cada una?
- ¿Qué reglas de retención aplica?
- ¿Cómo aparecen notas de crédito/devoluciones?
- ¿Qué porcentaje de pagos llega sin diferencias?
- ¿Cuál sería la mejor cadena piloto?

### Depósitos

- ¿Qué porcentaje del ~34% sin aviso puede identificarse por referencia?
- ¿Cuáles son los principales patrones de identificación?
- ¿Cuánto tiempo consume hoy la investigación?
- ¿Qué porcentaje queda definitivamente sin identificar?

### CRM / Hub Omnicanal

- ¿Qué datos de gestión deben migrar de las planillas?
- ¿Qué constituye una promesa de pago?
- ¿Qué estados debería tener?
- ¿Qué comunicaciones pueden automatizarse?
- ¿Qué canales son permitidos por cliente? Candidatos técnicos identificados: UDFs `U_WhatsappCC`/`U_EmailCC` en `BusinessPartners` — ver Sección 15.
- ¿Cómo integrar conversaciones internas con vendedores sin mezclar canales externos?
- ¿Qué es exactamente "POC" (la app que usa Nicolás), qué datos maneja hoy y debería absorberse dentro de la Plataforma Web o reemplazarse por ella?

---

## 13. Datos sensibles identificados (Ley N.° 18.331)

Registrado según I.10 de las instrucciones del proyecto — contexto de negocio únicamente, no insumo para decisiones de personal.

- **Comentarios de desempeño y posibles desvinculaciones** (reunión 03/09): se mencionó evaluar el desempeño de dos colaboradoras del sector y la posibilidad de desvinculación. Tratado exclusivamente como contexto que explica la urgencia de priorización — la decisión es de la Dirección y RRHH, fuera del alcance de este documento. No repetir fuera de la Dirección/el sector involucrado.
- **Datos de clientes con deuda vencida**: nombres, saldos y comportamiento de pago de clientes de Pontyn. De uso interno para el diseño del MVP; cualquier copia de datos reales a un ambiente de desarrollo debe hacerse a un entorno separado (no al equipo de máquinas locales), y no debe circular fuera del equipo del proyecto.
- **Antecedentes de incumplimiento** (cheques rechazados, reclamos): tratar con el mismo criterio que la deuda vencida — dato operativo necesario para el diseño, no para difusión.

## 14. Fuentes analizadas y nota de calidad

- Documento de tareas del sector: `Cuentas Corrientes y Cobranzas.docx`
- Reunión de relevamiento inicial — 03–04/09/2026 (recaps y transcripciones)
- Segunda reunión de relevamiento — 07/09/2026 (recap y **transcripción completa**, cotejada el 08/09/2026)
- Handoff técnico del proyecto "AI Automation - Contaduría" (piloto `cfe-review-api`, mismo SAP de Pontyn) y `$metadata` real del Service Layer (`sap_b1_sl_metadata.xml`, 327 EntitySets) — aportados por Líber el 16/09/2026. Ver Sección 15.

**Nota de calidad de la fuente:** la transcripción del 07/09 tiene tramos con hablantes no identificados y pasajes con errores de reconocimiento de voz (nombres y números parcialmente audibles). Los datos cuantitativos citados en este documento (52.500, 1.600, 1.058/66%, 1.670, 120, el pico de diciembre, y el ejemplo de 37/7 en cartas) se transcriben tal como fueron enunciados por el equipo; donde hubo ambigüedad de unidad o una cifra contradictoria (52.500 vs. ~59.000; el "14%"), se marcó explícitamente como pendiente de confirmar, en vez de resolverse por inferencia.

---

## 15. Anexo técnico — Integración con SAP Business One (Service Layer)

**Origen de este anexo:** aporte técnico de Líber (16/09/2026), a partir de (a) el handoff del proyecto "AI Automation - Contaduría" (piloto `cfe-review-api`, mismo SAP de Pontyn) y (b) el `$metadata` real del Service Layer de Pontyn (`sap_b1_sl_metadata.xml`, 327 EntitySets / 297 EntityTypes), inspeccionado directamente contra el archivo. No proviene de una reunión de relevamiento con el sector — es investigación técnica en paralelo, consistente con I.6 (el relevamiento es evolutivo, no depende solo de reuniones).

### 15.1 Motor de base de datos

**HECHO (confirmado por Líber):** SAP Business One de Pontyn corre sobre **SAP HANA**. Esto habilita `hdbsql` como cliente de línea de comandos si en algún momento se necesita SQL directo contra la base — ver reservas en 15.5 antes de ir por ese camino.

### 15.2 Hallazgos del `$metadata` real (evidencia de esquema, no de configuración)

Importante: lo que sigue confirma que un campo o mecanismo **existe en el esquema** de esta instalación de SAP B1. No confirma que esté **configurado o usado** de la forma que se hipotetiza — eso sigue siendo A CONFIRMAR con Germán o probando contra datos reales.

- **`U_NumeroSN`** (UDF en `BusinessPartners`) — **HECHO**: es el campo técnico exacto detrás de la regla de consolidación C1-/C2- ya documentada en 4.5. No hace falta preguntárselo a Germán.
- **`U_WhatsappCC` y `U_EmailCC`** (UDFs en `BusinessPartners`) — **actualizado el 16/09/2026: CONFIRMADOS como reales, ver 15.7.** Ambos campos existen en el mismo Company DB (pantalla real de SAP, con dato poblado para un cliente de prueba) y en el `$metadata` analizado. El error de Service Layer en la ronda 1 no se debe a una discrepancia de esquema — ver 15.7 para la explicación más probable (caché de Service Layer).
- **Campos estándar de `BusinessPartners`** (sin UDF, sin SQL custom) ya disponibles vía `GET /BusinessPartners`: `CreditLimit`, `CurrentAccountBalance`, `OpenOrdersBalance`, `OpenDeliveryNotesBalance`, `Valid`/`ValidFrom`/`ValidTo`, `Frozen`/`FrozenFrom`/`FrozenTo`/`FrozenRemarks`, `BlockDunning`, `DunningLevel`, `DunningDate`, `PaymentBlock`. **RECOMENDACIÓN:** buena parte de la ficha de crédito de Cliente 360 se puede construir contra OData estándar, sin depender de que `/SQLQueries` esté habilitado. **CORREGIDO 16/09/2026:** `Block` salió de esta lista — con datos reales devolvió un string (`"SAN LUIS"`, un nombre de zona/sucursal, no `tYES`/`tNO`) para un cliente de prueba real. No es un flag booleano de crédito como sugiere el nombre; no usarlo con ese supuesto. Los booleanos confiables (formato `tYES`/`tNO`, confirmados con datos reales) son `Frozen`, `BlockDunning`, `PaymentBlock`, `Valid`. **RECOMENDACIÓN adicional:** `CreditLimit` puede venir con un valor centinela enorme (`99999999999999.0` visto en un cliente real) para representar "sin límite" — la UI de Cliente 360 tiene que detectar y mostrar esto como "sin límite", no como el número crudo.
- **Mecanismo para "pedido bloqueado por crédito"** (pregunta abierta del checklist, Módulo 3 — ver también Sección 12): **actualizado el 16/09/2026 con dos rondas de datos reales, ver 15.7.** La hipótesis de `AuthorizationStatus` quedó **DESCARTADA**. La hipótesis de `Confirmed`/`U_ConfirmUser` quedó **PARCIALMENTE DESCARTADA**: sin filtrar por `DocumentStatus`, trae pedidos viejos cerrados/cancelados sin relación con crédito — sigue siendo candidato, pero solo combinado con `DocumentStatus eq 'bost_Open'`, y todavía sin un caso real confirmado por el sector. Sigue como pregunta abierta.
- **Categorización de clientes: CONFIRMADO 16/09/2026 vía System Information — el campo es `U_ClasifClienteCC`** (en `BusinessPartner`, no estaba en el `$metadata` original — ver 15.7). La búsqueda inicial en 15.2 no lo encontró por filtrar la palabra "categ" (el campo se llama "Clasificación", no "Categoría") — error de búsqueda, no evidencia de que viviera fuera de SAP. **Todavía no es HECHO que esta sea la fuente autoritativa activa** de la categorización que usa Karen — puede ser el campo que ella actualiza a mano, un cálculo automático (posiblemente con el mismo problema de notas de crédito ya documentado en 4.4), o un campo sin uso real. A confirmar con Karen/Rosina antes de asumir cuál es la fuente de verdad.
- Tampoco se encontró ningún término en español relacionado a bloqueo/crédito/cobranza/mora/vencido como nombre de UDF en ninguna entidad del esquema — si el criterio de bloqueo es custom, no tiene un nombre de campo obvio para buscar.

### 15.3 `/SQLQueries` — estado real

**HECHO (actualizado 16/09/2026, ver 15.7):** `GET /SQLQueries` contra el Company DB real respondió `200` con `{"value": []}` — **está habilitado**, simplemente no hay ninguna query guardada todavía. Si se quiere reutilizar para algo puntual, hay que crearla antes desde el cliente de SAP B1 (Query Generator, con un `SqlCode`) — el endpoint no ejecuta SQL libre.

### 15.4 Referencia técnica de `cfe-review-api` (Contaduría) reutilizable

Del handoff del piloto de Contaduría, aplica igual a Cuentas Corrientes por ser el mismo SAP:

- Contrato de sesión: `POST /Login` → cookies `B1SESSION`/`ROUTEID`, sesión expira a los 25 minutos, un solo login por corrida de proceso batch (no uno por documento).
- SAP Business One **no rechaza duplicados** en escritura — la idempotencia es responsabilidad exclusiva del backend propio, nunca asumir que SAP la resuelve.
- No hay precedente de retry-con-backoff para llamadas HTTP a Service Layer, ni de paginación real (`cfe-review-api` solo hace lecturas puntuales de bajo volumen). Cuentas Corrientes sí va a necesitar paginación real (`Prefer: odata.maxpagesize=N`, seguir `odata.nextLink`) para listar documentos en volumen — construir esto de cero.
- Código fuente real del wrapper de sesión: **no está disponible en la base de conocimiento de este proyecto** — solo el contrato. Si se necesita el código literal, hay que pedirlo directo del repo `cfe-review-api` (`shared/sap_client.py`).
- Dos IPs mencionadas como Service Layer (`192.168.1.240` producción probable, `10.10.10.240` test) — **A CONFIRMAR cuál es el ambiente de desarrollo vigente**; nunca se formalizó pensando en que otro proyecto lo reutilizaría.

### 15.5 Sobre usar SQL directo (`hdbsql`) en vez de `/SQLQueries`

**RECOMENDACIÓN, con reservas:**

1. Con el hallazgo de 15.2, buena parte de lo que se necesitaba resolver por SQL directo (saldo, crédito, estado del cliente) ya está disponible por OData estándar — reduce la urgencia de esta vía.
2. Si igual se usa para lo que falte (ej. agregaciones de aging/comportamiento de pago a volumen), tratarlo con la misma disciplina que exige la Sección 7 del marco de gobernanza para cualquier acceso a datos: nunca SQL libre generado por el agente, siempre un set fijo de consultas/vistas pre-aprobadas.
3. Confirmar con Germán si ya existe un usuario de solo lectura para reporting (Crystal Reports/Power BI u otro) antes de pedir uno nuevo — evita reinventar un acceso que puede ya existir.
4. Nunca usar esta vía para escritura — fuera del contrato oficial de SAP (Service Layer/DI API), con riesgo real de romper series de numeración, asientos o integridad referencial.

### 15.6 Próximo paso de validación — dos pistas en paralelo

En vez de esperar una respuesta completa de Germán antes de avanzar:

- **Pista técnica (Líber):** validar contra el Service Layer real (Postman u otra herramienta HTTP) las hipótesis de 15.2 que se puedan probar sin escritura — login/sesión, lectura de `BusinessPartners` con los campos de crédito, y si `AuthorizationStatus` efectivamente refleja el bloqueo en pedidos reales.
- **Pista Germán (acotada):** solo lo que no se puede inferir probando — cuál IP es el ambiente de test vigente, si `/SQLQueries` está habilitado, si ya existe un usuario de reporting de solo lectura, y confirmación final del mecanismo de bloqueo si las pruebas no alcanzan.

Esto no reemplaza la metodología de Discovery: las hipótesis marcadas INFERENCIA en esta sección solo pasan a HECHO cuando se validen contra datos/pruebas reales, no antes.

### 15.7 Ronda 1 de validación real (16/09/2026) — resultados contra Service Layer

Ejecutada por Líber vía Postman, siguiendo 15.6. Resultados y lectura:

**A CONFIRMAR — ambiente:** el `odata.metadata` de las respuestas reales apunta a `192.168.1.240` — la IP que 15.4 marca como sospechada de **producción**, no la de test (`10.10.10.240`). Los datos devueltos (nombres de cliente reales, montos reales) lo confirman. Todo lo corrido en esta ronda fue de solo lectura, sin impacto — pero de acá en más, tratar cualquier prueba adicional contra este ambiente con el mismo cuidado que si fuera productivo, y no probar escritura sin autorización explícita. Sigue pendiente que Germán confirme cuál IP es cuál.

**HECHO — `AuthorizationStatus` descartado:** los 10 pedidos reales muestreados (`GET /Orders` sin filtro) tienen el 100% `AuthorizationStatus: "dasWithout"`, y el filtro específico `AuthorizationStatus eq 'dasPending'` devolvió vacío. La hipótesis de 15.2 (Procedimientos de Aprobación estándar de SAP como mecanismo de bloqueo) queda descartada por evidencia real — Pontyn no usa ese mecanismo para esto.

**INFERENCIA fuerte — nuevo candidato `Confirmed`/`U_ConfirmUser`/`U_ConfirmDate`:** en la misma muestra, `Confirmed` alterna entre `"tYES"` y `"tNO"`; `U_ConfirmUser`/`U_ConfirmDate` aparecen poblados (con usuarios reales, ej. `pgonzale`, `fvenneri`) únicamente cuando `Confirmed="tYES"`, y quedan `null` cuando es `"tNO"`. Es un patrón consistente con "alguien liberó esto a mano, con auditoría de quién y cuándo" — candidato bastante más creíble que `AuthorizationStatus`. **Todavía no es HECHO:** no hay evidencia de que este campo sea específicamente el circuito de crédito y no, por ejemplo, una confirmación de picking/logística sin relación con crédito.

**ACTUALIZADO 16/09/2026 — ronda 2, falsificación parcial:** filtrar `Orders` solo por `Confirmed eq 'tNO'` (sin acotar por `DocumentStatus`) devolvió pedidos de **2017 a 2022, todos con `DocumentStatus: "bost_Close"`**. Al abrir el primero por `DocEntry`, resultó ser un pedido **cancelado** (`Cancelled: "tYES"`, `JournalMemo: "Cancelado"`, `DocTotal: 0`) — nada que ver con un bloqueo de crédito vigente. Conclusión: `Confirmed='tNO'` por sí solo trae ruido histórico (pedidos viejos, cerrados o cancelados, donde el campo simplemente nunca se marcó); **no es una señal limpia sin acotar también por `DocumentStatus eq 'bost_Open'`**. La hipótesis no queda descartada del todo, pero sí debilitada — sigue sin haber un caso real confirmado por el sector.

**Próximo paso concreto, revisado:** (1) repetir la consulta con `Confirmed eq 'tNO' and DocumentStatus eq 'bost_Open'` para quedarse solo con pedidos vivos (colección v4, request 2.2 actualizado); (2) en paralelo, pedirle a Rosina/Claudia un `DocEntry` real que ellas mismas identifiquen como "esto lo liberamos por crédito hoy" y verificar sus valores ahí — sigue siendo la validación más confiable, más que cualquier filtro genérico.

**ACTUALIZADO 16/09/2026 — ronda 3, con `DocumentStatus eq 'bost_Open'` ya aplicado:**

- **Sigue habiendo ruido:** entre los 10 resultados aparecen "CONSUMO INTERNO" y otro caso con `DocTotal: 0.0` — parecen códigos internos/no comerciales, no clientes reales con problema de crédito real. `Confirmed='tNO'` combinado con `DocumentStatus='bost_Open'` mejora respecto de la ronda 2, pero todavía no es una señal limpia por sí sola.
- **A CONFIRMAR — nuevo prefijo `C3-` sin documentar:** apareció `C3-12788` (ESTRELLA GALICIA INTERNACIONAL). Hasta ahora todo el proyecto asume solo C1-/C2- (regla de consolidación por `Numero_SN`, Sección 4.5). No se sabe si `C3-` participa de esa consolidación, es una categoría aparte (¿exportación/internacional?), o si hay más prefijos todavía no vistos — confirmar antes de dar por cerrado el alcance de la regla de consolidación.
- **Aclaración de arquitectura importante — `DocumentStatus` significa cosas distintas según el documento.** Se probó `Invoices` para el cliente `C1-17950` (que en `Orders` aparecía con 3 pedidos `bost_Open` de septiembre) y dio **vacío al filtrar por `bost_Open`** — no por error, sino porque sus únicas facturas (de agosto) ya están `bost_Close` (cobradas). `Orders.DocumentStatus = bost_Open` significa "todavía no se facturó/entregó" — no tiene relación con si el cliente debe plata. `Invoices.DocumentStatus = bost_Open` sí significa "todavía impaga" — es el campo correcto para armar saldo vencido, nunca `Orders`. **RECOMENDACIÓN:** el saldo vencido de Cliente 360 se arma siempre contra `Invoices` (y eventualmente `CreditNotes`/`DownPayments`), nunca contra `Orders`.
- **Hipótesis nueva, más simple, a probar:** puede que no exista ningún campo que marque "pedido bloqueado" de forma persistida. El bloqueo podría ser un **cálculo en vivo** que hace la pantalla que usa hoy el sector: crédito disponible (`CreditLimit − CurrentAccountBalance − OpenOrdersBalance` de `BusinessPartners`) comparado contra el total del pedido — coherente con el principio de "determinístico donde se pueda" del proyecto, y explicaría por qué ni `AuthorizationStatus` ni `Confirmed` dieron una señal limpia hasta ahora: puede que no haya nada persistido que buscar. **Próxima prueba concreta:** consultar `BusinessPartners` del cliente con el pedido más grande y más vencido de esta muestra (`C3-12788`, $282.758,52, vencido desde 10/09) y comparar `CreditLimit` contra `CurrentAccountBalance + OpenOrdersBalance`.
- **Pendiente — volumen real:** los resultados vienen acotados por `$top=10`; falta pedir el conteo total (`$inlinecount=allpages` o equivalente) para comparar el volumen real de "pedidos abiertos sin confirmar" contra el orden de magnitud esperado (~52.500/año).

**ACTUALIZADO 16/09/2026 — ronda 4:**

- **HECHO — volumen:** `$inlinecount=allpages` funciona en este Service Layer. `Orders` con `Confirmed='tNO' AND DocumentStatus='bost_Open'` da **84 en total**, en el momento de la prueba. No contradice el orden de magnitud de 52.500/año — es una foto de stock en un instante, mientras que 52.500/año es un flujo acumulado; si el tiempo de resolución típico es menor a un día, un stock de 84 es compatible con ese flujo (52.500/año ≈ 144/día si estuviera parejo, que no lo está — ver estacionalidad de diciembre en 3.1). No es prueba definitiva de que `Confirmed` sea el mecanismo correcto, pero tampoco lo contradice.

- **INFERENCIA muy fuerte (casi HECHO) — se confirma la hipótesis de cálculo en vivo:** `BusinessPartners('C3-12788')` (el pedido más grande/vencido de la muestra) dio `CreditLimit: 0.0`, `CurrentAccountBalance: 449.655,31`, `OpenOrdersBalance: 282.758,52` — es decir, sin crédito habilitado y con una exposición total de ~$732.414, muy por encima de cualquier límite razonable. Y sin embargo `Frozen`, `BlockDunning` y `PaymentBlock` están los tres en `"tNO"`. Esto es evidencia bastante directa de que **el bloqueo no depende de ningún flag booleano administrativo — depende de comparar `CreditLimit` contra `CurrentAccountBalance + OpenOrdersBalance`**, calculado en el momento, no guardado en el documento.

  **RECOMENDACIÓN — fórmula de trabajo propuesta para Bandeja de Autorización / Cliente 360** (a validar operativamente con Rosina/Claudia, no asumir cerrada):
  ```
  Crédito disponible = CreditLimit − CurrentAccountBalance − OpenOrdersBalance
  Pedido en riesgo/bloqueado si: Crédito disponible < 0 (para el cliente en su conjunto)
  ```
  Esto es determinístico, ya con datos que sabemos que funcionan por OData estándar, y no depende de `SQLQueries`, `hdbsql` ni de ningún campo custom todavía sin confirmar.

- **A CONFIRMAR — no asumir el significado de `U_ClasifClienteCC`:** este mismo cliente (crédito en cero, deuda enorme) tiene `U_ClasifClienteCC: "A"`. Si "A" representara la mejor categoría, sería contradictorio. No asumir que A/B/C siguen el orden intuitivo "mejor a peor" sin que Karen/Rosina lo confirmen explícitamente — podría ser al revés, o no tener relación directa con el riesgo crediticio.

**CORREGIDO el 16/09/2026 — no es una discrepancia de Company DB:** Líber confirmó que el `$metadata` es del mismo server, y aportó una captura de pantalla real de SAP B1 (cliente de prueba PLANETA VERDE, C1-04941) con "System Information" activado, que muestra en vivo el nombre técnico exacto de un campo al hacer clic sobre él (`[Form=-134 Item=U_WhatsappCC ... OCRD,U_WhatsappCC]`). Con esto: **`U_WhatsappCC` y `U_EmailCC` están confirmados como reales** — existen en la base (con dato poblado, ej. `planetaverdeflorida@gmail.com`), en la pantalla del cliente SAP, y en los 39 UDFs listados en el `$metadata` de `BusinessPartner`.

**Hipótesis vigente para el error de Service Layer (INFERENCIA, no HECHO):** Service Layer cachea su esquema OData en memoria y suele necesitar un reinicio del servicio para tomar UDFs agregados o modificados después de que arrancó — comportamiento conocido de SAP B1. Es probable que el servicio que atendió la request de Postman tenga cacheada una versión del esquema anterior a estos campos, aunque ya existan en la base y en un `$metadata` exportado por otra vía en otro momento. **Pregunta puntual y accionable para Germán:** ¿se puede reiniciar el servicio de Service Layer para que refresque el esquema OData?

**Hallazgo adicional, alto valor para Cliente 360 — mapeo completo de campo de pantalla → nombre técnico**, confirmado cruzando la captura de pantalla contra los 39 UDFs de `BusinessPartner` en el `$metadata`:

| Campo en pantalla | Campo técnico |
|---|---|
| Código anterior | `U_CodAnt` |
| Notas extendidas | `U_Notas` |
| Descuento 1/2/3 | `U_DTO1` / `U_DTO2` / `U_DTO3` |
| Zona Ctas Ctes | `U_ZONA` |
| Suspendido | `U_Suspendido` — **confirmado en vivo: "No"** |
| Comisión Específica | `U_Comision_Especifica` |
| Móvil | `U_Movil` |
| Hora Inicial/Final Entrega (+2) | `U_HoraInicialEntrega` / `U_HoraFinalEntrega` (+`2`) |
| Tiempo de servicio | `U_TiempoServicio` |
| Persona/Teléfono Contacto | `U_PersonaContacto` / `U_TelefonoContacto` |
| E-mail/SMS Tracking | `U_TrackingEmail` / `U_TrackingSMS` |
| Latitud/Longitud | `U_LatitudEntrega` / `U_LongitudEntrega` |
| Recibe Lunes...Domingo | `U_Weekday0` ... `U_Weekday6` (orden exacto de días a confirmar) |
| Rubro | `U_Rubro` |
| Zona Logística | `U_ZonaLog` |
| Vendedor Alimentos/No Alimentos | `U_Vendedor1` / `U_Vendedor2` |
| E-Mail Cuentas Corrientes | `U_EmailCC` — **confirmado** |
| Canal | `U_Canal` |
| Fracciona órdenes por tipo de artículo | `U_FraccionaTipoArt` |
| WhatsApp Cuentas Corrientes | `U_WhatsappCC` — **confirmado** |
| Valor Mínimo Pedido | `U_ValorMinimoPedido` |

**Hallazgo importante, actualizado — "Clasificación cliente CC" confirmado como `U_ClasifClienteCC`.** Vía System Information (misma técnica que reveló `U_WhatsappCC`): `[Item=U_ClasifClienteCC ... OCRD,U_ClasifClienteCC]`, valor real `"A"` para el cliente de prueba PLANETA VERDE. Ni este campo ni el siguiente aparecen en los 39 UDFs del `$metadata` analizado originalmente — refuerza que ese archivo quedó desactualizado respecto del estado actual de la base (coherente con, aunque no necesariamente la misma causa que, la hipótesis de caché de Service Layer de más arriba).

**Segundo hallazgo nuevo — `U_DiasToleranciaCC` ("Días Tolerancia CC"):** visible justo debajo de `U_ClasifClienteCC` en la misma pantalla, vacío para este cliente de prueba. Es un candidato directo al mecanismo de "tolerancia por cliente" que la Sección 4.4 identifica como oportunidad ("reglas de tolerancia" para evitar bloqueos innecesarios) — si este campo ya existe y está pensado para eso, el trabajo puede ser más de **corregir/poblar/conectar** un campo existente que de diseñar uno nuevo desde cero.

**RECOMENDACIÓN — no asumir todavía, validar en dos frentes:**
1. **Técnico:** probar `U_ClasifClienteCC` y `U_DiasToleranciaCC` contra Service Layer (mismo patrón de prueba que con `U_WhatsappCC`, ver colección Postman). Si también fallan con "property invalid", refuerza fuerte la hipótesis de caché de Service Layer (afectaría a UDFs nuevos en general, no solo a los de WhatsApp/Email). Si funcionan, hay que revisar por qué `U_WhatsappCC` específicamente falló.
2. **Negocio, con Karen/Rosina:** confirmar si `U_ClasifClienteCC` es la clasificación que Karen mantiene hoy (y cómo se actualiza — manual, importación, cálculo automático), y si `U_DiasToleranciaCC` ya se usa en alguna lógica de bloqueo/liberación de pedidos o es un campo configurado pero todavía no conectado a nada. Esto puede cambiar el enfoque de la Sección 4.4: en vez de construir categorización/tolerancia desde cero, podría ser cuestión de validar y corregir lo que ya existe en estos dos campos.

**ACTUALIZADO 16/09/2026 — ronda 2, resultado del punto 1:** los cuatro campos (`U_EmailCC`, `U_WhatsappCC`, `U_ClasifClienteCC`, `U_DiasToleranciaCC`) **ya funcionan correctamente contra Service Layer** (probados con el cliente real `C1-06875`, ANCAP SAN LUIS: `U_EmailCC` poblado, `U_WhatsappCC` vacío para ese cliente puntual, `U_ClasifClienteCC="A"`, `U_DiasToleranciaCC` vacío). El error de la ronda 1 fue **transitorio** ("algo puntual del Service Layer", sin poder precisar la causa exacta) — no hizo falta reiniciar el servicio ni intervención de Germán. Se mantiene la recomendación de no asumir automáticamente que un "property invalid" es un error de nombre de campo: puede ser transitorio, vale la pena reintentar antes de descartar un campo.

`/SQLQueries` se volvió a probar y sigue devolviendo lista vacía — consistente con 15.3 (habilitado, sin queries guardadas).

**HECHO — `/SQLQueries` habilitado:** `GET /SQLQueries` devolvió `200` con lista vacía — está habilitado, solo que no hay queries guardadas todavía (ver 15.3 actualizado).

**Sin conclusión — `Invoices` abiertas:** la prueba dio vacío, con alta probabilidad simplemente porque `card_code_test` no se completó con un código real. Reintentar con un `CardCode` ya visto en esta misma ronda (ej. `C1-17006`).
