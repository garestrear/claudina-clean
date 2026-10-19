# Feria de la Ciencia STEAM

## Activación

Ejecutar completo `supabase/feria-ciencia.sql` en el SQL Editor del proyecto Supabase de Claudina App. El script puede repetirse sin borrar proyectos ni observaciones. Después actualizar la app y abrir «Feria de la Ciencia».

## Inscripción

Un integrante registra el proyecto desde su cuenta de estudiante. Se incluye automáticamente a quien registra y se agregan los demás integrantes desde una lista de compañeros activos del mismo grado. Séptimo y octavo comparten la lista porque pertenecen al mismo salón. El grado utilizado en los filtros es el de quien lo registra.

Al inicio se escogen una o varias áreas STEAM (Science, Technology, Engineering, Arts o Mathematics) y un profesor asesor de la lista real de docentes registrados. Después se escogen los integrantes desde la lista de compañeros y se escriben el nombre del proyecto, qué quieren hacer y cómo lo harán. Materiales, resultados esperados y apoyo necesario son opcionales. Para guardar un borrador se requieren áreas, asesor y nombre. Al enviar también se comprueban integrantes, qué harán y cómo lo harán.

Solo la cuenta que registra el proyecto puede editarlo. Sus borradores no son visibles para otros estudiantes ni docentes. Los textos sin guardar se conservan por cuenta en el navegador, cuando este permite almacenamiento local; los botones Guardar y Enviar los guardan en Supabase.

## Revisión

Cualquier docente puede consultar los proyectos enviados de todos los grados, independientemente de sus grupos asignados. Puede filtrarlos por área, asesor, grado o estado y buscar por título, integrantes o estudiante que los registró.

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

## Actualización para ferias ya activadas

Quienes ya ejecutaron el SQL original deben ejecutar `supabase/feria-areas-asesor.sql` completo. Incluye la selección múltiple de áreas, profesor asesor, lista de docentes y datos para los filtros. Es repetible y conserva proyectos, estados, revisiones y versiones. Los proyectos anteriores permanecen sin clasificar y sin asesor hasta que se actualicen; no se les asignan datos arbitrarios. Los borradores locales anteriores se recuperan conservando su texto y solicitan completar los nuevos campos.

La selección del asesor se comprueba en Supabase: solo acepta perfiles con rol profesor. Su asignación no limita que cualquier docente pueda revisar el proyecto.

`node tests/feriaClasificacion.test.mjs` comprueba validación, docentes disponibles, múltiples áreas, migración incremental y compatibilidad con borradores anteriores.

## Selector de integrantes

Ejecutar `supabase/feria-integrantes.sql` para actualizar una feria ya activada. Es acumulativo: también incluye las áreas STEAM y el profesor asesor, por lo que no es necesario volver a ejecutar los scripts anteriores.

Cada estudiante recibe únicamente identificador, nombre y grado de sus compañeros activos. La lista no incluye documentos, correos, estudiantes inactivos ni otros grupos. El docente no recibe esta lista de compañeros en el contexto de la feria. Los integrantes se agregan desde un desplegable y se pueden quitar; quien registra permanece incluido. Supabase valida los identificadores y el grupo, y genera los nombres mostrados a partir del registro escolar.

Los proyectos anteriores conservan el texto de integrantes hasta que el estudiante confirme el equipo usando el nuevo selector. El selector no cambia los permisos de edición: continúa editando la cuenta que registró el proyecto.

`node tests/feriaIntegrantes.test.mjs` comprueba grupos, privacidad, inactivos, nombres generados en el servidor, inclusión automática, proyectos individuales, salón compartido de 7°/8° y migración repetible.
