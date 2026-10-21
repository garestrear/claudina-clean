# Inglés con música

La primera actividad usa el audio y el ejercicio de Lemon Tree proporcionados por el docente. Está dirigida a estudiantes activos de 6°, 7° y 8°. Contiene siete espacios, un banco opcional de seis palabras y permite practicar varias veces.

## Activación

1. Ejecutar completo `supabase/ingles-musica.sql` en el SQL Editor del mismo proyecto Supabase de Claudina App.
2. Actualizar Claudina App y entrar a «Inglés con música».

El script puede ejecutarse de nuevo sin borrar intentos ni restablecer la configuración. El MP3 se publica junto a la app y no requiere volver a subirlo. El audio necesita conexión y no forma parte de la precarga de la PWA.

## Uso

### Imagine · John Lennon

Ejecutar completo `supabase/ingles-imagine-imagen.sql` después de activar el módulo con `supabase/ingles-musica.sql`. No hace falta ejecutar el antiguo `ingles-imagine.sql` ni configurar Storage: el audio proporcionado por el docente se incluye en `public/audio/imagine.mp3` y estará disponible al desplegar esta versión de la app.

La actividad transcribe la imagen del docente: cada par subrayado se sustituye por un espacio cuya respuesta es la opción correcta de la canción. Son 26 espacios y un banco inicial de 18 palabras distintas; algunas se utilizan varias veces. Se conserva la redacción de la imagen. La revisión utiliza las funciones existentes del módulo.

La activación es repetible y no borra intentos ni modifica actividades anteriores. Si ya existía la versión de nivel fácil, ambas se conservan.

Los estudiantes pueden pausar, retroceder diez segundos y escuchar a 0.75×. La revisión se realiza en Supabase: ignora mayúsculas y separadores, conserva el último intento y el mejor resultado, y evita duplicar el envío al reintentar una misma solicitud. Las respuestas de estudiantes permanecen solo durante la actividad abierta; salir de la app o cambiar de sección las borra. La puntuación de práctica se expresa sobre 10.

Los docentes pueden completar el ejercicio por diversión y revisar sus aciertos (sin guardar su puntaje ni mezclarlo con estudiantes). Para habilitar la corrección docente, ejecutar completo `supabase/ingles-practica-profesor.sql` en Supabase SQL Editor; es repetible y no modifica intentos existentes. La lista de estudiantes que ya practicaron aparece al abrir la actividad, con nombre, grado, intentos y puntajes último y mejor sobre 10. Los docentes también pueden ocultar el banco de palabras o cerrar la actividad y consultar resultados filtrados por sus grupos. El módulo no modifica las notas de aseo. Las tablas no admiten acceso directo de usuarios; las funciones comprueban la cuenta, su rol, la ficha activa y el grado.

## Verificación

- `node tests/inglesSql.test.mjs`: permisos, grados, corrección, intentos, idempotencia y cierre.
- `node tests/inglesUi.test.mjs`: formulario, errores, borradores y filtros docentes.
- `node tests/inglesBrowser.test.mjs`: navegador móvil, MP3, RPC, PostgreSQL, recarga y resultados. Puede usarse `INGLES_TEST_CHROMIUM` para seleccionar un ejecutable local de Chromium.
- `npm run build`: compilación de producción.

## Calificar, nuevo intento y clasificación estudiantil

«Calificar» revisa el formulario actual. «Realizar otro intento» vacía los campos y la corrección, borra las respuestas escritas y reinicia el audio sin crear un intento ni borrar el mejor resultado anterior.

Ejecutar completo `supabase/ingles-clasificacion.sql` para habilitar la clasificación a estudiantes con ficha activa y acceso a la actividad publicada. Muestra nombres, grados, intentos y puntajes, ordenada por el mejor resultado; los empates comparten puesto. No expone respuestas, correcciones, correos ni identificadores de cuentas. No concede acceso anónimo ni modifica las tablas. La clasificación se actualiza tras calificar y también con «Actualizar resultados».

Verificación adicional: `node tests/inglesClasificacion.test.mjs` comprueba permisos, empates y campos expuestos. `node tests/inglesImagine.test.mjs` verifica calificación, clasificación, reinicio vacío tras recarga y conservación del puntaje en navegador.

