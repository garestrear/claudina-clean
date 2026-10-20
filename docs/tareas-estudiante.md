# Organización personal de tareas

En Inicio, el estudiante ve primero sus tareas, con dos pestañas: **Pendientes** y **Ya las hice**, ambas con contador. Las listas conservan el orden de entrega ascendente y dejan las tareas sin fecha al final. Las vencidas siguen pendientes hasta que el estudiante las marque como hechas.

**Ya la hice ✓** mueve la tarea a la segunda pestaña. **Volver a pendientes** deshace la marca. Esta organización es personal: no equivale a una entrega, una calificación ni a la aprobación del profesor. Las propuestas de nuevas tareas mantienen su flujo de revisión docente.

## Activación

Ejecutar completo `supabase/tareas-estado-estudiante.sql` en Supabase SQL Editor, en el proyecto de Claudina App que ya tiene las tablas `estudiantes` y `avisos`. La migración puede repetirse y no modifica publicaciones, notas ni marcas existentes.

El estado se guarda por ficha de estudiante y tarea, y se recupera al entrar desde otro dispositivo. **Actualizar estado** vuelve a consultar las marcas guardadas. Solo se pueden clasificar tareas publicadas para el grado de la ficha activa o para todos los grados. Las marcas de otras cuentas no se entregan al cliente. Las tablas no admiten acceso directo desde usuarios autenticados ni anónimos.

Si falla la consulta de estados, las tareas publicadas siguen visibles, pero las marcas y los contadores quedan deshabilitados hasta recuperar la conexión. Al guardar un cambio, la tarea se mueve únicamente después de la respuesta del servidor. No se utiliza un guardado local como sustituto del estado persistente.

## Verificación

- `node tests/tareasEstadoSql.test.mjs`: permisos, aislamiento de cuentas, visibilidad por grado/publicación, idempotencia, grado cero y eliminación en cascada.
- `node tests/tareasEstadoBrowser.test.mjs`: navegador móvil con PostgreSQL embebido, orden por entrega, contadores, marcar/desmarcar, recarga, cambio de cuenta y recuperación de errores.
- `node tests/inicioEstudiante.test.mjs`: integración con avisos, propuestas y filtros docentes.
- `npm run build`: compilación de producción.
