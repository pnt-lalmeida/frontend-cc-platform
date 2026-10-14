# Gap técnico — CRM liviano, Iniciativas 1 a 6 (consolidado y autocontenido, 24/09/2026)

Este documento es autosuficiente: no requiere abrir ningún otro archivo del proyecto para entenderlo o ejecutarlo. Consolida las 6 iniciativas del CRM liviano — modelo de datos, estados, bloqueantes y pendientes de negocio.

**Orden sugerido:** 1 → 2 → 4 → 6 (etapa 1) → 3 → 5 → 6 (etapa 2). Las tres primeras dependen del spike de autenticación JWT, ya bloqueante para cualquier endpoint nuevo.

---

## 0. Investigación pendiente de Service Layer — bloquea las Iniciativas 1 y 6

**Contexto confirmado vía GUI de SAP:** el pago recibido se guarda en la tabla `ORCT` (Incoming Payments). El campo `NoDocSum` es el importe del pago que no fue aplicado a ningún documento puntual ("pago a cuenta"). Falta confirmar la aplicación pago-factura.

**Pasos concretos a ejecutar directo contra el Service Layer:**

1. **Forma de un pago ya aplicado.** Ubicar un pago que sí esté aplicado a una factura puntual (no "a cuenta"). `GET /b1s/v1/IncomingPayments(<DocEntry>)`. Buscar en la respuesta una colección anidada (candidata: `PaymentInvoices`) con el detalle de aplicación — probablemente `DocEntry` de la factura, `InvoiceType`, `SumApplied`. Si aparece, esa es la estructura de aplicación pago-factura, sin necesidad de ir a SQL.

2. **Pago parcial en dos fechas (el caso que más importa).** Ubicar un cliente con una factura cobrada en dos partes (dos pagos distintos). Traer ambos por Service Layer y comparar `SumApplied` contra esa factura y la fecha de cada uno (`DocDate` o `TaxDate`). Esto define el criterio que falta: cuando una factura se cobra en varias partes, ¿qué fecha cuenta como "fecha de cobro" — la del primer pago, la del último, u otra? Con dos pagos reales delante, se puede fijar el criterio directamente.

3. **La factura desde el otro lado.** `GET /b1s/v1/Invoices(<DocEntry>)` de esa misma factura. Revisar si trae algún campo resumen de cobro (candidato: `PaidToDate`) que evite reconstruir el estado sumando pagos.

4. **"Días de atraso": ¿dato real o de pantalla?** Confirmar si ese campo (visible en la GUI) viaja en el JSON de `IncomingPayments`/`PaymentInvoices`. Si no aparece, es un cálculo de la interfaz de SAP — hay que calcularlo nosotros (vencimiento de la factura vs. fecha del pago aplicado), no leerlo de SAP.

**Qué hacer con el resultado:** si los pasos 1–3 dejan claro el criterio, documentarlo y avanzar con el diseño de las Iniciativas 1 y 6 sin más consultas. Si el criterio sigue ambiguo, ahí sí es una pregunta de negocio para el sector — pero acotada ("encontramos esto, ¿cuál de estas interpretaciones usan ustedes?"), no abierta.

---

## 1. Indicadores de comportamiento de pago (Cliente 360)

**Qué construir:** dos indicadores por cliente sobre facturas saldadas — días para cobrar (cobro − emisión) y días de atraso (cobro − vencimiento) — ponderados por importe, en ventana de 6 o 12 meses, con tendencia (mejora/estable/empeora). Opcional: aging de la deuda abierta.

**Reglas:**
- Excluye notas de crédito del cálculo, por diseño.
- Consolida por el número de cliente unificado y su jerarquía de cuenta padre — mismo patrón ya usado en la Bandeja de Autorización para agrupar cuentas en pesos y en dólares de un mismo cliente.
- Si hay pocas facturas saldadas, mostrar "sin historial suficiente" en vez de un promedio engañoso.

**Bloqueante:** ver Sección 0 (aplicación pago-factura). No implementar el cálculo real hasta cerrar eso — sí se puede construir el modelo de datos y la UI con datos de prueba mientras tanto.

**Dónde aparece:** ficha del cliente (Cliente 360, pestaña Resumen) + resumen de una línea en el detalle de cada caso de la Bandeja.

