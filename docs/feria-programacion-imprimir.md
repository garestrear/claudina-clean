# Impresión completa de la feria

Activar `supabase/feria-programacion-imprimir.sql` después de agenda general y carrusel. No modifica los datos guardados.

En Aulas y programación, Imprimir programación completa abre un documento para la fecha seleccionada con:

- Agenda general, lugares e indicaciones.
- Todas las franjas de carrusel guardadas, rutas por horario, líderes de aula, acompañantes e integrantes de cada grupo.
- Índice de espacios y ficha por salón con proyectos, mesas, responsables, observaciones, visitas de grupos y líderes.

Incluye el escudo institucional, letra negra, acentos verdes, formato Carta horizontal, encabezados de tabla repetidos y saltos entre franjas y salones. Los salones se ordenan numéricamente (1, 2, 10), antes de otros espacios ordenados por nombre, tanto en el documento como en Aulas y programación. El orden del circuito guardado se conserva para que las rutas impresas coincidan con el carrusel.

La impresión consulta datos actuales y avisa si no hay planes guardados o si un recorrido cambió desde su guardado. Las modificaciones sin guardar en los formularios no se imprimen. No genera ni guarda planes de rotación automáticamente.

Validaciones: `node tests/programacionFeria.test.mjs`, `node tests/feriaProgramacionImpresionSql.test.mjs`, `node tests/feriaProgramacionImpresionBrowser.test.mjs`, `npm run build`.
