# Correcciones de escarapelas

Ejecutar `supabase/feria-escarapelas-correcciones.sql` después de las migraciones de participantes y ubicación de credenciales. Actualizar participantes y descargar de nuevo las escarapelas. No modifica PDFs ya impresos.

La migración corrige únicamente el proyecto de Claudina cuyo título completo corresponde a Weather Scientists: Análisis climático y prevención de riesgos (admite punto final). Quita Emprendimiento de sus áreas, incluye Ciencia y reclasifica su placa en STEM si es necesario. Conserva su número general; el código de categoría puede cambiar al prefijo STEM. Otras clasificaciones no se modifican. Los colores de la escarapela se toman de la categoría de placa.

Los emprendimientos familiares ya no crean participantes automáticos del estudiante vinculado. Los anteriores se desactivan sin eliminar registros ni certificados. Las personas adultas registradas manualmente permanecen disponibles; se deben registrar con su nombre real, sin vincular al estudiante como expositor. Cambiar el título/tipo de proyecto también actualiza la generación de participantes.

La escarapela y la tarjeta de participante muestran espacio y puesto juntos. Si hay varias ubicaciones, también muestran su horario. La ausencia de ubicación/puesto se indica expresamente. En el PDF el nombre baja 6 mm y se ajusta en un bloque de altura limitada para conservar espacio a institución, proyecto y ubicación. La vista previa también añade separación al nombre.

Validaciones: SQL para proyecto STEM, estudiantes familiares excluidos, adultos conservados, puestos actualizados y nuevas inscripciones familiares; PDF renderizado para revisar nombre y ubicación; `node tests/ubicacionEscarapela.test.mjs`; compilación de producción.
