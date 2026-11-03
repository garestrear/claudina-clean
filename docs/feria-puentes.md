# Concurso de puentes

El concurso tiene inscripciones propias, separadas de los proyectos aprobados. Estudiantes y docentes pueden registrar puentes; los docentes registran tres intentos con cargas elegidas por los equipos y proyectan la prueba y las clasificaciones.

## Activación e inscripción independiente

1. En el SQL Editor de Supabase de Claudina App, ejecutar completo `supabase/feria-puentes-inscripcion.sql`. Es acumulativo: crea el módulo si todavía no se activó y actualiza la versión anterior conservando inscripciones, rondas y resultados. Ya no depende de `feria-evaluacion-jurados.sql`. No volver a ejecutar el antiguo `feria-puentes.sql` después de esta actualización, pues contiene las funciones anteriores.
2. Ejecutar después `supabase/feria-puentes-tres-intentos.sql` y actualizar Claudina App. No volver a ejecutar los SQL anteriores sin aplicar de nuevo este último: restaurarían el flujo de cargas automáticas. La app bloquea las acciones hasta detectar esta modalidad.  El estudiante abre Feria STEAM → Concurso de puentes. Cualquier docente abre Feria STEAM → Herramientas → Concurso de puentes y puede inscribir estudiantes de cualquier grupo.
3. Pulsar «Inscribir puente». Solo son obligatorios el nombre, los integrantes y la categoría: juvenil (palitos de paleta, 60 × 10 cm) o infantil (palillos de dientes, 20 × 5 cm). El peso propio en gramos y la foto son opcionales. No se exige crear ni aprobar un proyecto STEAM, asesor, descripción, materiales o medidas para inscribir.
4. El estudiante que registra puede elegir únicamente a los autores reales; no se añade automáticamente. Si participa, usa «Agregarme al equipo». Puede agregar compañeros del mismo grupo (7/8 unificados) o buscar estudiantes de otro grado. El docente selecciona todos los integrantes de las listas de estudiantes activos. Los nombres los obtiene el servidor; no se permiten integrantes escritos libremente ni estudiantes inactivos.
5. El puente aparece en «Mis inscripciones de puentes» de quien lo registró y de todos los integrantes seleccionados y en la lista de todos los docentes. Quien lo registró, cualquier integrante o un docente pueden actualizarlo hasta que tenga su primera ronda. No existe un paso de aprobación de proyectos.
6. «Tomar foto» abre la cámara y «Elegir de la galería» permite cargar una imagen. Se admiten JPG, PNG o WebP de hasta 8 MB. Las fotos son privadas para docentes y equipo; se muestran también en la mesa y proyección con sesión docente. Los campos y la foto seleccionada se conservan como borrador en el dispositivo para retomar después de abrir la cámara. «Continuar inscripción» recupera el borrador.
7. Antes del concurso, configurar ambas categorías tras comprobar el montaje: límite seguro de carga y separación entre apoyos. En «Pesar puente y registrar mediciones en la mesa», completar el peso antes de iniciar para resolver empates. Largo, ancho y predicción de carga son datos opcionales de la mesa.

Los registros antiguos conservan su vínculo histórico de origen y sus resultados, pero ya no se comprueba la aprobación del proyecto para probarlos. Si todavía no tienen rondas, un docente puede confirmar su equipo desde las listas. Las fichas con rondas se mantienen sin cambios.

## Operación

Seleccionar el puente en turno. El profesor que maneja el máster escribe la carga que el equipo elige para ese intento, en kg con hasta tres decimales y dentro del límite del montaje. La carga puede repetirse o cambiar en el siguiente turno. El adulto coloca el peso total indicado, incluida la pieza de distribución y recipiente. El operador pulsa «Registrar carga e iniciar intento». Después del tiempo completo, confirma que resistió o registra la falla. El cronómetro no valida automáticamente.

