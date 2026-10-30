# Concurso de puentes

El docente abre Feria STEAM → Herramientas → Concurso de puentes. El panel permite vincular proyectos aprobados, registrar masa y medidas reales, realizar cargas progresivas y proyectar la prueba y las clasificaciones.

## Activación

1. Ejecutar previamente las migraciones existentes de la feria, incluida `supabase/feria-evaluacion-jurados.sql` y sus dependencias.
2. En el SQL Editor del proyecto Supabase de Claudina App, ejecutar completo `supabase/feria-puentes.sql`. Es repetible y conserva las inscripciones y rondas. No requiere claves adicionales ni nuevas variables de entorno.
3. Actualizar Claudina App e ingresar como docente. Abrir el concurso y configurar ambas categorías después de comprobar físicamente el montaje. Definir carga inicial total, incremento, límite seguro y separación entre apoyos. Los valores no se presuponen.
4. Elegir los proyectos aprobados que competirán y registrar su categoría, masa propia en gramos, largo y ancho en centímetros y predicción opcional en kg. Infantil corresponde a palillos de dientes de 20 × 5 cm; juvenil a palitos de paleta de 60 × 10 cm. Las diferencias de medidas se resuelven con la organización antes de probar; no hay descalificación automática.

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

`node tests/puentes.test.mjs`, `node tests/puentesSql.test.mjs` y `node tests/puentesIntegracion.test.mjs` verifican clasificación, categorías, reloj, permisos, cinco segundos del lado servidor, idempotencia, versiones, relevo, cancelación, fallo, correcciones, límite y vinculación con la fuente real de proyectos internos y externos. `npm run build` comprueba la app y la PWA. La pantalla fue comprobada con datos de demostración aislados; las pruebas PostgreSQL se realizan en una base local de prueba. La migración debe activarse en Supabase antes de comprobar el flujo con los datos de producción.
