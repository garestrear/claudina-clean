# Cierre de inscripciones STEAM

Ejecutar `supabase/feria-cierre-inscripciones.sql` completo en Supabase SQL Editor antes de publicar la interfaz. La migración es repetible y empieza con las inscripciones abiertas, sin fecha: no impone una fecha histórica.

En Feria STEAM > Proyectos Claudina > Administrar plazo de inscripción, un docente puede cerrar inmediatamente o guardar una fecha y hora de Colombia. Guardar plazo / reabrir quita el cierre manual; para reabrir después de vencer el plazo, quitar la fecha o elegir una futura.

El cierre bloquea inserciones, modificaciones y eliminaciones en feria_proyectos para estudiantes y acudientes, incluidos borradores y emprendimientos familiares. Un trigger aplica la regla también desde páginas antiguas. Los docentes conservan sus permisos existentes para revisión y logística. La consulta, impresión, proyectos externos y concurso de puentes conservan sus flujos independientes.

La interfaz consulta el estado cada 30 segundos y al vencer la fecha. Si no puede consultar el estado, deshabilita la inscripción y edición hasta recuperarlo. Los borradores locales se conservan.

Validación: `node tests/feriaCierreSql.test.mjs` y `npm run build`.
