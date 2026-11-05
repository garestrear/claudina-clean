# Aulas, espacios y programación

Acceso docente: **Feria STEAM → Aulas y programación**. Activar ejecutando completo `supabase/feria-espacios-programacion.sql` en Supabase > SQL Editor. Requiere los módulos de proyectos de Claudina e instituciones invitadas. No importa horarios de años anteriores ni cambia proyectos o sus aprobaciones.

El módulo crea 9 salones, el restaurante y el patio. Los nombres se pueden ajustar para reflejar los salones reales, agregar espacios y deshabilitar los que no se utilizarán. Al repetir el SQL no se reemplazan nombres, cupos o reservas ya configurados. Los cupos y aforos iniciales quedan por definir, sin inventar capacidades.

- **Puestos simultáneos:** máximo de reservas compartidas concurrentes. Si no se define, no se impone un máximo numérico; la tarjeta lo indica. Una reserva representa un proyecto o una actividad, no una persona.
- **Aforo de visitantes:** dato de planificación para futuras visitas y recorridos del carrusel. No calcula todavía grupos de visitantes ni rotaciones.
- **Recursos:** electricidad, espacio cubierto y observaciones.
- **Programación:** fecha y horario en Colombia, proyecto aprobado o actividad independiente, aula/espacio, mesa o puesto, docente y/o entidad responsable, notas de logística y exclusividad.

Los proyectos aprobados pueden ser de Claudina, emprendimientos familiares o instituciones invitadas. Varias mesas pueden coexistir en el mismo salón. Una actividad exclusiva ocupa todo el espacio durante su horario (por ejemplo, un taller o un turno de refrigerio).

La base de datos valida los cruces, además de la vista previa del navegador:

1. Un proyecto no puede estar en dos lugares simultáneamente.
2. Una reserva exclusiva no puede solaparse con ninguna otra en el mismo espacio.
3. Un puesto/mesa con el mismo nombre no se puede duplicar durante un solapamiento.
4. Se respeta el máximo de puestos simultáneos; se cuenta la concurrencia real y no la suma de todas las reservas que tocan el tramo.
5. El final de una reserva puede coincidir con el inicio de la siguiente.
6. Los cambios docentes usan versiones para impedir sobrescrituras. Un bloqueo de transacción serializa las escrituras y evita carreras entre espacios/proyectos.

Cancelar conserva el registro y libera su horario. Antes de deshabilitar un espacio, hay que cancelar o reubicar sus reservas activas. No se permite bajar los cupos por debajo de la ocupación ya programada. Si un proyecto deja de estar aprobado o se elimina, su reserva se conserva y queda marcada para revisión. Al eliminar un docente, sus reservas se conservan con el nombre del responsable como referencia.

El tablero muestra disponibilidad por el tramo elegido, reservas del día y proyectos aprobados todavía por ubicar. La impresión agrupa por espacio y permite guardar como PDF. Este módulo es de organización docente: todavía no genera ni publica el recorrido automático de grupos por carrusel.

Pruebas: `node tests/feriaEspaciosSql.test.mjs`, `node tests/programacionFeria.test.mjs`, `node tests/feriaEspaciosBrowser.test.mjs`. FERIA_TEST_CHROMIUM permite indicar el ejecutable local del navegador.

## Asignación automática al aprobar

Ejecutar `supabase/feria-asignacion-automatica.sql` después del SQL de espacios.
Se ejecuta en la misma transacción de aprobación, para proyectos internos y de
instituciones invitadas. Usa el bloque Exposiciones de la Agenda general, con
el 6 de noviembre de 2026 de 08:00 a 10:00 como horario predeterminado.
Participan todos los espacios habilitados con `cupos > 1`; las capacidades sin definir,
los espacios de un puesto y las reservas exclusivas se excluyen. Se calcula la
ocupación simultánea máxima de cada salón y se minimiza la fracción
`(ocupación + 1) / cupos`, con desempate estable. El mismo bloqueo transaccional
que usan las reservas manuales evita sobreasignaciones concurrentes.

Desde la reparación de ubicación y credenciales, si no hay lugar disponible
una aprobación nueva se revierte con un mensaje para revisar capacidades y
reservas. Los aprobados anteriores sin ubicación siguen visibles como pendientes. El botón
“Asignar aulas a proyectos pendientes” reintenta todos los aprobados internos
y externos, sin modificar ubicaciones ya existentes. Permite ubicar los
aprobados anteriores a esta actualización tras configurar las capacidades.
La instalación del SQL no mueve ni cancela reservas. Las ubicaciones se pueden
cambiar con “Editar ubicación y horario”, respetando los controles existentes.
La reprobación posterior mantiene la reserva marcada para revisión, igual que
las reservas manuales; el docente puede cancelarla.

## Agenda general del 6 de noviembre de 2026

Activar `supabase/feria-agenda-general.sql` después del SQL de espacios.
Crea una agenda con ocho actividades, visible en Aulas y programación → Agenda
general. Incluye logística (07:00–07:30), apertura (07:30–08:00), exposiciones
(08:00–10:00), refrigerio (10:00–10:15), charlas (10:15–11:35), final de puentes
y teatro de AMVA simultáneos (11:35–12:15), y premiación (12:15–12:30).
Las charlas contemplan cuatro bloques de veinte minutos; no se inventan las
charlas, sus salones ni las rutas de los grupos.

