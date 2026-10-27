# Escarapelas y certificados - Feria STEAM 2026

## Activación

Ejecutar `supabase/feria-participantes-certificados.sql` completo en Supabase SQL Editor. Requiere la feria interna/externa existente, `feria-jurados.sql` y la actualización `feria-familias-estados.sql`. No borra proyectos, placas ni revisiones. Es repetible y recupera los expositores de proyectos ya aprobados.

## Cinco funciones

- Expositor(a): código EXP; color y código STEM/ART/EMP/FAM del proyecto.
- Evaluador(a): código EVA, azul oscuro. El docente puede completar su registro desde una postulación de jurado; postularse no genera automáticamente una credencial ni un certificado.
- Logística: código LOG, terracota.
- Ponente: código PON, morado; campo para la charla o actividad.
- Asistente: código ASI, turquesa.

El número de la escarapela es único en el registro de participantes. El código del proyecto es independiente y se conserva en sus placas y escarapelas.

## Docentes

Feria STEAM → Participantes y certificados.

1. Los estudiantes activos integrantes de un proyecto aprobado aparecen automáticamente como expositores, con su nombre, grado y proyecto. Reaprobar no duplica registros. Una persona con dos proyectos aprobados tiene una credencial por proyecto.
2. Registrar participante permite crear las otras funciones y registrar, individualmente por nombre, familiares y expositores de instituciones invitadas. Los nombres libres de los formularios familiares/externos no se dividen automáticamente para evitar confundir personas.
3. Para estudiantes de Claudina, seleccionar su ficha. La escarapela y el certificado se vinculan a esa cuenta y al acudiente vinculado. Una misma persona puede tener funciones distintas.
4. Filtrar por función o buscar por nombre, institución, código o proyecto. Descargar escarapelas individuales o todas las habilitadas de la lista.
5. Vista previa del certificado produce un borrador marcado SIN EMITIR. Confirmar participación y emitir registra un certificado oficial, con folio único, fecha, datos del participante, función, proyecto cuando corresponda, firma del docente líder PRAE y texto adaptado a la función.
6. Descargar certificados emitidos, individualmente o en un PDF conjunto. La emisión requiere confirmación explícita de participación por el docente; aprobar un proyecto no emite certificados automáticamente.
7. Para corregir datos ya certificados, anular el certificado con un motivo y volver a emitir después de corregir. Los registros anteriores se conservan; los folios no se reutilizan. Un certificado emitido conserva su contenido aunque después cambie el proyecto o el nombre en la ficha.

## Estudiantes y acudientes

Feria STEAM → Mis escarapelas y certificados. El estudiante solo consulta sus propios registros; el acudiente, los del estudiante vinculado. También se muestran los documentos del expositor dentro del proyecto aprobado.

- Escarapela disponible si el registro está activo y el proyecto asociado está aprobado. Al quitar a un estudiante del equipo automático, su escarapela deja de estar habilitada.
- Los registros de Logística, Ponente, Asistente o Evaluador vinculados por un docente también aparecen en esa cuenta, aunque no tenga proyecto.
- El certificado aparece para descarga cuando un docente confirma y emite. Un certificado anulado deja de aparecer al actualizar. Un certificado vigente emitido sigue disponible como constancia histórica, aunque el proyecto pase luego a ajustes.
- Participantes externos/familiares reciben sus documentos a través del docente; este módulo no publica un directorio de personas ni certificados anónimos.

## Impresión

Escarapela: 91 × 113 mm (9,1 × 11,3 cm). Cuatro por página carta vertical, dos columnas por dos filas, con bordes de corte. Imprimir tamaño real/100 %, una página del PDF por hoja, sin ajustar. El PDF individual ocupa una posición; para aprovechar papel, usar descarga conjunta.

Certificado: carta horizontal, uno por página. Las fuentes y las imágenes institucionales están incrustadas en el PDF; no depende de una captura de pantalla. No incluye horas o datos de identidad no solicitados.

## Validación

- `node tests/feriaParticipantesSql.test.mjs`
- `node tests/feriaParticipantesPdf.test.mjs`
- `FERIA_TEST_CHROMIUM=/ruta/a/chromium node tests/feriaParticipantesBrowser.test.mjs`
- `npm run build`

Se verifican permisos, funciones, vinculación de cuentas, repetición de aprobaciones, emisión idempotente, contenido inmutable, anulación/reemisión, baja del equipo y descargas reales en navegador. Los PDF se renderizan y revisan, incluidos nombres e instituciones extensos.