## Puntaje, tiempo y top 10

Ejecutar completo `supabase/ingles-ranking-tiempo.sql` para actualizar las funciones y añadir los registros de tiempo, sin borrar progreso. Reemplaza la versión anterior de la clasificación; no es necesario volver a ejecutar `ingles-clasificacion.sql` si se ejecuta esta migración.

Cada estudiante recibe hasta 100 puntos: `100 × máximo de aciertos / total de espacios`. El orden compara el valor exacto antes de redondear: mayor puntuación, menos intentos calificados, menor tiempo del intento con ese máximo, y fecha/hora más temprana de ese intento. Un identificador estable resuelve coincidencias exactas. Si vuelve a igualar su máximo en menos tiempo, se conserva ese nuevo tiempo y su fecha. Los intentos de menor puntaje no reemplazan estos datos.

El servidor registra el inicio al primer uso del audio o al escribir y el final al calificar. Incluye pausas y el tiempo fuera de la pestaña; recargar no reinicia el reloj. «Realizar otro intento» prepara una sesión nueva, que empezará con la siguiente interacción. Reenviar una misma solicitud no duplica intentos ni cambia su duración.

Los resultados históricos y envíos de versiones anteriores conservan su puntaje; sin medición real muestran «Sin registro» y quedan después de tiempos conocidos cuando empatan en puntos e intentos. No se deduce la fecha del máximo a partir de la fecha del último envío.

Los estudiantes reciben solo los primeros diez desde Supabase, incluso si consultan la función directamente. La función interna que genera la lista completa no está disponible a usuarios. El docente recibe todos los resultados y mantiene sus filtros por grupos. Las tablas están al final de cada actividad. Las fechas se muestran en hora de Colombia.

Prueba: `node tests/inglesRankingTiempo.test.mjs` cubre medición, reanudación, idempotencia, conservación del mejor resultado, los cuatro criterios de orden, límite del top 10 en el servidor, lista docente completa y permisos.

## Agregar canciones desde la aplicación

Ejecutar una sola vez `supabase/ingles-crear-canciones.sql` en Supabase SQL Editor, después de activar el módulo. Crea el bucket `ingles-audios` (MP3 de hasta 25 MB) y la función de publicación, restringida a docentes autenticados. Los audios de las actividades son públicos como los MP3 anteriores; las respuestas se mantienen en las tablas protegidas.

En **Aprende Inglés → Agregar canción**, el docente escribe título y artista, carga el MP3, pega la letra y escribe las palabras separadas por comas o saltos de línea. «Marcar palabras» selecciona todas sus apariciones sin distinguir mayúsculas; después puede pulsar cada aparición para ocultarla o conservarla. La vista previa muestra los espacios. Al cambiar la letra se reinicia la selección para evitar marcas desplazadas. Admite entre 1 y 100 espacios y grados 6°, 7° y 8°.

«Publicar canción» sube el audio y crea una actividad con banco mezclado, corrección, progreso y clasificación existentes. Reintentar una solicitud no crea otra actividad ni vuelve a subir un audio ya confirmado. El aviso de derechos y uso educativo aparece al pie del módulo. Las canciones existentes conservan sus rutas, actividades e intentos.

Verificación: `node tests/crearCancion.test.mjs`, `node tests/crearCancionSql.test.mjs` y `node tests/crearCancionBrowser.test.mjs` (acepta `INGLES_TEST_CHROMIUM`).

## Revisión temporal para estudiantes

Después de calificar se muestran el puntaje y las respuestas con su revisión durante 120 segundos, con contador visible. Los campos quedan bloqueados: para cambiar respuestas se debe iniciar otro intento completo. Al terminar ese plazo se ocultan letra, banco, audio y respuestas; permanece el puntaje y el botón para realizar otro intento.

Salir de la app, cambiar de pestaña, bloquear la pantalla o abrir otra sección descarta lo escrito. La revisión no se recupera al volver ni al recargar. El puntaje y los resultados ya calificados se conservan. Los nuevos intentos empiezan con todos los campos vacíos y el audio desde el inicio. Este cambio no requiere SQL adicional. La práctica de docentes conserva su funcionamiento anterior.
