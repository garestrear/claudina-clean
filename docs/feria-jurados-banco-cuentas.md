# 20 cuentas de reserva para jurados

Ejecutar `supabase/feria-jurados-banco-cuentas.sql` después de las migraciones de evaluación, cuentas y asignación automática. Conserva los jurados, recorridos, borradores y evaluaciones. También corrige las actualizaciones sin WHERE que impedían registrar jurados con safeupdate.

En Feria STEAM → Evaluación de jurados → 20 usuarios para jurados, introducir la contraseña inicial acordada y pulsar **Preparar las 20 cuentas**. El servidor crea `jurado01` a `jurado20`, con la contraseña inicial introducida por el docente, sin correos ni enlaces de confirmación. Requiere las variables del servidor ya utilizadas por `/api/jurado`: SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY (también se admiten los nombres VITE existentes para URL y clave pública). La clave de servicio nunca se entrega al navegador.

La preparación hace una petición por cuenta y permite reintentar si se interrumpe. No restablece las contraseñas ni las asignaciones existentes. Si un nombre ya existe fuera del banco, informa el conflicto y no modifica esa cuenta.

Registrar al jurado con su nombre y datos habituales, habilitarlo y seleccionar su nombre junto al usuario disponible. Pulsar **Asignar usuario** y entregarle ese usuario con la contraseña inicial y el enlace `https://claudina-clean.vercel.app/?ingreso=jurado`. El correo registrado queda como contacto, no se usa para este acceso.

La cuenta no permite ingresar hasta estar vinculada a una persona habilitada. Al primer ingreso se exige una contraseña diferente de al menos 10 caracteres, antes de mostrar el recorrido. El servidor verifica la contraseña actual y la base de datos bloquea guardar evaluaciones hasta completar el cambio. Las notas siguen perteneciendo al jurado registrado. Las reservas no crean jurados ficticios ni reciben visitas. Las asignadas no se reutilizan, incluso si se retira al jurado. Para recuperar acceso usar el restablecimiento individual existente.

## Carta de acceso y recorrido

En **Jurados inscritos** y en cada ficha de **Evaluación de jurados** aparece **Descargar carta de acceso y recorrido PDF**. Consulta el contexto vigente al descargar, filtra solo las visitas de esa persona, las ordena por fecha y hora e incluye el salón reservado durante la visita. Indica ubicaciones o asignaciones pendientes sin inventarlas. Usa el membrete y la firma institucional de Gustavo Restrepo ya existentes.

Si la cuenta aún requiere cambiar contraseña, el docente introduce la contraseña inicial que entregó. Solo se conserva durante la generación del PDF, nunca se almacena en la base de datos, localStorage ni en el repositorio. Si el jurado ya la cambió, la carta indica utilizar la contraseña personal y no imprime la inicial. No se puede recuperar la contraseña personal. El PDF es individual e incluye agradecimiento, orientaciones, pasos de evaluación y firma; puede descargarse otra vez para reflejar las asignaciones más recientes.
