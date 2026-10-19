# Feria STEAM · Instituciones invitadas

La portada compartible `https://claudina-clean.vercel.app/?vista=invitados` se organiza en Feria STEAM, Nuestro colegio y Comunidad. La feria abre primero; Nuestro colegio conserva la identidad, ubicación, lema y enlace institucional; Comunidad conserva contador, avisos y experiencias de convivencia con detalles desplegables.

La vista de invitados muestra la sexta edición renovada, su nombre anterior, fecha (6 de noviembre de 2026), significado de STEAM y actividades: teatro ambiental, talleristas, puentes de palitos, maquetas, proyectos artísticos, experimentos y emprendimientos. Incluye el enlace compartible `https://claudina-clean.vercel.app/?feria=invitados`.

## Activación

Ejecutar completo `supabase/feria-invitados.sql` en SQL Editor. Requiere las tablas institucionales perfiles, estudiantes y acudientes ya instaladas. El script es repetible y no borra ni transforma los proyectos de Claudina. Hasta habilitarlo, los botones de acceso externos permanecen desactivados y la información pública sigue visible.

El acceso permite Google o enlace de correo de Supabase. Los registros y el proveedor deben estar habilitados en Auth. La configuración pública de producción fue consultada: registro público, Google y correo están habilitados. Para conservar el destino, añadir `https://claudina-clean.vercel.app/?feria=invitados` a Authentication → URL Configuration → Redirect URLs. La Site URL debe ser la dirección de producción. Si el proveedor regresa a la raíz, una cuenta verificada sin perfil institucional abre igualmente el módulo externo. La entrega real de mensajes depende del correo configurado en Supabase; no se enviaron correos reales durante las pruebas.

## Registro y revisión

Un docente externo verifica su correo y registra institución, municipio, responsable, teléfono opcional, áreas STEAM, integrantes con sus grados y campos del proyecto (incluida bibliografía). No se solicitan documentos, teléfonos ni correos de estudiantes. La autorización de institución y familias es obligatoria. El contacto se toma del correo de Auth en el servidor; no se acepta suplantarlo desde el formulario.

Cada docente puede registrar hasta veinte proyectos, guardar borradores privados y volver con el mismo correo. Solo el responsable consulta o edita su proyecto. Guardar borrador requiere institución, municipio, responsable, título, áreas y autorización; enviar requiere además integrantes, propuesta y procedimiento. La interfaz conserva texto local por cuenta y versión y advierte que inscribir no garantiza participación.

En Actividades → Feria STEAM → Instituciones invitadas, los profesores de Claudina pueden buscar por institución, proyecto, municipio o integrantes y filtrar por área/estado. Los borradores no son visibles para ellos. Pueden pedir ajustes o aprobar, conservando autor, fecha y versión de cada revisión. Al editar un aprobado se requiere una nueva revisión. Los identificadores de solicitud evitan duplicados de guardado/revisión y la versión evita sobrescribir cambios concurrentes. Los proyectos invitados se incluyen en las novedades de la feria.

## Separación de accesos

No se crea un perfil institucional para las cuentas externas. Las tablas externas son privadas y sus RPC comprueban usuario, correo confirmado, propiedad y estado. La migración añade políticas restrictivas a tablas públicas y de Storage con RLS para impedir que una cuenta externa aproveche las lecturas antiguas para cualquier sesión autenticada. Las cuentas de Claudina conservan sus políticas previas; la barrera nueva no concede permisos adicionales. Las publicaciones públicas del portal siguen disponibles por su RPC público. Para futuras tablas con lecturas generales autenticadas, aplicar la misma condición `es_miembro_claudina()`.

## Pruebas

`tests/feriaInvitadosSql.test.mjs` verifica verificación del correo, separación entre colegios y datos internos, permisos de docente/estudiante/acudiente, borradores, validación, envío, ajustes, aprobación, edición posterior, conflictos, idempotencia e historial y migración repetible. `tests/feriaInvitadosBrowser.test.mjs` usa la App completa, autenticación simulada y PostgreSQL real en memoria: portal público → Google/correo simulados → cuenta externa sin perfil → borrador → envío → revisión → corrección → aprobación. No envía mensajes reales ni modifica producción. Se conservan las pruebas internas de feria y familias y la compilación de producción.
