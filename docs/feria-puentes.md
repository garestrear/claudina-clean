# Concurso de puentes

El concurso tiene inscripciones propias, separadas de los proyectos aprobados. Estudiantes y docentes pueden registrar puentes; los docentes controlan las cargas progresivas y proyectan la prueba y las clasificaciones.

## Activación e inscripción independiente

1. En el SQL Editor de Supabase de Claudina App, ejecutar completo `supabase/feria-puentes-inscripcion.sql`. Es acumulativo: crea el módulo si todavía no se activó y actualiza la versión anterior conservando inscripciones, rondas y resultados. Ya no depende de `feria-evaluacion-jurados.sql`. No volver a ejecutar el antiguo `feria-puentes.sql` después de esta actualización, pues contiene las funciones anteriores.
2. Actualizar Claudina App. El estudiante abre Feria STEAM → Concurso de puentes. Cualquier docente abre Feria STEAM → Herramientas → Concurso de puentes y puede inscribir estudiantes de cualquier grupo.
3. Pulsar «Inscribir puente». Solo son obligatorios el nombre, los integrantes y la categoría: juvenil (palitos de paleta, 60 × 10 cm) o infantil (palillos de dientes, 20 × 5 cm). El peso propio en gramos y la foto son opcionales. No se exige crear ni aprobar un proyecto STEAM, asesor, descripción, materiales o medidas para inscribir.
4. El estudiante que registra queda incluido. Puede agregar compañeros del mismo grupo (7/8 unificados) o buscar estudiantes de otro grado. El docente selecciona todos los integrantes de las listas de estudiantes activos. Los nombres los obtiene el servidor; no se permiten integrantes escritos libremente ni estudiantes inactivos.
5. El puente aparece en «Mis puentes» de todos los integrantes seleccionados y en la lista de todos los docentes. Cualquier integrante o docente puede actualizarlo hasta que tenga su primera ronda. No existe un paso de aprobación de proyectos.
6. «Tomar foto» abre la cámara y «Elegir de la galería» permite cargar una imagen. Se admiten JPG, PNG o WebP de hasta 8 MB. Las fotos son privadas para docentes y equipo; se muestran también en la mesa y proyección con sesión docente. Los campos y la foto seleccionada se conservan como borrador en el dispositivo para retomar después de abrir la cámara. «Continuar inscripción» recupera el borrador.
7. Antes del concurso, configurar ambas categorías tras comprobar el montaje: carga inicial total, incremento, límite seguro y separación entre apoyos. En «Pesar puente y registrar mediciones en la mesa», completar el peso antes de iniciar para resolver empates. Largo, ancho y predicción de carga son datos opcionales de la mesa.

Los registros antiguos conservan su vínculo histórico de origen y sus resultados, pero ya no se comprueba la aprobación del proyecto para probarlos. Si todavía no tienen rondas, un docente puede confirmar su equipo desde las listas. Las fichas con rondas se mantienen sin cambios.

## Operación

Seleccionar el puente en turno. El adulto coloca el peso total indicado, incluida la pieza de distribución y recipiente. El operador pulsa «Peso colocado · iniciar 5 s». Después del tiempo completo, confirma que resistió o registra la falla. El cronómetro no valida automáticamente. La próxima carga sigue los incrementos de la categoría y se limita al máximo del montaje.

Una falla finaliza el puente y conserva su mejor carga válida. Alcanzar y validar el límite también finaliza la prueba. «Cancelar ronda» requiere motivo, no cuenta para la marca y permite repetir esa carga. «Finalizar por seguridad u otro motivo» permite cerrar sin rotura cuando no hay ronda pendiente. Las condiciones de la categoría y la ficha quedan bloqueadas desde su primera ronda.

La clasificación se calcula por mayor carga válida y, en empate, menor masa propia. Igual carga y masa comparten puesto. Los no probados no reciben puesto. Los resultados siguen siendo provisionales hasta verificar todas las pruebas.

## Pantalla y sincronización

«Abrir pantalla para proyectar» abre `?vista=puentes-pantalla` en otra pestaña. Requiere una sesión docente; si se usa otro computador, iniciar sesión allí. El operador y el proyector consultan el estado guardado cada segundo. La cuenta de cinco segundos se calcula usando la hora del servidor y el instante final persistido, por lo que sobrevive a recargas. La proyección sigue la categoría del nuevo puente y permite consultar el tablero de la otra categoría.

La pantalla muestra equipo, carga actual, mejor marca, cuenta regresiva y líder provisional. La vista de proyección no tiene botones de escritura. La autorización de las operaciones se comprueba además en el servidor. Solo docentes pueden consultar el módulo; no se publica un enlace anónimo.

## Recuperación y trazabilidad

Una sola cuenta docente controla la mesa. Otra puede tomar el control con motivo, una vez terminada la cuenta si hay ronda pendiente. Cada escritura comprueba la versión y lleva un identificador de solicitud para evitar duplicados. Las rondas se almacenan en Supabase; la pantalla muestra una advertencia cuando faltan actualizaciones y bloquea las acciones si el estado está desactualizado.

Si hay error al guardar, pulsar Actualizar y revisar la ronda antes de continuar. No se promete operación sin internet; mantener las planillas impresas como respaldo. Las correcciones anulan rondas de pruebas finalizadas con motivo e historial, recalculan la clasificación y no reabren puentes rotos. Se pueden descargar las fichas y rondas en CSV.

## Validación

`npm run test:puentes` ejecuta las pruebas del marcador anterior y de inscripción independiente. Verifican clasificación, categorías, reloj, permisos, cinco segundos del lado servidor, idempotencia, versiones, relevo, cancelación, fallo, correcciones, límite y compatibilidad con la versión anterior. La actualización se prueba en una base nueva y sobre registros con resultados previos. También se comprueban inscripciones de estudiantes y docentes, equipos de distintos grados, visibilidad por integrante, campos opcionales, fotos privadas, bloqueo de edición tras iniciar y reintentos sin duplicar registros ni subir dos veces la misma foto. `npm run build` comprueba la app y la PWA. La pantalla fue comprobada con datos de demostración aislados; las pruebas PostgreSQL se realizan en una base local de prueba. La migración debe activarse en Supabase antes de comprobar el flujo con los datos de producción.
