# Feria de la Ciencia STEAM

## Activación

Ejecutar completo `supabase/feria-ciencia.sql` en el SQL Editor del proyecto Supabase de Claudina App. El script puede repetirse sin borrar proyectos ni observaciones. Después actualizar la app y abrir «Feria de la Ciencia».

## Inscripción

Un integrante registra el proyecto desde su cuenta de estudiante. Se incluye automáticamente a quien registra y se agregan los demás integrantes desde una lista de compañeros activos del mismo grado o mediante «Agregar estudiante de otro grado». Séptimo y octavo comparten la lista porque pertenecen al mismo salón. El grado utilizado en los filtros es el de quien lo registra.

Al inicio se escogen una o varias áreas STEAM (Science, Technology, Engineering, Arts o Mathematics) y un profesor asesor de la lista real de docentes registrados. Después se escogen los integrantes desde la lista de compañeros y se escriben el nombre del proyecto, qué quieren hacer y cómo lo harán. Materiales, resultados esperados, bibliografía y apoyo necesario son opcionales. Para guardar un borrador se requieren áreas, asesor y nombre. Al enviar también se comprueban integrantes, qué harán y cómo lo harán.

El estudiante que registra y su acudiente vinculado pueden editar el mismo proyecto. Sus borradores no son visibles para otras familias ni docentes. Los textos sin guardar se conservan por cuenta en el navegador, cuando este permite almacenamiento local; los botones Guardar y Enviar los guardan en Supabase.

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

Cada estudiante recibe únicamente identificador, nombre y grado de sus compañeros activos. La lista inicial no incluye documentos, correos, estudiantes inactivos ni otros grupos. La opción de otro grado consulta únicamente el grado escogido, con los mismos datos mínimos. El docente no recibe esta lista de compañeros en el contexto de la feria. Los integrantes se agregan desde un desplegable y se pueden quitar; quien registra permanece incluido. Supabase valida los identificadores y que los estudiantes estén activos en la institución, y genera los nombres mostrados a partir del registro escolar.

Los proyectos anteriores conservan el texto de integrantes hasta que el estudiante confirme el equipo usando el nuevo selector. El selector no cambia los permisos de edición: editan el estudiante que registra y su acudiente vinculado.

`node tests/feriaIntegrantes.test.mjs` comprueba grupos, privacidad, inactivos, nombres generados en el servidor, inclusión automática, proyectos individuales, salón compartido de 7°/8° y migración repetible.

## Equipos con estudiantes de otros grados

El botón «Agregar estudiante de otro grado» abre una selección de grado y luego de estudiante. Los integrantes se agregan al mismo equipo, sin duplicados, y permanecen identificados al guardar borradores, recargar o volver a editar. Se conserva la lista rápida del grupo propio y el salón compartido de séptimo/octavo.

Para actualizar, ejecutar únicamente `supabase/feria-equipos-entre-grados.sql`, que incluye las mejoras anteriores y conserva los proyectos existentes. La consulta por grado requiere una cuenta autorizada, valida grados 0–8 y solo devuelve identificador, nombre y grado de estudiantes activos. Los integrantes de un proyecto solo pueden ser consultados por su autor y docentes con acceso al proyecto. El estudiante que registra y su acudiente vinculado pueden editarlo.

## Bibliografía

El formulario incluye un campo opcional de Bibliografía de hasta 4000 caracteres para libros, páginas web, videos y otras fuentes consultadas. La información queda guardada y aparece en el detalle que revisan los docentes. Para actualizar una feria existente, ejecutar `supabase/feria-bibliografia.sql`, que también incluye las mejoras anteriores. Los proyectos y borradores previos se conservan; un cliente anterior que no envíe el campo no borra la bibliografía ya guardada.

`node tests/feriaBibliografia.test.mjs` verifica guardado, consulta docente, límites, compatibilidad y migración.

## Familias e impresión

Para actualizar, ejecutar completo `supabase/feria-familias.sql`. Es acumulativo, repetible y conserva proyectos y revisiones. La instalación requiere el módulo de acudientes (`supabase/acudientes.sql`).