Cada puente dispone de tres intentos. «Falló · puede continuar» aporta cero y permite seguir si queda intacto. «Se rompió · finalizar» termina la participación. Tras resolver un intento se puede seleccionar otro puente y volver al anterior en su siguiente turno. El tercer intento finaliza automáticamente el puente; llegar al límite no consume los intentos restantes. «Cancelar ronda» exige motivo y permite repetir sin consumir un intento. «Finalizar por seguridad u otro motivo» permite cerrar sin rotura cuando no hay ronda pendiente.

La clasificación se calcula por la **suma de las cargas válidas** y, en empate, menor masa propia (criterio conservado). Si soporta 5 y 8 kg pero falla con 10 kg, suma 13 kg. Igual total y masa comparten puesto. Los no probados no reciben puesto. Los resultados son provisionales hasta verificar todas las pruebas. La migración conserva los resultados históricos; no elimina rondas anteriores aunque un puente hubiera realizado más de tres bajo el sistema antiguo. Las nuevas pruebas quedan limitadas a tres.

## Pantalla y sincronización

«Abrir pantalla para proyectar» abre `?vista=puentes-pantalla` en otra pestaña. Requiere una sesión docente; si se usa otro computador, iniciar sesión allí. El operador y el proyector consultan el estado guardado cada segundo. La cuenta de cinco segundos se calcula usando la hora del servidor y el instante final persistido, por lo que sobrevive a recargas. La proyección sigue la categoría del nuevo puente y permite consultar el tablero de la otra categoría.

La pantalla muestra equipo, carga actual, los tres intentos en columnas, suma acumulada, cuenta regresiva y líder provisional. La vista de proyección no tiene botones de escritura. La autorización de las operaciones se comprueba además en el servidor. Solo docentes pueden consultar el módulo; no se publica un enlace anónimo.

## Recuperación y trazabilidad

Una sola cuenta docente controla la mesa. Otra puede tomar el control con motivo, una vez terminada la cuenta si hay ronda pendiente. Cada escritura comprueba la versión y lleva un identificador de solicitud para evitar duplicados. Las rondas se almacenan en Supabase; la pantalla muestra una advertencia cuando faltan actualizaciones y bloquea las acciones si el estado está desactualizado.

Si hay error al guardar, pulsar Actualizar y revisar la ronda antes de continuar. No se promete operación sin internet; mantener las planillas impresas como respaldo. Las correcciones anulan rondas de pruebas finalizadas con motivo e historial, recalculan la suma sin liberar el intento consumido y no reabren la participación. Se pueden descargar las fichas y rondas en CSV.

## Validación

`npm run test:puentes` ejecuta las pruebas del marcador, inscripción independiente y modalidad de tres intentos (SQL e interfaz). Se verifica carga libre, turnos alternados, suma 13, fallo recuperable, rotura, límite de tres, cancelación y corrección, recuperación de guardado y bloqueo sin migración. Verifican clasificación, categorías, reloj, permisos, cinco segundos del lado servidor, idempotencia, versiones, relevo, cancelación, fallo, correcciones, límite y compatibilidad con la versión anterior. La actualización se prueba en una base nueva y sobre registros con resultados previos. También se comprueban inscripciones de estudiantes y docentes, equipos de distintos grados, visibilidad por integrante, campos opcionales, fotos privadas, bloqueo de edición tras iniciar y reintentos sin duplicar registros ni subir dos veces la misma foto. `npm run build` comprueba la app y la PWA. La pantalla fue comprobada con datos de demostración aislados; las pruebas PostgreSQL se realizan en una base local de prueba. La migración debe activarse en Supabase antes de comprobar el flujo con los datos de producción.


## Eliminar inscripciones incorrectas

Activar `supabase/feria-puentes-registro-y-eliminacion.sql` después de la inscripción independiente.
No reemplaza la migración de tres intentos y no elimina datos al instalarse.
Cualquier docente ve **Eliminar puente** en las tarjetas de **Puentes inscritos**.
Los estudiantes no tienen este permiso. La confirmación identifica el puente y,
si tiene rondas, advierte que también se retirarán sus intentos y resultados del
tablero. Un intento pendiente debe resolverse o cancelarse antes de eliminar.

