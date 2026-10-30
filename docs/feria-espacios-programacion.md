# Aulas, espacios y programación

Acceso docente: **Feria STEAM → Aulas y programación**. Activar ejecutando completo `supabase/feria-espacios-programacion.sql` en Supabase > SQL Editor. Requiere los módulos de proyectos de Claudina e instituciones invitadas. No importa horarios de años anteriores ni cambia proyectos o sus aprobaciones.

El módulo crea 9 salones, el restaurante y el patio. Los nombres se pueden ajustar para reflejar los salones reales, agregar espacios y deshabilitar los que no se utilizarán. Al repetir el SQL no se reemplazan nombres, cupos o reservas ya configurados. Los cupos y aforos iniciales quedan por definir, sin inventar capacidades.

- **Puestos simultáneos:** máximo de reservas compartidas concurrentes. Si no se define, no se impone un máximo numérico; la tarjeta lo indica. Una reserva representa un proyecto o una actividad, no una persona.
- **Aforo de visitantes:** dato de planificación para futuras visitas y recorridos del carrusel. No calcula todavía grupos de visitantes ni rotaciones.
- **Recursos:** electricidad, espacio cubierto y observaciones.
- **Programación:** fecha y horario en Colombia, proyecto aprobado o actividad independiente, aula/espacio, mesa o puesto, docente y/o entidad responsable, notas de logística y exclusividad.

Los proyectos aprobados pueden ser de Claudina, emprendimientos familiares o instituciones invitadas. Varias mesas pueden coexistir en el mismo salón. Una actividad exclusiva ocupa todo el espacio durante su horario (por ejemplo, un taller o un turno de refrigerio).

La base de datos valida los cruces, además de la vista previa del navegador:

1. Un proyecto no puede estar en dos lugares simultáneamente.
2. Una reserva exclusiva no puede solaparse con ninguna otra en el mismo espacio.
3. Un puesto/mesa con el mismo nombre no se puede duplicar durante un solapamiento.
4. Se respeta el máximo de puestos simultáneos; se cuenta la concurrencia real y no la suma de todas las reservas que tocan el tramo.
5. El final de una reserva puede coincidir con el inicio de la siguiente.
6. Los cambios docentes usan versiones para impedir sobrescrituras. Un bloqueo de transacción serializa las escrituras y evita carreras entre espacios/proyectos.

Cancelar conserva el registro y libera su horario. Antes de deshabilitar un espacio, hay que cancelar o reubicar sus reservas activas. No se permite bajar los cupos por debajo de la ocupación ya programada. Si un proyecto deja de estar aprobado o se elimina, su reserva se conserva y queda marcada para revisión. Al eliminar un docente, sus reservas se conservan con el nombre del responsable como referencia.

El tablero muestra disponibilidad por el tramo elegido, reservas del día y proyectos aprobados todavía por ubicar. La impresión agrupa por espacio y permite guardar como PDF. Este módulo es de organización docente: todavía no genera ni publica el recorrido automático de grupos por carrusel.

Pruebas: `node tests/feriaEspaciosSql.test.mjs`, `node tests/programacionFeria.test.mjs`, `node tests/feriaEspaciosBrowser.test.mjs`. FERIA_TEST_CHROMIUM permite indicar el ejecutable local del navegador.

## Asignación automática al aprobar

Ejecutar `supabase/feria-asignacion-automatica.sql` después del SQL de espacios.
Se ejecuta en la misma transacción de aprobación, para proyectos internos y de
instituciones invitadas. Reserva el 6 de noviembre de 2026, de 07:00 a 13:00.
Solo participan salones habilitados con `cupos > 1`; las capacidades sin definir,
los espacios de un puesto y las reservas exclusivas se excluyen. Se calcula la
ocupación simultánea máxima de cada salón y se minimiza la fracción
`(ocupación + 1) / cupos`, con desempate estable. El mismo bloqueo transaccional
que usan las reservas manuales evita sobreasignaciones concurrentes.

Si no hay lugar disponible, se conserva la aprobación sin crear una reserva.
El proyecto continúa visible entre los aprobados sin ubicación. El botón
“Asignar aulas a proyectos pendientes” reintenta todos los aprobados internos
y externos, sin modificar ubicaciones ya existentes. Permite ubicar los
aprobados anteriores a esta actualización tras configurar las capacidades.
La instalación del SQL no mueve ni cancela reservas. Las ubicaciones se pueden
cambiar con “Editar ubicación y horario”, respetando los controles existentes.
La reprobación posterior mantiene la reserva marcada para revisión, igual que
las reservas manuales; el docente puede cancelarla.
