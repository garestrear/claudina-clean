# Rechazar proyectos de la Feria STEAM

Ejecutar `supabase/feria-rechazar.sql` completo en Supabase > SQL Editor, después de instalar `feria-ciencia.sql` y `feria-invitados.sql`. La actualización es repetible y conserva las inscripciones y su historial.

En el detalle de un proyecto, el docente elige **Rechazar proyecto**, escribe un motivo y confirma. Puede rechazar proyectos enviados, en ajustes o aprobados. Incluye proyectos estudiantiles, emprendimientos familiares y propuestas de instituciones invitadas.

La lista docente muestra **Proyectos vigentes (sin rechazados)** por defecto. El filtro **Rechazado** permite consultar los descartados; **Todos los estados** reúne ambos grupos. La lista interna muestra también el número de rechazados.

Los integrantes y sus acudientes pueden consultar el estado y el motivo. Los rechazados no se borran ni admiten nuevos envíos del participante. Un docente puede cambiarlo a **En ajustes** y dejar una observación para permitir que el equipo actualice y envíe de nuevo su propuesta; también conserva la opción de aprobarlo directamente. Los rechazos externos tampoco aparecen entre proyectos públicos aprobados.

Validación: `node tests/feriaRechazar.test.mjs`, pruebas SQL existentes de feria interna e invitados, prueba de navegador de feria y `npm run build`.

## Solo lectura después de rechazar

Ejecutar `supabase/feria-rechazados-solo-lectura.sql` sobre la instalación existente. Los estudiantes, integrantes, acudientes y responsables externos pueden consultar el proyecto rechazado y sus observaciones, pero no editar, guardar ni reenviar, incluso desde formularios abiertos antes del rechazo. Un docente puede cambiar a cualquier estado; al dejar de estar Rechazado se habilita nuevamente la edición según los permisos del equipo.
