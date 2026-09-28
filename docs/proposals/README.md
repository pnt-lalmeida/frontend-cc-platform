# Propuestas de agentes

Carpeta para hallazgos **reusables y ajenos a la tarea puntual** de un agente — no es el lugar para el reporte normal de una tarea (ese va siempre en el mensaje final, como ya funciona).

**Ejemplo real de qué va acá:** un agente de Frontend está implementando un formulario y de paso descubre que el input de fecha nativo funciona mejor que el componente propio en iOS. No tiene nada que ver con su tarea puntual, pero vale la pena que quede para el resto del proyecto.

**Cómo se usa:**
- Un agente escribe **como mucho un archivo corto** acá, `AAAA-MM-DD-tema-breve.md`, solo cuando encuentra algo así. No es obligatorio ni frecuente — la mayoría de las tareas no generan ninguna propuesta.
- El orquestador las revisa al cerrar cada fase grande (o antes de arrancar el siguiente módulo grande, junto con la relectura de `.claude/agents/`) y decide: la incorpora a `.claude/agents/*.md`/`CLAUDE.md`/`Architecture.md`, o la descarta con una razón.
- Una vez revisada (aceptada o no), **se borra el archivo** — esta carpeta muestra solo lo pendiente, nunca acumula histórico. El historial de qué se decidió queda en `Decisions.md`, no acá.

**Nunca va acá:** el reporte normal de una tarea (sigue siendo el mensaje final), datos de clientes reales, ni nada que necesite el OK del usuario para aplicarse — eso lo escala el agente en su reporte, no en una propuesta.
