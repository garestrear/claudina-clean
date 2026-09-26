-- Ejecutar una vez antes de publicar la actualización.
-- Conserva los mensajes ocultos y permite volver a publicarlos.
alter table public.mensajes_estudiantes
drop constraint if exists mensajes_estudiantes_estado_check;

alter table public.mensajes_estudiantes
add constraint mensajes_estudiantes_estado_check
check (estado in ('pendiente','aprobado','rechazado','oculto'));
