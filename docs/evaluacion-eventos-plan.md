# Evaluación de eventos — plan de implementación

## Alcance
- Docente crea evento (título, descripción, estado, destinatarios por rol y grado), publica, cierra y consulta resultados.
- Estudiantes, docentes y acudientes autenticados pueden responder una vez por evento con nota entera de 1 a 10 y comentario opcional (máximo 1000 caracteres).
- Notificación push con URL profunda al evento, reutilizando /api/aviso-notificacion y el service worker existente; confirmar compatibilidad de roles y segmentación antes de modificarlo.
- Pantalla de evaluaciones pendientes y anteriores para quienes no reciban el push.
- Estadísticas: total, promedio, distribución de notas y comentarios sin identificadores.

## Privacidad y seguridad
- Separar control de participación de respuestas; nunca exponer un join identidad-respuesta a roles cliente.
- Preferir RPC SECURITY DEFINER con search_path fijado, validación auth.uid(), permisos y transacción atómica para impedir respuestas duplicadas.
- RLS restrictiva: sin SELECT directo sobre respuestas o tabla de participación para clientes. Los resultados solo salen por RPC agregada.
- No registrar identificadores de participantes junto con puntuaciones/comentarios en logs, payloads push o analíticas.
- Los comentarios pueden revelar identidad por su propio contenido: advertir al usuario y evitar mostrar resultados de grupos muy pequeños; definir umbral antes de publicar.
- Revisar si el token de acudientes usa auth.uid() y cómo se valida su rol; no suponer que comparte la misma autorización que estudiantes.
- El docente debe poder moderar comentarios abusivos sin acceder a la identidad del autor.

## Integración
- Revisar src/App.jsx, src/Acudiente.jsx, src/Avisos.jsx, src/Encuestas.jsx, API push, service worker y migraciones SQL.
- Crear migración supabase/evaluacion-eventos.sql, componente src/EvaluacionEventos.jsx y pruebas.
- Verificar build y tests antes de fusionar; desplegar después de ejecutar migración SQL y probar en teléfonos reales.
- No modificar producción ni activar envío masivo durante desarrollo.

## Eliminar evaluaciones creadas por error

Ejecutar `supabase/evento-eliminar.sql` en SQL Editor. La instalación es repetible y no elimina datos. En cada evaluación, un docente puede abrir Más opciones → Eliminar evaluación. Se consulta el conteo actual de respuestas y se pide escribir el título exacto antes de eliminar definitivamente la evaluación, sus respuestas, comentarios y participantes. Cancelar conserva todo. Si cambia el título o llegan respuestas nuevas, el servidor exige revisar la confirmación. Los estudiantes y acudientes no pueden eliminar. La función valida los permisos en Supabase, sin abrir acceso directo a las tablas. No se elimina ninguna evaluación automáticamente al publicar.

Pruebas: `node tests/eventoEliminar.test.mjs` y `node tests/eventoEliminarUi.test.mjs`.

## Descargar informe

Dentro de Resultados, «Descargar informe» consulta nuevamente los datos autorizados de Supabase y descarga un documento HTML independiente. Incluye título, descripción, estado, fecha de generación en Colombia, grados, total y promedio general, tabla de los tres grupos, distribución 1–10 y comentarios por grupo. Distingue resultados parciales de una evaluación abierta y conserva respuestas históricas sin clasificar. El documento puede abrirse sin conexión e imprimirse o guardarse como PDF desde su botón. Los textos introducidos por participantes se escapan para evitar ejecución de HTML. No exporta cuentas, correos ni identificadores.
