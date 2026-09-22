# Claudina Clean

**Convivimos, cuidamos y transformamos**

PWA escolar para organizar, verificar y valorar el aseo de los salones del C.E.R. Claudina Múnera.

## V1
- Roles: profesor/administrador y estudiante.
- Grupos de aseo: 6° y 7°–8°.
- Asignación editable de lunes a viernes.
- Registro de tareas: barrer, trapear, basura, puestos, tablero, TV y aporte especial.
- Calificación docente 1–10 con caritas.
- Observaciones y evidencias fotográficas.
- Valoración del aseo por estudiantes.
- Reportes de aseo mal realizado con evidencia.
- Historial y estadísticas.
- Estudiantes activos/inactivos para conservar historial.

## Tecnología
- Frontend/PWA: Vite + React
- Backend, autenticación, BD y Storage: Supabase
- Despliegue: Vercel

> La calificación oficial del profesor se mantiene separada de la valoración de los estudiantes.

## Cuentas de estudiantes

1. Ejecutar `supabase/cuentas-estudiantes.sql` en Supabase SQL Editor (una sola vez). Este paso agrega el correo a cada ficha y vincula automáticamente una cuenta tras confirmar el correo. No afecta las invitaciones de profesores.
2. En **Authentication → Providers → Email**, habilitar correo y contraseña. Mantener la confirmación de correo activa. En **URL Configuration**, poner `https://claudina-clean.vercel.app` como Site URL y añadir `https://claudina-clean.vercel.app/**` en Redirect URLs.
3. Para continuar con Google, configurar **Authentication → Providers → Google** en Supabase con Client ID y Client Secret de un cliente OAuth web creado en Google Cloud. En Google Cloud, configurar el origen `https://claudina-clean.vercel.app` y la URI de redirección que muestra Supabase (habitualmente `https://rfgaaivpenthetllpvcq.supabase.co/auth/v1/callback`). Si Google mantiene la aplicación en modo de prueba, añadir los correos de estudiantes como usuarios de prueba o completar la publicación de la pantalla de consentimiento.
4. El profesor registra el correo exacto de cada estudiante en **Estudiantes**. El estudiante entra con Google o crea cuenta con ese correo, confirma el mensaje recibido y luego ingresa. La pantalla indica si la ficha aún no está vinculada. No se usa un enlace de invitación docente.

No introducir claves privadas de Google en el repositorio ni en las variables públicas `VITE_` de Vercel. Configurarlas solamente en el panel de Supabase.
