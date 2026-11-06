# Corregir la clasificación después de preparar la final

Ejecutar `supabase/feria-puentes-reclasificar-final.sql` después de `feria-puentes-gran-final.sql`. En la app, abrir Concurso de puentes → Consultar eliminatoria → Corregir clasificados de la final. Seleccionar Descalificar y recalcular en el puente, escribir el motivo y confirmar.

La descalificación se guarda en la eliminatoria y se recalculan los cinco cupos juveniles y seis infantiles con el mismo criterio y desempate de la clasificación original. El siguiente clasificado entra con cero puntos y tres intentos disponibles. Los finalistas que continúan mantienen su identidad, estado e intentos. El retirado queda descalificado también en la final y conserva todos sus registros históricos. No se borra ninguna ronda ni se transfieren cargas eliminatorias a la final.

La operación es atómica, exclusiva de docentes, con versión del puente, bloqueo concurrente y auditoría de las listas finales antes y después. Reintentar una solicitud confirmada no vuelve a promover ni duplica finalistas. Si hay una prueba pendiente, un empate sin resolver en el corte o no quedan suficientes candidatos para los cupos, se informa el problema y no se aplica ningún cambio. Las demás modificaciones de la eliminatoria continúan bloqueadas.

Antes de preparar la final, la descalificación habitual sigue disponible en Puentes inscritos; preparar la final excluye los descalificados. Esta actualización también hace que el RPC habitual recalcule si se descalifica una ficha eliminatoria desde otro cliente después de preparar la final.
