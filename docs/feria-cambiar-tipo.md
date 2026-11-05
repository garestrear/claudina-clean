# Corregir el tipo de participación de un proyecto

Activación: ejecutar `supabase/feria-cambiar-tipo.sql` en el SQL Editor del proyecto Supabase de Claudina App. Requiere las migraciones de correcciones docentes y placas familiares; puede ejecutarse más de una vez.

En Claudina App, ingresar como docente → Feria STEAM → Revisar proyecto → Tipo de participación. Elegir Proyecto estudiantil o Emprendimiento familiar, seleccionar las áreas STEAM correspondientes y pulsar Guardar revisión.

Para un proyecto científico inscrito por error como emprendimiento familiar, seleccionar Proyecto estudiantil, desmarcar Emprendimiento y marcar las áreas que correspondan. Un emprendimiento realizado por estudiantes puede conservar el área Emprendimiento y el tipo Proyecto estudiantil.

Se conserva el registro, el equipo, el asesor, los textos y el estado. El cambio queda en el historial con el nombre del docente. Si existía una placa, se conserva el número general y se asigna un código de la categoría correcta. Volver a generar las placas y escarapelas que ya se hubiesen impreso.

Validación: `node tests/feriaCambiarTipoSql.test.mjs`, `node tests/feriaCambiarTipoUi.test.mjs`, `node tests/feriaCorreccionesSql.test.mjs` y `npm run build`.
