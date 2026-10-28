# Correcciones de textos por profesores

Activación: ejecutar completo `supabase/feria-correcciones-docentes.sql` en Supabase SQL Editor después de `feria-poster.sql` y `feria-familias-estados.sql`. Se puede repetir sin perder proyectos ni historial.

Todos los profesores, sean o no asesores del proyecto, pueden pulsar **Corregir textos** desde la tarjeta o el detalle de un proyecto de Claudina. Las propuestas invitadas tienen el botón en el detalle. El formulario permite corregir título, propuesta, procedimiento, materiales, resultados esperados, bibliografía, enlace al póster y apoyo. En emprendimientos familiares usa sus rótulos habituales y conserva el prefijo de categoría. En proyectos invitados también permite corregir el texto de integrantes; no cambia contactos ni autorizaciones.

**Guardar correcciones** conserva el estado (incluidos aprobado y rechazado), integrantes vinculados, responsable del registro, asesor, áreas, categoría y números de placa. Incrementa la versión y, en proyectos de Claudina, la revisión del contenido. No emite una revisión ni vuelve a enviar el proyecto. Los certificados ya emitidos conservan sus datos históricos.

Cada corrección registra profesor, fecha, versión anterior y los valores anteriores/nuevos sólo de los campos modificados. El historial se muestra en **Correcciones de los profesores**, para los profesores y las personas autorizadas a consultar ese proyecto. La tabla de auditoría no tiene acceso directo de clientes; el servidor verifica la autorización del detalle antes de devolver el historial.

El servidor limita los campos y longitudes, valida el enlace al póster y rechaza intentos de modificar estado, autores, equipo, clasificación o autorizaciones por este formulario. Los estudiantes no pueden usar el RPC docente, y el rechazo sigue bloqueando su edición.

Si otra persona cambia el proyecto mientras se corrige, no se sobrescribe: el formulario conserva lo escrito y muestra un aviso. Volver al detalle y actualizar antes de reabrir la corrección. Una repetición de la misma solicitud no duplica la corrección. Guardar sin modificar nada no crea una entrada de auditoría.

Verificación: pruebas SQL de dos docentes, todos los estados, proyectos internos/externos/familiares, permisos, datos preservados, validación, historial, reintentos y versiones; prueba en navegador de corrección, consulta estudiantil e intento obsoleto; compilación de producción.