Crea Aula múltiple y Patio nuevo cuando no existen con esos nombres. Mantiene
el Patio original como un espacio distinto. Reserva en exclusiva Aula múltiple
para apertura, teatro y premiación, y Patio nuevo para la final de puentes.
Los bloques generales no bloquean todos los salones ni modifican los puestos
de exposición. Si hay una reserva previa incompatible en esos espacios, el
SQL revierte completo e informa cuál debe reubicarse antes de reintentarlo.
Ejecutarlo nuevamente conserva los cambios existentes.

Los docentes pueden editar las ocho actividades e imprimir la agenda completa.
Al elegir un lugar se usa una reserva exclusiva, con los mismos controles de
cruces y versiones que la programación de espacios. Cambiar la reserva desde
Programación también se refleja en Agenda general. Las reservas canceladas se
muestran como tales. Las ediciones rechazadas conservan el formulario abierto.
No reemplaza las reservas manuales de stands, ni publica una
rotación automática de grupos o una agenda para las vistas de familias.

## Líderes y grupos del carrusel

Activar `supabase/feria-carrusel.sql` después del módulo de espacios y del módulo
de integrantes de proyectos. La pestaña “Líderes y carrusel” consulta por defecto
el bloque de exposiciones 08:00–10:00 del 6 de noviembre. No organiza las charlas
cuyos ponentes y lugares aún no se han definido.

Se cuentan los proyectos aprobados efectivamente programados en cada espacio,
no su capacidad teórica. Solo los espacios con más de un proyecto simultáneo
requieren líder fijo. Cada espacio con al menos una exposición genera un grupo
visitante, aunque no requiera líder. Se distribuyen los estudiantes activos sin
proyecto estudiantil aprobado por grados completos. TS y preescolar (grado 0)
son un bloque indivisible, al igual que primero. Los demás grados solo se dividen
si superan el menor aforo conocido del circuito. Se asignan los bloques a los
grupos menos numerosos; pueden quedar grupos vacíos y tamaños diferentes.
Volver a ejecutar `supabase/feria-carrusel.sql` y regenerar los planes existentes
para aplicar estas reglas. Se excluyen tanto el titular como todos los compañeros del equipo; un
emprendimiento familiar no convierte al estudiante vinculado en expositor.

Los docentes se asignan manualmente o con “Asignar docentes disponibles”,
completando primero los líderes y luego los acompañantes con los docentes
registrados restantes. No se permite repetir un docente entre ambos roles ni
entre dos aulas o grupos. Si no alcanzan, se muestra la cantidad necesaria y
se conserva un borrador explícitamente incompleto. No se inventan docentes de
apoyo. Los grupos vacíos no requieren acompañante. Los aforos conocidos menores
que los grupos generan una advertencia.

La ruta empieza con un grupo por espacio y avanza en circuito. La duración se
puede ajustar entre 5 y 60 minutos (propuesta inicial: 20). La última rotación
se acorta si el bloque no es divisible exactamente. Se informa cuando el tiempo
no permite visitar todos los espacios o cuando el circuito vuelve a comenzar.
Cada aula recibe como máximo un grupo en cada rotación.

El plan se guarda por bloque con control de versión y una firma de las aulas,
visitantes y docentes utilizados. Cambios posteriores requieren consultar y
regenerar antes de guardar. No se permiten dos planes que se solapen. Si las
exposiciones cambian dentro del bloque consultado, hay que dividirlo en tramos
con exposiciones constantes. Los planes se conservan al recargar; los borradores
no guardados deben guardarse antes de salir de la sección.


## Reparación de ubicación y credenciales

Ejecutar `supabase/feria-ubicacion-credenciales.sql` después de espacios, placas
y participantes. Incluye la actualización de asignación automática y los campos
nuevos de ubicación de las credenciales; no requiere ejecutar por separado la
versión actualizada de `feria-asignacion-automatica.sql`.

La búsqueda anterior restringía el tipo a salón y exigía disponibilidad de
07:00 a 13:00. Ahora admite cualquier espacio configurado con más de un puesto
y usa el horario de Exposiciones de la Agenda general (08:00–10:00 si no está
instalada). Una apertura que termina a las 08:00 no bloquea la exposición que
empieza a esa hora. No se inventan capacidades para espacios sin definir.

Las aprobaciones nuevas requieren asignación, con reversión atómica cuando no
hay cupo. El script reintenta ubicar los aprobados anteriores sin mover sus
reservas existentes. Si no hay capacidad, estos últimos continúan pendientes.
La revisión muestra el aula confirmada o explica que falta activar el SQL o
resolver la disponibilidad. El RPC idempotente de confirmación solo es accesible
a docentes.

