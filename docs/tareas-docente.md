# Tareas visibles para docentes

Inicio muestra un recordatorio antes del horario con el número de propuestas pendientes de aprobación en los grupos del docente. El botón Revisar tareas abre directamente la revisión. Si no hay pendientes muestra Ver tareas; si falla la consulta muestra el error en lugar de afirmar que no hay pendientes.

Comunidad tiene una tarjeta Tareas con contador persistente. El contador corresponde al estado pendiente y no se borra por visitar la página. Se actualiza cada minuto, al recuperar el foco y después de aprobar o rechazar. Las propuestas ya no se suman también al indicador de Avisos.

Tareas ofrece Por revisar y Publicadas. Las publicadas son los avisos de tipo tarea efectivamente publicados y visibles para estudiantes y acudientes; conserva sus instrucciones y fotos. Ambas listas se filtran por grupos del docente.

En el horario docente, las tareas de la fecha o semana seleccionada se muestran antes de las clases, fuera de Opciones. Se conserva el filtro por profesor, materia y grado, con un desplegable para instrucciones y fotos. La fecha es la de entrega; no implica que el profesor ya haya calificado el trabajo. No se añade un estado de calificación individual.

No requiere migración SQL. Conserva los permisos de revisión y publicación existentes.

Pruebas: pendientesTareas, profesorPanel, profesorNavegacionBrowser, inicioEstudiante, tareasEstudiantes, tareasHorario y novedadesFuentes/Ui; compilación de producción. El navegador recorre recordatorio → revisión → aprobación → publicadas → contador actualizado, usando Supabase simulado. La prueba PostgreSQL de tareas valida la aprobación y su publicación real.
