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

Los estudiantes pueden pausar, retroceder diez segundos y escuchar a 0.75×. La revisión se realiza en Supabase: ignora mayúsculas y separadores, conserva el último intento y el mejor resultado, y evita duplicar el envío al reintentar una misma solicitud. Los borradores se guardan en el navegador por cuenta. La puntuación de práctica se expresa sobre 10.

Los docentes ven una vista previa, pueden ocultar el banco de palabras o cerrar la actividad y consultar resultados filtrados por sus grupos. El módulo no modifica las notas de aseo. Las tablas no admiten acceso directo de usuarios; las funciones comprueban la cuenta, su rol, la ficha activa y el grado.

## Verificación

- `node tests/inglesSql.test.mjs`: permisos, grados, corrección, intentos, idempotencia y cierre.
- `node tests/inglesUi.test.mjs`: formulario, errores, borradores y filtros docentes.
- `node tests/inglesBrowser.test.mjs`: navegador móvil, MP3, RPC, PostgreSQL, recarga y resultados. Puede usarse `INGLES_TEST_CHROMIUM` para seleccionar un ejecutable local de Chromium.
- `npm run build`: compilación de producción.