Placas y escarapelas muestran las reservas activas actuales, tanto en pantalla
como en PDF. La ubicación se añade a los contextos ya autorizados, sin permitir
consultar proyectos ajenos ni abrir un listado público de estudiantes. El acceso
directo al helper de ubicaciones está revocado. Cambiar de aula, renombrar un
espacio o cancelar una reserva se refleja al actualizar las credenciales; los
PDF ya descargados deben generarse de nuevo. Una credencial sin reserva indica
“Aula por asignar”. Se conservan los códigos y las dimensiones de impresión.


## Elegir el aula al revisar y aprobar

Ejecutar completo `supabase/feria-revision-aula.sql` después de
`feria-espacios-programacion.sql` y `feria-familias-estados.sql`.
Incluye la versión actualizada de la asignación automática. Es repetible;
instalarlo no cambia proyectos ni reservas existentes. Para las placas y
escarapelas se mantiene el requisito de `feria-ubicacion-credenciales.sql`.

En **Revisar proyecto**, al elegir **Aprobar proyecto**, aparece **Aula o lugar
de exposición**. Por defecto se asigna automáticamente; si ya tiene ubicación,
se conserva. El docente puede escoger otro espacio habilitado con más de un
puesto simultáneo, consultando su disponibilidad en el tramo de exposiciones.
También aparece al revisar un proyecto que ya está aprobado, sin necesidad de
cambiar su estado. Se aplica a proyectos de Claudina, familiares e invitados.

La aprobación y el aula elegida se guardan en una misma transacción. Un conflicto
de cupos, exclusividad, mesa o versión revierte ambas operaciones. La edición de
textos conserva su guardado independiente y avisa si falta guardar la decisión.
Las reservas existentes conservan horario, puesto y responsable al cambiar de
aula. Si otro docente cambió la reserva, el formulario solicita actualizar las
aulas antes de guardar. Los reintentos de una misma solicitud no duplican
reservas ni deshacen traslados posteriores.

Si no hay espacios con capacidad configurada, definir **Puestos simultáneos**
en **Aulas y espacios**. La vista de revisión no inventa capacidades. La opción
**Actualizar aulas** recarga disponibilidad y descarta la selección manual.

Verificación: `npm run test:aula-revision` (SQL y navegador móvil).

## Numeración automática de mesas

Ejecutar `supabase/feria-puestos-automaticos.sql` después de los módulos de espacios
y asignación automática. Completa al instalar los proyectos activos ya ubicados
que no tengan puesto; conserva las etiquetas existentes como asignaciones manuales.
Cada nuevo proyecto recibe la primera «Mesa N» libre en su aula y horario, tanto
para Claudina como para invitados. Los horarios sin cruce pueden reutilizar mesa.
Al mover una asignación automática se busca mesa libre en el destino; los puestos
manuales se conservan y se validan los conflictos. Dejar vacío el campo permite
volver a la numeración automática. No modifica el aula ni crea nuevas reservas.

La migración es repetible y aumenta la versión de las reservas que completa:
recargar Programación después de ejecutarla. `npm run test:puestos` verifica
la migración, sus reintentos, numeración, traslados y conservación de manuales.

## Dos franjas y lista de expositores

Activar `supabase/feria-dos-franjas.sql` después de agenda, carrusel y mesas
automáticas. La primera franja es 08:00–10:00; la segunda, 10:15–11:40.
Los proyectos nuevos de Claudina se asignan a la primera franja y los invitados
a la segunda; las reservas existentes se conservan. Para mover un proyecto,
abrir Programación → Editar ubicación y horario, elegir la segunda franja,
revisar el aula y guardar. La mesa automática se recalcula si hace falta.

En Líderes y carrusel se consulta y guarda un plan independiente para cada franja.
Solo se excluyen de visitantes los estudiantes con proyecto estudiantil aprobado
y reserva activa que se cruce con el horario consultado, incluidos todos sus
integrantes. Exponer en la primera franja no impide visitar la segunda.
Se mantienen las reglas de grados completos y los controles de versiones.

Estudiantes expositores muestra nombre, grado real del estudiante, proyecto,
salón, mesa y horario, con filtros de fecha, franja y grado y una lista imprimible
que puede guardarse en PDF. Solo incluye proyectos estudiantiles de Claudina
aprobados con reserva activa; no convierte emprendimientos familiares en
expositores estudiantiles. Actualizar la lista después de editar las reservas.

La migración actualiza el bloque general de charlas a 10:15–11:40 cuando no
tiene un espacio reservado. No desplaza las reservas de proyectos ni las
actividades posteriores: revisar teatro y puentes si siguen comenzando a 11:35.
Validación: `npm run test:franjas`.

## Docente responsable predeterminado

Ejecutar `supabase/feria-responsable-asesor.sql` después de espacios y del módulo
de asesores de proyectos. Las nuevas reservas de proyectos de Claudina toman
como docente responsable su asesor, tanto al aprobar como al programar a mano.
La migración completa las reservas activas sin docente y conserva las que ya
tienen uno. El selector permite cambiar el docente. Se conserva el texto libre
del responsable; si era el nombre del docente anterior, se actualiza al nuevo.
Sin asesor válido no se inventa una asignación. Invitados y actividades conservan
su comportamiento. Repetir la migración no modifica reservas ya completadas.
Validación: `npm run test:responsable`.