**Pendiente de negocio:** con el sector, qué indicador priorizar primero y con qué ventana (6 o 12 meses).

**Aceptación:** para 5 clientes de referencia elegidos por el sector, el indicador coincide con lo que calculan/perciben manualmente, o la diferencia queda documentada como una regla explícita.

---

## 2. Centro de alertas internas

**Modelo de datos:** tabla propia de la plataforma (nunca en SAP). Campos: `id`, `tipo`, `clienteId`, `descripcion`, `fecha`, `estado` (`nueva` → `vista` → `resuelta`, con usuario y timestamp de cada transición).

**Tipos de alerta para este primer corte (no agregar más sin validar — ver pendiente abajo):**
- `pedido_bloqueado` — nuevo pedido bloqueado en la Bandeja.
- `pedido_reabierto` — un rechazo fue revertido.
- `riesgo_bloqueo` — lo genera la Iniciativa 3.
- `promesa_incumplida` — lo genera la Iniciativa 6.

*(Más adelante: alertas de cheque rechazado/diferido — pospuesto hasta identificar dónde viven esos datos, ver pendiente abajo.)*

**Idempotencia:** clave `tipo + entidad + fecha` — no duplicar la alerta si la regla que la genera corre dos veces.

**Suscripción:** por rol de usuario, filtrada en el backend — no en el cliente.

**Alcance de esta fase:** solo in-app. Un resumen por email es una segunda vuelta, no ahora.

**Pendiente de negocio (el riesgo real de este módulo, no lo técnico):** con el sector, qué eventos justifican una alerta y cuáles serían ruido. No agregar tipos de alerta más allá de los cuatro de arriba hasta tener esa validación — el riesgo es que el equipo aprenda a ignorar la campanita si se satura de entrada.

**Pendiente de negocio:** con el sector, dónde viven hoy los datos de cheques rechazados/diferidos.

**Aceptación:** dos semanas de uso sin alertas duplicadas ni irrelevantes reportadas por el equipo; cada alerta lleva a la entidad concreta con un clic.

---

## 3. Alerta preventiva de bloqueo

**Qué construir:** una lista diaria de clientes que todavía no están bloqueados pero lo estarían en N días. **Regla de oro: reutilizar exactamente la misma lógica de detección de bloqueo que ya usa la Bandeja en producción, corriéndola con una fecha de referencia futura (hoy + N)** — nunca una lógica nueva y separada. Así la alerta y la Bandeja nunca se contradicen entre sí.

**Bloqueante:** la semántica exacta del campo de días de tolerancia del cliente y la lógica de reinicio de esa tolerancia todavía no están confirmadas con el equipo técnico de SAP — sin esto la proyección hacia el futuro puede dar resultados incorrectos. No construir esta iniciativa hasta confirmar eso.

**Dónde aparece:** filtro/vista "En riesgo de bloqueo" en Cliente 360, y alimenta un tipo de alerta de la Iniciativa 2.

**Pendiente de negocio:** con el sector, qué valor de N usar (¿3 días? ¿7?) y quién debería recibir la lista. Nota: Por default usar 7 dias hasta no aclararlo.

**Aceptación:** correr primero en **modo sombra** 2 a 4 semanas, midiendo únicamente: de los clientes que la lista marcó, cuántos terminaron con un pedido efectivamente bloqueado. Si la precisión es razonable, recién ahí habilitar como algo accionable para el equipo.

---

## 4. Bitácora de gestión

**Modelo de datos mínimo** — dos entidades separadas, no una sola tabla de "eventos":
- **Evento** (histórico, inmutable): cliente, tipo (automático/manual), canal (si aplica), fecha/hora, resultado, origen (quién o qué proceso lo generó), nota libre opcional.
- **Tarea/recordatorio** (mutable, con estado): cliente, descripción, fecha objetivo, estado (pendiente/completada), responsable. Al completarse, genera automáticamente un Evento asociado.

**Motivo/próxima acción:** no dejar como texto libre. Usar una lista fija con estas categorías, ya validadas contra el vocabulario real que el equipo usa hoy en su planilla semanal de seguimiento de cobranza: *Sin acción necesaria* · *Comunicación pendiente* · *Pago coordinado* · *Requiere seguimiento activo* · *Gestión delegada (vendedor)* · *Caso especial/disputa*. Mantener un campo de notas libres aparte para el detalle — no lo reemplaza. Confirmar esta lista con el equipo antes de fijarla en forma definitiva.

