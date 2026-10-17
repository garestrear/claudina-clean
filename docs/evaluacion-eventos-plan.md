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
