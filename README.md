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

## Valoraciones y reportes estudiantiles

Ejecutar `supabase/participacion-estudiantil.sql` **después** de `supabase/security.sql` y `supabase/cuentas-estudiantes.sql`. La migración limita los nuevos reportes y valoraciones a cuentas estudiantiles vinculadas y activas. El estudiante puede valorar de 1 a 5 el registro oficial de aseo de hoy, actualizar su valoración, enviar un reporte con foto opcional y consultar el estado de sus reportes. El profesor ve reportes, fotos y valoraciones en la pestaña **Reportes**, y puede cambiar el estado a pendiente, revisado o descartado. La calificación oficial de 1 a 10 sigue independiente.

## Fecha de valoración y foto del turno

Ejecutar `supabase/fechas-y-evidencia-aseo.sql` después de `participacion-estudiantil.sql`. La valoración se limita a los días calendario 1 a 4 posteriores al registro oficial y muestra ayer por defecto. El estudiante asignado a un turno puede enviar una sola foto de su propio aseo durante ese mismo día (hora de Colombia), incluso antes de que el docente guarde el registro oficial. La foto queda en el bucket privado `evidencias` y se muestra en **Reportes** al profesor.

## Grados 1.º a 8.º y carga masiva

Ejecutar primero `supabase/grados-uno-a-ocho.sql` en Supabase SQL Editor. En **Estudiantes → Carga masiva**, seleccionar un `.xlsx` con columnas **Nombre del estudiante**, **Correo** y **Grado** (número del 1 al 8). Los encabezados pueden estar en cualquiera de las primeras 25 filas. Si el libro tiene varias hojas, se intentan leer todas las que tengan las tres columnas; se informa cuáles se omiten. Cada fila debe incluir su propio grado; ya no se deduce del nombre de la hoja. Ejemplo: `YEREMY JOSUE ALVAREZ PEREIRA | yeremyalvarezp@claudinamunera.edu.co | 1`.

La vista previa permite corregir filas, omitir registros y vincular alumnos ya existentes para conservar su historial. La importación solo ocurre al pulsar **Confirmar**; se valida y guarda todo el lote en una transacción. Registrar una dirección en Claudina Clean no crea un buzón de correo ni una cuenta de Google: esos servicios deben existir aparte.

El listado original suministrado contiene columnas de matrícula y nombres, pero no las tres columnas requeridas. Se debe preparar con correo y grado antes de importarlo. Las hojas de jardín y transición no se incluyen porque la aplicación se extiende de primero a octavo.

## Alertas de evacuación

El protocolo del C.E.R. Claudina Múnera indica evacuar hacia la manga frente al colegio por la salida principal o la salida de emergencia, con precaución al cruzar la calle. El timbre continuo durante **30 segundos** es la señal presencial. La webapp no acciona el timbre: una persona debe hacerlo según el protocolo escolar. Las notificaciones son un apoyo y no sustituyen esa señal ni las indicaciones de los docentes.

**Preparación antes de publicar esta función:**

1. Ejecutar `supabase/alerta-evacuacion.sql` en el SQL Editor. Crea el registro de alertas y las suscripciones de dispositivos; solo el servidor puede activar una alerta y solo un profesor puede finalizarla.
2. Generar una sola pareja de claves VAPID con `npx web-push generate-vapid-keys`. Conservar la clave privada fuera del repositorio y del chat.
3. Configurar en Vercel, para Production, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (por ejemplo `mailto:correo-de-contacto@dominio`). Ninguna clave privada debe llevar prefijo `VITE_`. Volver a desplegar después de configurarlas.
4. Cada profesor y estudiante debe abrir la webapp con su cuenta y pulsar **Activar avisos en este celular**. En iPhone, añadir antes la webapp a la pantalla de inicio. Probar con varios teléfonos reales y la aplicación cerrada.
5. Realizar un **simulacro** y comprobar el timbre, la pantalla dentro de la app, la notificación push, la finalización de la alerta y el recuento de envíos. El recuento confirma respuestas de los servicios de push, no que cada persona haya leído el aviso.

La función `/api/emergency` comprueba la sesión y el rol docente, activa una única alerta y envía avisos a los dispositivos suscritos. Si falla el envío, la alerta puede seguir activa dentro de la app y la pantalla docente informa el fallo. Mientras la app esté abierta, consulta el estado cada tres segundos y también al volver a primer plano. El modo de simulacro se distingue visualmente de una emergencia real.
