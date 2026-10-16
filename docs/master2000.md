# Consulta de notas de Master 2000

La pestaña «Notas de Master» pertenece a la cuenta del estudiante. El servidor verifica el token de Supabase, el rol estudiante y la ficha activa vinculada antes de consultar. Obtiene el documento de esa ficha; no acepta documentos, nombres, URL o fichas elegidos por el cliente. Verifica también que el nombre del panel de Master coincida con el nombre completo de Claudina, independientemente del orden y las tildes.

## Funcionamiento

1. La primera vez se confirma el primer apellido: no se infiere de un nombre completo cuyo orden puede variar. El acceso inicial usa documento + inicial en mayúscula. No hay intentos automáticos con variantes de contraseñas.
2. Si la clave cambió, el estudiante puede introducir la actual. Solo permanece en la memoria de la vista mientras está abierta. Nunca se almacena en Supabase, localStorage o archivos.
3. Se abre el enlace institucional estable `https://login.master2000.net/ingreso/?A=205129000156`. Los parámetros AB/DC son temporales y no se reutilizan.
4. El resumen trae notas, valores de Master y faltas. Abrir una materia realiza una consulta nueva y lee la descripción de cada actividad calificada. No confunde el número de actividad del detalle con el valor de la calificación.
5. Se conserva el apellido en los metadatos de la cuenta solo después de una consulta correcta. No se conservan cookies ni sesiones de Master entre peticiones. Cada petición crea y cierra su propio contexto.
6. Los términos pendientes, la identidad diferente, los períodos cerrados y las claves rechazadas producen un mensaje, sin aceptar términos ni modificar la cuenta. La sugerencia opcional de registrar correo puede posponerse con el control ofrecido por Master.

## Despliegue

Se usan las variables ya existentes `SUPABASE_URL` (o `VITE_SUPABASE_URL`) y `SUPABASE_SERVICE_ROLE_KEY`. No se necesita una migración SQL nueva. El limitador existente `acudiente_registrar_intento` admite 12 consultas por cuenta en diez minutos con una clave HMAC exclusiva de este módulo. Abrir las actividades de una materia cuenta como una consulta.

Vercel empaqueta el binario de `@sparticuz/chromium` con la función `api/master2000.js` y tiene un máximo de 60 segundos para esa ruta. Chromium se extrae a almacenamiento temporal. No habilitar registro de cuerpos de petición ni de credenciales. Las respuestas usan `private, no-store`, y el service worker no almacena peticiones de la API. La prueba de servidor con Chromium usa páginas sintéticas interceptadas; no transmite credenciales ni accede a Master.

## Validación

- `npm run build`
- `npm test` incluye seguridad del handler, interfaz y navegación/extracción con un Chromium real contra páginas sintéticas, sin tráfico externo.
- La consulta desde el servidor desplegado debe verificarse desde una cuenta estudiantil activa autorizada. La prueba previa de lectura en el navegador de trabajo no sustituye esa validación.

Una ficha retirada/inactiva no se reactiva para realizar pruebas. Las notas temporales que se introdujeron en Master para probar la lectura no se incluyen en el repositorio.
