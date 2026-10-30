# Evaluación de jurados · Feria STEAM 2026

## Activación

1. En Supabase → SQL Editor, ejecutar completo `supabase/feria-evaluacion-jurados.sql`, después de las actualizaciones existentes `feria-jurados.sql`, `feria-placas.sql` y `feria-espacios-programacion.sql`. Es repetible y no borra proyectos ni evaluaciones.
2. En Authentication → URL Configuration, comprobar que el Site URL sea `https://claudina-clean.vercel.app` y que el dominio esté permitido para los enlaces de acceso; autorizar `https://claudina-clean.vercel.app/**` si no lo está. Mantener el registro por correo habilitado para la primera entrada de jurados externos. En producción, verificar el proveedor de correo/SMTP y los límites de envío antes de convocarlos.
3. Desde una cuenta docente: Feria STEAM → Herramientas → Evaluación de jurados.

No se necesitan nuevas variables ni claves secretas en el navegador. El módulo reutiliza Supabase Auth y las RPC de la app.

## Cuentas y recorrido

- Los candidatos existentes aparecen automáticamente. También se puede registrar un jurado externo o un docente escribiendo nombre y correo, institución, profesión y teléfono opcionales.
- «Guardar y habilitar cuenta» concede la participación como jurado por correo. La cuenta de autenticación externa se crea al solicitar su primer enlace de acceso; solo el correo verificado y habilitado puede consultar visitas y evaluar. No se concede un perfil docente. Los docentes conservan su rol institucional.
- El acceso es `https://claudina-clean.vercel.app/?ingreso=jurado`, también disponible como botón en el inicio. El jurado solicita su enlace, lo abre y consulta «Mi recorrido». No se envían invitaciones automáticamente al habilitar candidatos.
- Registrar otros conflictos de interés. Se excluyen automáticamente el asesor y el autor por la identidad de su cuenta. Las áreas son una preferencia de asignación, no una exclusión.
- Confirmar las categorías de evaluación. Puentes infantil y juvenil se seleccionan explícitamente; las categorías de las placas se usan como valor inicial y no cambian al ajustar la rúbrica. La prueba de carga del concurso no se incorpora automáticamente a la nota de la rúbrica.
- Definir una franja de 110 a 120 minutos. Son diez rondas posibles de 10 minutos de visita más un minuto para desplazarse. Cada proyecto debe tener una reserva de aula activa que cubra las diez rondas; ampliar la reserva en «Aulas y programación» cuando sea necesario. No se cambia la programación de exposiciones desde este módulo.
- Preparar y revisar la propuesta de recorridos, y guardarla. El sistema necesita al menos tres jurados y `ceil(3 × proyectos aprobados / 10)`. El reparto equilibra cargas y evita duplicidades y cruces de ronda para un mismo jurado o proyecto. Incluye aprobados Claudina y de instituciones invitadas; no incluye borradores ni rechazados.
- Se favorece afinidad por áreas en el flujo de asignación. No se resuelve una ruta geográfica óptima entre aulas; se presupone el desplazamiento corto acordado.

El servidor valida nuevamente todo el plan dentro de una transacción: habilitación, conflictos, aulas, horarios, tres jurados distintos por proyecto y máximo diez visitas por jurado. La propuesta del navegador no puede saltarse estas reglas. No se aceptan planes parciales y un error conserva el plan anterior.

## Evaluación y resultados

Se califican cinco criterios de 1 a 5 con pesos por categoría, normalizados a 100 puntos. Hay rúbricas para Ciencia y Tecnología, Arte y Creatividad, Emprendimientos, Familias y ambos concursos de Puentes. Los comentarios incluyen «Lo más destacado» y «Una sugerencia para mejorar».

Los cambios se guardan localmente y se sincronizan automáticamente con la app. El estado distingue borrador local, pendiente de sincronizar y guardado en servidor. Sin conexión, conservar el mismo dispositivo; al volver a abrir la visita se recupera el borrador compatible con la versión del servidor. El botón «Guardar / reintentar sincronización» permite reintentar. Si cambió la versión en otro dispositivo, se evita sobrescribirla.

«Enviar evaluación definitiva» requiere completar los cinco criterios y confirmación del jurado. La puntuación se calcula en el servidor; el envío es idempotente y bloquea cambios posteriores. Un jurado no ve las notas de otros jurados.

El panel docente muestra asignaciones, borradores y evaluaciones enviadas. El promedio definitivo solo aparece al completar tres notas. Diferencias de al menos 25 puntos generan una alerta de revisión sin alterar las notas. Los resultados son reservados al equipo docente y se descargan como CSV; no se publican automáticamente.

La reasignación individual conserva la hora y solo permite visitas sin borrador ni nota. Se comprueban nuevamente carga, duplicados y conflictos. Al comenzar a calificar se bloquea la regeneración completa para proteger el trabajo guardado. Para cambiar las condiciones de un jurado con visitas, primero reasignar sus visitas pendientes; la configuración se bloquea mientras tenga asignaciones.

## Verificación

`npm run test:jurados` ejecuta pruebas de reparto/capacidad, PostgreSQL y permisos, y navegador móvil con RPC contra PostgreSQL local. Para el navegador se admite `FERIA_TEST_CHROMIUM` apuntando a Chromium instalado. `npm run build` comprueba la compilación y la PWA.

Las pruebas no envían correos reales ni modifican datos de producción. Tras aplicar la migración, el comité debe hacer una entrada de prueba con un correo externo propio y confirmar recepción del enlace en el proveedor de correo configurado.

## Usuarios y contraseñas sin correo

Después de la migración anterior, ejecutar completo `supabase/feria-jurados-cuentas.sql`. También es repetible. Si se vuelve a ejecutar la migración base, ejecutar esta nuevamente al final, porque amplía las mismas funciones de acceso y evaluación.

En «Cuentas y conflictos de jurados», habilitar primero a la persona. Su tarjeta ofrece «Crear usuario y contraseña». El docente define un usuario único (3–40 caracteres: letras minúsculas, números, punto, guion o guion bajo) y una contraseña inicial de al menos diez caracteres; también puede generarla. La cuenta se crea inmediatamente mediante Supabase Auth, sin enviar correos ni modificar cuentas docentes existentes. La identidad de contacto y el registro de jurado se mantienen separados del usuario técnico de acceso.

Los datos de entrega aparecen solo durante esa operación y se pueden copiar para entregarlos individualmente al jurado. La contraseña no se guarda en texto legible en la base de datos, ni en el almacenamiento local, ni se incluye en listados o resultados. Si se pierde, usar «Restablecer contraseña», que conserva usuario, visitas y calificaciones.

El acceso principal de jurados acepta usuario y contraseña. Al primer ingreso —y después de un restablecimiento— se exige elegir una contraseña personal diferente antes de acceder a proyectos o calificar. La restricción también está en el servidor. El correo queda como alternativa; los profesores pueden seguir usando su cuenta habitual.

El endpoint `api/jurado.js` reutiliza las variables de servidor `SUPABASE_URL` (o `VITE_SUPABASE_URL`), `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY` (o `VITE_SUPABASE_ANON_KEY`), igual que el acceso de acudientes. La clave de servicio nunca llega al navegador. Las funciones que vinculan cuentas, levantan el cambio obligatorio o limitan intentos solo son ejecutables por el servidor.

Pruebas adicionales: `node tests/juradosCuentasApi.test.mjs` y `node tests/juradosCuentasSql.test.mjs`. El navegador comprueba creación de credenciales, ingreso manual, cambio inicial, y que se mantiene la alternativa de correo.
