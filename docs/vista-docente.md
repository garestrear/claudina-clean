# Vista docente compacta

La navegación principal tiene cinco secciones: Inicio, Aseo, Comunidad, Actividades y Más. Las herramientas se abren mediante tarjetas con explicación y un botón para volver. Inicio presenta accesos habituales y el horario del docente. Mis grupos está dentro de Más; no ocupa la parte superior de todas las pantallas.

Las pestañas anteriores guardadas y los enlaces de evaluaciones/avisos siguen abriendo la herramienta correspondiente. Los indicadores se agrupan en la sección principal y permanecen en cada tarjeta hasta abrir esa herramienta; abrir un menú no marca como vistas sus novedades. En Aseo se usa un solo indicador de registros para evitar sumar tres veces la misma actividad.

## Activación de permisos

Ejecutar completo `supabase/docentes-administracion.sql`. La primera ejecución conserva como administradores a todos los profesores existentes porque antes compartían esos permisos. Las siguientes ejecuciones no restituyen permisos retirados. Las nuevas cuentas de profesor tienen acceso docente y pueden recibir administración posteriormente.

En Más → Administración → Profesores y permisos, usar Dar administración o Quitar administración. Siempre debe quedar al menos un administrador. Los permisos se comprueban al abrir la app y al recuperar el foco. Si falta el SQL o falla la comprobación, las opciones administrativas permanecen ocultas y Más muestra el aviso correspondiente.

Administración agrupa Estudiantes, Profesores y permisos y Asignación de aseo. Los docentes sin administración conservan sus herramientas de clase, actividades, reportes y selección de grupos propios. El servidor bloquea escrituras de sesiones docentes no administrativas en estudiantes, perfiles, invitaciones y asignaciones, incluidas las funciones que escriben como SECURITY DEFINER. Las API de grupos de otros profesores y restablecimiento de acudiente verifican también la membresía administrativa. Las cuentas internas y de servicio conservan las validaciones de sus flujos de acceso.

## Verificación

- `node tests/docentesAdministracion.test.mjs`: separación de permisos, conservación inicial, nuevas cuentas, migración repetible, último administrador y escritura de datos administrativos.
- `node tests/profesorPanel.test.mjs`: cinco opciones, navegación y novedades agrupadas.
- `node tests/gruposProfesorApi.test.mjs` y `node tests/acudientesApi.test.mjs`: permisos en API.
- `node tests/profesorNavegacionBrowser.test.mjs`: recorrido móvil con horario real y Supabase simulado, tarjetas y pestañas anteriores protegidas. Configurar DOCENTE_TEST_CHROMIUM para indicar Chromium local.
- `npm run build`: compilación de producción.
