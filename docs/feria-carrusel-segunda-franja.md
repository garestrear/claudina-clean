# Carrusel de la segunda franja

Activar `supabase/feria-carrusel-segunda-franja.sql` después de `feria-dos-franjas.sql`. En Aulas y programación → Líderes y carrusel → Segunda franja, regenerar grupos, asignar docentes y guardar organización. No se reemplazan planes existentes automáticamente ni se cambian proyectos de salón.

La segunda franja (bloques entre 10:15 y 11:40) excluye grado 0 (TS/preescolar) y estudiantes con exposición aprobada programada en ese mismo bloque, incluidos integrantes de segundo. Los expositores de la primera franja quedan disponibles. Los emprendimientos familiares no convierten a su estudiante vinculado en expositor.

El generador requiere cinco espacios, forma un grupo único de bachillerato (6°, 7° y 8°), mantiene inicialmente un bloque por grado de primaria y une los dos bloques de primaria más pequeños para obtener cinco grupos. El criterio usa estudiantes disponibles reales, con desempate por grado. Si faltan grados, solo segundo puede dividirse para completar cinco grupos; si no es posible, se explica el problema sin dividir otros grados. Los aforos se siguen mostrando como advertencia, sin fraccionar bachillerato ni los grados protegidos.

Duración: cuatro rotaciones de cinco minutos. Si inicia a las 10:15, finaliza a las 10:35. Cada grupo visita cuatro de los cinco lugares, sin repetir; en cada rotación hay un grupo por espacio. No se reordena el circuito guardado para la impresión. El resto del horario de la franja no se rellena con repeticiones automáticas.

El control de base de datos valida los cinco grupos no vacíos, la duración y el límite de cuatro rondas, así como bachillerato unido y grados de primaria completos salvo segundo. La primera franja conserva sus reglas anteriores. La impresión completa aplica las cuatro rotaciones y muestra la composición de cada grupo.

Validaciones: `node tests/carruselSegundaFranja.test.mjs`, `node tests/feriaSegundaFranjaSql.test.mjs`, `node tests/feriaSegundaFranjaBrowser.test.mjs`, `node tests/carruselFeria.test.mjs`, `node tests/feriaFranjasSql.test.mjs`, `npm run build`.