La eliminación libera la mesa si el puente estaba seleccionado y actualiza el
marcador mediante la sincronización existente. El servidor conserva una copia de
la inscripción y las rondas, la cuenta docente y la fecha en la auditoría privada.
No hay opción de deshacer en la interfaz. Las fotos no se borran del almacenamiento.
La operación comprueba la versión de la inscripción y requiere confirmar resultados
si aparecieron intentos después de consultar la lista. Los reintentos de una misma
solicitud no duplican la eliminación. Se usan los mismos bloqueos que la mesa y las
inscripciones para serializar escrituras.

Verificación: `npm run test:puentes-eliminar`.


## Registrar puentes para otros equipos

La misma migración `supabase/feria-puentes-registro-y-eliminacion.sql` habilita
que un estudiante activo inscriba un puente ajeno, sin convertirse en integrante.
El formulario empieza sin integrantes; permite escoger compañeros de su grupo,
estudiantes de cualquier grado y agregarse explícitamente si también participa.
Es obligatorio seleccionar al menos un estudiante activo. La categoría se elige
para el puente y no se deduce del grado de quien lo registra.

La inscripción queda visible para quien la creó, el equipo seleccionado y los
docentes. Esos mismos usuarios pueden editarla antes de que tenga rondas; las
fotos mantienen acceso privado para ellos. Otros estudiantes no pueden consultar
ni modificar inscripciones ajenas. La persona que inscribe no puede cambiar el
creador a través del formulario. La migración no cambia los integrantes de los
registros previos; si se incluyó por error a quien registró, se puede quitar al
editar mientras no haya comenzado la prueba. Eliminar sigue siendo solo docente.


## Descalificado por no cumplir los requisitos

Ejecutar `supabase/feria-puentes-descalificacion.sql` **después** de las migraciones
 de inscripción, tres intentos y registro y eliminación. Repetible; instalarlo
 no elimina ni descalifica registros. No volver a ejecutar migraciones anteriores
 sin aplicar esta última de nuevo.

En **Puentes inscritos**, cualquier docente puede pulsar **Descalificado por no
cumplir los requisitos…**, indicar el requisito incumplido y confirmar. Primero
hay que resolver o cancelar cualquier intento pendiente de ese puente.

La inscripción, equipo, foto e intentos se conservan. El puente muestra su estado
 y motivo a los docentes y al equipo, en la proyección y en el CSV. No recibe puesto
 ni puede ser líder, seleccionarse para otra prueba ni editarse. Se mantiene
 disponible la eliminación para registros creados por error. La auditoría privada
 conserva la cuenta docente, fecha, motivo y ficha anterior. No hay rehabilitación
 automática ni opción de deshacer en esta versión.

Verificación: `node tests/puentesDescalificacion.test.mjs`.


## Orden automático de turnos

Ejecutar `supabase/feria-puentes-orden-turnos.sql` después de las migraciones
anteriores (incluida descalificación). Solo amplía lecturas; no cambia resultados.

La lista de inscripciones, el tablero, el selector de turnos y el selector de mediciones se
ordenan por intentos consumidos de menor a mayor; a igual número de intentos,
por grado ascendente; a igual grado, por nombre del puente en español. Los equipos
con varios grados usan el menor. Grado 0 (TS y JR) va antes de primero; un equipo
sin grado registrado va al final de los que llevan igual número de intentos.

La mesa actualiza el orden en cada respuesta de guardado y consulta del marcador
(cada segundo). No cambia automáticamente el puente seleccionado. Cancelar un
intento de montaje no lo consume; un fallo o una corrección mantiene el intento
consumido. La columna Puesto y el líder conservan sus criterios de puntuación, aunque las filas del tablero se presentan en orden de turnos.
