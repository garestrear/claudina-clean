# Liberación de reservas y puestos

Ejecutar `supabase/feria-liberar-puestos.sql` después de `feria-puestos-automaticos.sql`. Es repetible.

La asignación automática anterior creaba reservas al aprobar, pero no las desactivaba cuando el proyecto dejaba de estar aprobado. La programación mostraba la reserva activa aunque marcaba el proyecto como no vigente. Dos proyectos con el mismo título podían confundirse.

La migración desactiva las reservas de proyectos sin aprobación o eliminados, tanto de Claudina como invitados, usando origen e identificador. Conserva los registros como historial. En adelante los cambios de estado liberan los cupos automáticamente. Las reservas de los proyectos aprobados homónimos se conservan. Los títulos copiados en programación se sincronizan con su proyecto correspondiente. Al reaprobar se usa el flujo existente de asignación de ubicación.

Las etiquetas simples Mesa 1, Mesa 2… se convierten a Puesto 1, Puesto 2… y la numeración automática nueva utiliza Puesto. Si el número ya está ocupado, se elige uno libre. Se conservan referencias personalizadas como Mesa 1A, Mesa 1B o Ventana. No se cambia la capacidad física de los espacios.

La pantalla de organización y la impresión excluyen reservas de proyectos no vigentes incluso antes de ejecutar la migración, pero para liberar el cupo real en la base de datos es imprescindible ejecutarla. Las listas de expositores usan el encabezado Puesto. Placas y credenciales toman el valor actualizado de la ubicación; volver a generarlas después de activar la migración. Regenerar y guardar el carrusel si cambian las aulas de exposición.

Pruebas: `node tests/feriaLiberarPuestosSql.test.mjs`, `node tests/programacionFeria.test.mjs`, `npm run build`.
