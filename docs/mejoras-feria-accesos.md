# Correcciones, avisos individuales y acceso estudiantil

Ejecutar completo `supabase/mejoras-feria-accesos.sql` en Supabase > SQL Editor. Puede repetirse: no elimina proyectos ni cuentas. Requiere los módulos de feria, familias, póster y correcciones ya utilizados por la institución. El script actualiza la corrección de textos, conserva el póster como opcional, crea el registro privado para evitar avisos duplicados y actualiza el acceso estudiantil.

- **Corregir textos:** admite un póster vacío. Si no existía enlace, no lo envía como campo modificado; si existía, permite borrarlo. No cambia equipo, categoría, asesor ni estado.
- **Vista de acudiente:** márgenes laterales, superficie suave y tarjetas con espacio interior en escritorio y celular.
- **Avisos de feria:** se intentan automáticamente después de guardar correcciones de texto o una revisión de un proyecto de Claudina. El servidor verifica la autoría de un cambio reciente y obtiene sus destinatarios de la base de datos: estudiantes activos del equipo y cuentas de sus acudientes vinculados. Solo reciben push los dispositivos con avisos activados. No se difunde a otros cursos. Al tocar el aviso se abre el proyecto. Si no hay sesión de acudiente, se ofrece su ingreso. Los proyectos externos no tienen este envío porque no hay fichas estudiantiles vinculadas.
- **Imprimir listas:** Más > Administración > Estudiantes. Seleccionar el grado y pulsar «Imprimir lista por grado». La ventana contiene nombre, correo, documento y estado, separa grados en páginas y permite imprimir o guardar PDF. Respeta los grupos y permisos existentes. «Todos los grados» imprime los grados del filtro permitido.
- **Acceso:** estudiante con ficha activa y correo registrado ingresa con su correo y documento inicial; se crea o vincula su cuenta al primer ingreso. Una cuenta Google sin contraseña puede habilitar el documento inicial. Una cuenta que ya tiene contraseña nunca se restablece durante el ingreso. La contraseña nueva se cambia en Más > Mi cuenta. Google sigue disponible.

El servidor usa las variables existentes SUPABASE_URL/VITE_SUPABASE_URL, SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY y las VAPID. No se publican claves privadas en el cliente.

Si falla una notificación, el guardado ya está confirmado y el docente ve un mensaje indicando que el contenido puede consultarse dentro de la app. No se reenvía una misma solicitud repetida. Las suscripciones expiradas se retiran. No se incluyen comentarios, correos ni documentos en la notificación.

Validación: `npm run test:mejoras-feria`, `npm run build` y `node tests/feriaCorreccionesBrowser.test.mjs`. La prueba del navegador puede usar un Chromium local mediante FERIA_TEST_CHROMIUM.
