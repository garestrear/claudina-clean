# Integrantes desde la revisión docente

Activar `supabase/feria-integrantes-docentes.sql` después de las migraciones de correcciones docentes y edición de equipos.

Feria STEAM → Proyectos Claudina → Revisar proyecto → Integrantes del proyecto. Seleccionar grado y estudiante para agregar; pulsar Quitar para eliminar; aplicar con Guardar revisión. Debe quedar al menos un integrante. La lista ofrece estudiantes activos y permite conservar integrantes anteriores inactivos.

La operación funciona aunque las inscripciones estén cerradas y conserva estado, asesor, aula y responsable original del registro. Las correcciones se registran en el historial docente con los nombres anteriores y nuevos. El responsable original conserva el acceso como registrante; los demás participantes acceden según los integrantes actuales. Las credenciales se deben volver a generar después del cambio.

Pruebas: `node tests/feriaIntegrantesDocentesSql.test.mjs`, `node tests/feriaEquipoDocenteBrowser.test.mjs`, `node tests/feriaCorreccionesSql.test.mjs` y `npm run build`.