**Mapeo ya confirmado con el sector:** Evento histórico = lo que se hizo antes; nota de la acción actual = lo que se hace hoy; Promesa de pago (fecha) = fecha de pago prevista. Este mapeo replica exactamente la lógica de tres columnas que el equipo ya usa hoy en su planilla semanal (una para el histórico, una para la acción de hoy, una para la fecha prevista de cobro) — no es un concepto nuevo para ellos, es formalizar algo que ya hacían a mano.

**Clave de cliente:** consolidar por el número de cliente unificado y su jerarquía de cuenta padre, igual que el resto del sistema. Si un evento necesita distinguir cuenta/moneda de origen (cuenta en pesos vs. en dólares de un mismo cliente), guardarlo como atributo del Evento, nunca como parte de la clave.

**Visibilidad (default, confirmar si cambia):** todos los eventos y tareas visibles para todo el equipo — sin registro privado por operadora en este primer corte.

**Disparo de notificaciones:** la Bitácora no envía mensajes — publica una intención (cliente, canal sugerido, tipo de mensaje) que el Hub Omnicanal ejecuta y devuelve el resultado como un Evento nuevo. No implementar todavía políticas de mensaje dinámico (variar el contenido según evolución de la deuda) — es una idea sin reglas definidas todavía. Arrancar con el registro simple.

**Bloqueante:** confirmar con Geman y Liber si el proceso de envío automático de estados de cuenta que ya existe hoy puede escribir un Evento acá — sin esto, la Bitácora no distingue automático de manual desde el arranque, que era el objetivo original.

**Bloqueante de alcance:** existe otro sistema, que supuestamente envia periodica y automaticamente recordatorios de pago y estado de cuenta a clientes. No conectar la Bitácora a esa fuente hasta aclararlo. Mientras tanto, alimentarla con carga manual + eventos que ya genera la Bandeja (aprobaciones, rechazos, emisión de estado de cuenta).

**Dónde aparece:** pestaña "Actividad" en Cliente 360.

---

## 5. Bandeja "Mi día"

**Qué construir:** pantalla de inicio de cada operadora, en dos etapas.

**Etapa 1 — agenda agregada, sin ranking.** Agrupa:
1. **Clientes del día** — el segmento completo de clientes asignado a ese día de la semana (cada cliente tiene un día fijo asignado, sin superposición entre días — confirmado contra los datos reales de la planilla que usa hoy el sector). **Esto no se filtra solo por saldo vencido** — el seguimiento real del sector incluye clientes con saldo pendiente sin vencer todavía (control preventivo de relación, no solo cobranza reactiva). Mostrar todos los del día, distinguiendo visualmente vencido de solo-pendiente. Separar además los que ya recibieron aviso automático (vía Bitácora) de los que requieren gestión manual.
2. Tareas/recordatorios de la Bitácora que vencen hoy.
3. Promesas que vencen hoy (Iniciativa 6).
4. Clientes en riesgo de bloqueo (Iniciativa 3).
5. Alertas sin resolver (Iniciativa 2).
6. Pedidos bloqueados pendientes, con enlace a la Bandeja — solo para roles que autorizan.

**Acciones desde cada fila:** abrir ficha del cliente; registrar una gestión en la Bitácora (la fila pasa a "gestionado hoy" — estado derivado de la Bitácora, nunca guardado aparte); posponer a otra fecha (crea una tarea con esa fecha).

**Etapa 2 — priorización con score.** Orden determinístico y explicable: importe vencido, días de atraso, historial de cumplimiento (Iniciativa 1), categoría, y un factor anti-abandono para no descuidar la cola larga de deudas chicas. Pesos configurables. Cada fila explica por qué está donde está (ej. "32 días de atraso · 3 promesas incumplidas").

**Bloqueante — el punto de mayor esfuerzo real:** dónde vive hoy el "día fijo" de cada cliente. Hoy vive en una planilla Excel semanal que arma el sector a mano. Falta decidir si ese campo se migra a la plataforma (¿campo nuevo en SAP, o tabla propia?) y cómo se hace la carga inicial desde esa planilla. Aclaración sobre este punto: el dia fijo de cada cliente vive en el campo "Zona Ctas. Ctes." que ya lo mostramos en cliente 360..

