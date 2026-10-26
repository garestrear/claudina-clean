# Eliminar docentes

Ejecutar una vez `supabase/eliminar-docentes.sql` completo en Supabase > SQL Editor, después de haber instalado `supabase/docentes-administracion.sql`.

En Administración > Profesores y permisos, cada docente tiene un botón **Eliminar docente** con confirmación. Solo un administrador puede usarlo.

La operación retira el rol profesor y sus permisos administrativos, elimina su invitación y reasigna sus proyectos como asesor a Gustavo Restrepo. Mantiene la cuenta y el perfil histórico para conservar la autoría de registros y revisiones; no borra datos académicos. El perfil deja de aparecer en la lista de docentes y de asesores.

No permite eliminar el propio acceso, a Gustavo Restrepo ni al último administrador. Si hay asesorías y no puede identificar una única cuenta docente de Gustavo por su nombre completo o correo institucional, cancela toda la operación sin cambios. Los formularios abiertos tampoco pueden volver a asignar un asesor retirado.

Validación: `node tests/eliminarDocentes.test.mjs`, `node tests/docentesAdministracion.test.mjs` y `npm run build`.