La cuenta de acudiente tiene una pestaña Feria de la Ciencia. Puede crear, guardar, enviar y corregir proyectos del estudiante activo vinculado a su sesión. El estudiante y su acudiente comparten los proyectos; Supabase verifica el vínculo en cada solicitud y no admite escoger otro hijo mediante datos enviados por el cliente.

«Imprimir formato en blanco» prepara dos hojas A4 con todos los campos, incluyendo áreas, asesor, integrantes y bibliografía. «Imprimir proyecto» imprime los datos guardados. El diálogo del navegador permite imprimir o guardar como PDF. El papel diligenciado debe entregarse al docente para acompañar su registro; imprimir no registra respuestas automáticamente.

`node tests/feriaFamilias.test.mjs` verifica acceso compartido, separación entre familias, vínculo revocado, roles y migración repetible. La prueba de navegador verifica inscripción desde acudiente, consulta desde estudiante y ambas impresiones.


### Participación de familias y navegación de acudientes

En Feria STEAM el acudiente elige entre inscribir su emprendimiento familiar y acompañar el proyecto estudiantil. Se usan los mismos RPC de feria, permisos por estudiante vinculado, control de versión y revisiones docentes; no se requiere una migración adicional. El título persistido lleva el prefijo reservado `[Emprendimiento familiar] ` para distinguir el tipo sin cambiar la tabla. `feriaFamilias.js` concentra la conversión; la interfaz y la impresión presentan el título sin ese prefijo. El máximo visible de 125 caracteres mantiene el título completo dentro del límite SQL de 150.

En emprendimientos: `materiales` conserva responsable y familiares, `propuesta` lo que ofrecen, `procedimiento` cómo lo elaboran, `resultados_esperados` sus objetivos y `apoyo` las necesidades de exposición. Se conserva la ficha del estudiante como vínculo, sin atribuirle la autoría del emprendimiento. Estos datos son visibles para el estudiante y el acudiente vinculados; los docentes ven los enviados a revisión. No registrar documentos ni teléfonos en estos campos. Los borradores nuevos de familia y estudiante tienen claves locales independientes.

El panel docente permite filtrar por proyectos estudiantiles o emprendimientos familiares. El menú de acudientes muestra cuatro accesos principales y Más para las demás secciones, con sus indicadores de novedades.

Validación: `node tests/feriaEmprendimientos.test.mjs`, `node tests/acudienteFeriaOpciones.test.mjs` y pruebas previas de feria y acudientes.

### Categoría Emprendimiento

El selector admite las cinco áreas STEAM y el enfoque adicional `emprendimiento`, combinables sin duplicados. Antes de guardar esta categoría en una base existente, ejecutar `supabase/feria-emprendimiento.sql` una vez en SQL Editor. La actualización amplía la restricción y las funciones existentes, conserva sus permisos y no elimina proyectos. Es repetible. Las migraciones acumulativas de feria también admiten la nueva categoría.


### Proyectos visibles para todo el equipo

Ejecutar `supabase/feria-proyectos-compartidos.sql` en SQL Editor de Supabase sobre la instalación actual. No requiere repetir los scripts anteriores. La actualización es transaccional y repetible: conserva proyectos y revisiones.

`feria_contexto` y `feria_proyecto` incluyen el mismo proyecto para cada estudiante seleccionado en `integrantes_ids` y su acudiente vinculado, incluso si pertenece a otro grado. También incluye los borradores guardados. El estudiante responsable y su acudiente conservan la edición; los demás consultan los datos y las observaciones. Quitar un integrante revoca ese acceso. No crea copias del proyecto.

Aplica a inscripciones existentes con integrantes seleccionados de la lista. Las inscripciones antiguas con nombres escritos sin IDs necesitan que su responsable confirme el equipo en el selector. Después de ejecutar el SQL, abrir Feria STEAM y pulsar **Actualizar lista** desde la cuenta del compañero.

Validación: `node tests/feriaProyectosCompartidos.test.mjs` y `node tests/feriaUi.test.mjs`.
