# Feria de la Ciencia STEAM

## Activación

Ejecutar completo `supabase/feria-ciencia.sql` en el SQL Editor del proyecto Supabase de Claudina App. El script puede repetirse sin borrar proyectos ni observaciones. Después actualizar la app y abrir «Feria de la Ciencia».

## Inscripción

Un integrante registra el proyecto desde su cuenta de estudiante. Puede indicar libremente nombres y grados de todo el equipo, incluso si es un equipo de varios grados. El grado utilizado en los filtros es el de quien lo registra.

Campos principales: nombre del proyecto, integrantes, qué quieren hacer y cómo lo harán. Materiales, resultados esperados y apoyo necesario son opcionales. Los borradores pueden guardarse con solo el nombre del proyecto. Al enviar se comprueban los cuatro campos principales.

Solo la cuenta que registra el proyecto puede editarlo. Sus borradores no son visibles para otros estudiantes ni docentes. Los textos sin guardar se conservan por cuenta en el navegador, cuando este permite almacenamiento local; los botones Guardar y Enviar los guardan en Supabase.

## Revisión

Cualquier docente puede consultar los proyectos enviados de todos los grados, independientemente de sus grupos asignados. Puede filtrarlos por grado o estado y buscar por título, integrantes o estudiante que los registró.

Los estados son Borrador, Por revisar, En ajustes y Aprobado. Para pedir ajustes debe escribir una observación. Cada revisión conserva su autor, fecha y versión del contenido. El estudiante puede corregir y reenviar el proyecto; las observaciones anteriores se conservan. Modificar un aprobado lo devuelve a ajustes hasta un nuevo envío.

La interfaz se integra con los indicadores de novedades de Claudina App. Las revisiones aparecen al volver a abrir o actualizar el proyecto.

## Seguridad y comprobaciones

Las tablas son privadas y se accede a ellas mediante funciones que validan cuenta, rol, ficha activa y propiedad del proyecto. La revisión es exclusiva para docentes y no permite revisar borradores. Guardados y revisiones llevan identificadores de solicitud para evitar duplicados en reintentos. Una versión esperada impide sobrescribir cambios de otra sesión o aprobar contenido que cambió durante la revisión.

Pruebas:

- `node tests/feriaSql.test.mjs`: roles, TS/JR, borradores privados, idempotencia, revisiones, historial y conflictos.
- `node tests/feriaUi.test.mjs`: formulario conectado a PostgreSQL de prueba, borradores, recuperación, errores y observaciones.
- `node tests/feriaBrowser.test.mjs`: recorrido móvil completo de inscripción, borrador privado, envío, solicitud de ajustes, reenvío y aprobación por otro docente; capturas para revisión visual.
- `npm run build`: compilación de producción.

Para el navegador de pruebas puede usarse `FERIA_TEST_CHROMIUM` para indicar un ejecutable local de Chromium. Las pruebas usan cuentas ficticias y una base PostgreSQL en memoria; no modifican datos reales.
