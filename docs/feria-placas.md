# Placas de mesa Feria STEAM 2026

## Activación

Ejecutar `supabase/feria-familias-estados.sql` completo en Supabase SQL Editor sobre la feria existente (tablas internas y externas). Es repetible y conserva las inscripciones, revisiones y códigos. Incluye los proyectos ya aprobados. No necesita volver a ejecutar las migraciones anteriores si la feria ya está funcionando.

## Uso

- Docente: Feria STEAM → Placas y ubicación. Contadores generales y por categoría, búsqueda por código/número/título/expositor/institución, filtros y descarga individual o de toda la lista visible.
- Estudiante o acudiente: abrir su proyecto aprobado → Ver placa / Descargar placa PDF.
- Institución invitada: abrir su propuesta aprobada → placa disponible.
- Formato: carta horizontal al 100 %, con escudo, título, institución, expositores, código y número general. Las listas extensas continúan en otra hoja con el mismo código, sin recortar nombres.

## Identificación

- S-T-E-M: verde, `STEM-001` (ciencia, tecnología, ingeniería, matemáticas).
- Arte y Creatividad: morado, `ART-001`.
- Emprendimiento estudiantil: naranja, `EMP-001`.
- Emprendimientos de mamás y papás: azul, `FAM-001`, con contador propio. La migración reclasifica los familiares existentes conservando el número general; se deben reemplazar las placas impresas anteriores.
- Clasificación inicial si hay varias áreas: Emprendimiento, después Arte, después S-T-E-M. El docente puede corregir la categoría principal desde la placa.
- Todos los aprobados, internos y externos, comparten un contador general único y contadores por categoría. Se asignan en el servidor dentro de la aprobación, con un bloqueo transaccional común. No dependen del orden o filtro del navegador.
- Editar o volver a aprobar conserva los códigos. Reclasificar conserva el número general y asigna el siguiente código de la nueva categoría; hay que reemplazar la placa impresa. Los números retirados no se reutilizan.
- Los contadores visibles distinguen inscritos (sin borradores, incluidos rechazados) y aprobados actuales. Los números identifican proyectos; pueden quedar huecos si un proyecto deja de estar aprobado.
- La placa solo está disponible mientras el proyecto esté aprobado. Los nombres se consultan únicamente por sus integrantes/acudientes, el responsable externo o los docentes; no se publica un directorio con nombres para invitados anónimos.

## Estados docentes

Los docentes pueden elegir Borrador, Por revisar, En ajustes, Aprobado y Rechazado en cualquier momento, incluso en proyectos ya revisados o borradores. Se mantiene el historial, la validación de versión y la exclusividad del permiso docente. En ajustes y Rechazado requieren observaciones. La placa solo aparece en Aprobado.

## Verificación

`node tests/feriaPlacasSql.test.mjs`

`node tests/feriaPlacasPdf.test.mjs`

`FERIA_TEST_CHROMIUM=/ruta/a/chromium node tests/feriaPlacasBrowser.test.mjs`

`npm run build`
