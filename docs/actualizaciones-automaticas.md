# Actualizaciones automáticas sin interrumpir la escritura

La app consulta nuevas versiones al volver al primer plano, recuperar conexión y cada minuto. Ya no muestra el aviso ni el botón «Actualizar app».

`ActualizarApp` mantiene control explícito sobre la activación del service worker y la recarga; no se usa `skipWaiting()` incondicional durante la instalación. El modo interno `prompt` de Vite se conserva como mecanismo de espera, pero la aplicación lo resuelve automáticamente, sin preguntar.

Antes de activar o recargar, se comprueba que la página esté visible y no haya un campo de texto enfocado ni valores modificados pendientes. La protección se aplica a inputs, textareas y contenteditable, y también conserva los cambios en selects y otros controles. Salir del campo no descarta los cambios. Deshacerlos, restablecer el formulario o salir de la sección que contiene esos controles libera la actualización. Los formularios que se reinician o se sustituyen después de guardar también la liberan; si un formulario conserva los mismos campos y textos después del guardado, se espera conservadoramente a que la persona salga de esa sección.

La recarga ordenada por Workbox y los cambios de controlador activados desde otra pestaña pasan por la misma protección. La primera instalación no provoca una recarga repetitiva. Las comprobaciones fallidas no muestran avisos ni interrumpen el uso de la versión actual.

Los textos se comparan únicamente en memoria; no se guardan borradores ni contraseñas en disco mediante este mecanismo. No modifica las reglas de guardado de cada módulo ni impide que la persona recargue manualmente.

Para adoptar esta actualización desde una versión que todavía tiene el aviso anterior, hay que recargar la app una vez después de guardar el trabajo. Las actualizaciones siguientes se gestionan automáticamente.

Prueba: `npm run test:actualizaciones`. Cubre actualización sin edición, texto pendiente después de perder el foco, guardado fallido/correcto, otra pestaña, contraseña, deshacer y contenteditable. Puede usarse FERIA_TEST_CHROMIUM para indicar un Chromium local.
