# Jurados inscritos y cartas de invitación

En la vista docente, abrir **Feria STEAM > Jurados inscritos**. Se muestran nombre, institución, profesión, correo, teléfono y fecha de inscripción, con el total y páginas de treinta personas. **Actualizar jurados** consulta nuevas postulaciones.

Cada tarjeta tiene **Descargar carta de invitación PDF**. La carta incluye los datos de la persona, membrete y escudo institucionales, firma de Gustavo Restrepo en representación del Equipo PRAE y fecha de expedición en hora de Colombia. Se descarga directamente como PDF y permite confirmar disponibilidad al correo del PRAE o al celular del docente.

Datos de la feria: 6 de noviembre de 2026, de 7:00 a. m. a 1:00 p. m., en el C.E.R. Claudina Múnera, vereda La Corrala, Caldas, Antioquia. También se actualizó este horario en las invitaciones y los formularios públicos.

La generación de una carta no envía mensajes ni confirma automáticamente la asistencia del candidato.

No requiere una nueva migración si las postulaciones ya se están guardando: utiliza `public.feria_jurados` y su política de lectura exclusiva para docentes, instaladas por `supabase/feria-jurados.sql`. Si ese registro no se instaló aún, ejecutar dicho archivo completo en Supabase SQL Editor. Conserva los registros existentes.

Las fuentes de las cartas se incluyen con sus licencias y se cargan al descargar el PDF, junto con las imágenes de membrete y firma. El texto del PDF se conserva seleccionable y maneja nombres largos.

Validación: pruebas SQL de permisos y registros; generación de PDF y revisión visual con nombres habituales y largos; navegador móvil con treinta y dos candidatos, paginación y descarga real del PDF; regresiones de feria y compilación de producción.