**Pendiente de negocio:** ¿cada operadora tiene cartera propia, o se trabaja por segmento? Y si el código de "zona" que usa la planilla actual (con sufijos que probablemente indican canal de contacto) puede reutilizarse para pre-completar el canal sugerido en el Hub — a confirmar con el sector. Respuesta aclaratoria: no tienen una cartera propia, se van organizando a demanda con el trabajo diario..

**No se justifica solo por el tiempo que lleva armar la planilla hoy** — el valor es centralizar y no perder de vista casos particulares.

**Aceptación:** 2 a 4 semanas piloto con un día de la semana. El 100% de los clientes de la planilla real aparecen en "Mi día"; cualquier diferencia queda documentada como regla; la operadora deja de abrir el Excel para ese día.

---

## 6. Promesas de pago

**Modelo de datos:** entrada estructurada dentro de la Bitácora — fecha prometida, importe, facturas asociadas (opcional), canal por el que se acordó, quién la registró. Estados: `vigente` → `vencida_a_verificar` → `cumplida` / `cumplida_parcial` / `incumplida` → `renegociada`.

**Etapa 1 — registro y verificación automática.**
- La carga la hace una persona (nunca interpretación de IA de un mensaje — eso queda para cuando el Hub capture conversaciones).
- Llegada la fecha, una regla determinística busca pagos del cliente (consolidado por número de cliente unificado, en la moneda correspondiente) y actualiza el estado.
- **Bloqueante:** ver Sección 0 — la verificación automática necesita la aplicación pago-factura en SAP.
- **Período de gracia obligatorio:** una porción importante de los depósitos llega sin aviso previo y se identifica con demora. El estado `vencida_a_verificar` necesita un margen configurable (ej. 2 días hábiles) antes de pasar a `incumplida` — sin esto, el equipo pierde confianza en el módulo la primera semana que un pago tarde en aplicarse.
- Una promesa `incumplida` dispara una alerta (Iniciativa 2) y aparece en "Mi día" (Iniciativa 5). El historial de cumplimiento alimenta el indicador de la Iniciativa 1.

**Etapa 2 — control de política.** Si la fecha prometida supera un plazo máximo según el tramo de atraso, se marca "fuera de política" y genera una tarea de contrapropuesta — la regla solo alerta, la contrapropuesta siempre la hace una persona.

**Límite de diseño no negociable:** una promesa vigente puede mostrarse como contexto en la Bandeja de Autorización ("el cliente prometió pagar $X el DD/MM"), pero **nunca debe desbloquear un pedido automáticamente ni entrar en la regla de detección**. Esa decisión sigue siendo humana. Dejarlo así de explícito en el código y en cualquier revisión — es la tentación más fácil de colar sin querer.

**Pendiente de negocio:** qué cuenta como "promesa" (¿toda fecha coordinada, o solo con importe concreto?). Para la Etapa 2: plazo máximo por tramo de atraso y quién puede aprobar una excepción — a validar con Dirección/Finanzas antes de configurar nada.

**Dónde aparece:** acción "Registrar promesa" en la Bitácora y en "Mi día"; resumen en la ficha del cliente; contexto (nunca criterio) en la Bandeja.

**Aceptación:** 2 a 4 semanas piloto — todas las promesas del grupo quedan en la plataforma, no en planilla; los estados cumplida/incumplida coinciden con la verificación manual del equipo; ninguna promesa se marca incumplida solo por demora en identificar un depósito.

---

## Resumen de bloqueantes — quién los destraba

| Bloqueante | Bloquea a | Quién lo resuelve |
|---|---|---|
| Aplicación pago-factura en Service Layer (Sección 0) | Iniciativa 1, Iniciativa 6 (etapa 1) | Investigación técnica directa (este documento, Sección 0) |
| Semántica del campo de tolerancia y su reinicio | Iniciativa 3 | Equipo técnico de SAP |
| Validar la lista fija de "próxima acción" | Iniciativa 4 | Equipo Cuentas Corrientes |
| Qué eventos generan alerta vs. ruido | Iniciativa 2 | Equipo Cuentas Corrientes |
