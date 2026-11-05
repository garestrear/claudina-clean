# Recuperar resultados históricos del concurso de puentes

Activación: ejecutar `supabase/feria-puentes-importar.sql` en Supabase SQL Editor, después de las migraciones de descalificación y duración. Es repetible. Elimina el requisito de masa para iniciar; la foto y las medidas también son opcionales. Las condiciones del montaje y la carga del intento siguen siendo necesarias.

En Concurso de puentes, abrir **Importar resultados históricos de Excel**, cargar el `.xlsx` original (máximo 10 MB) y elegir la hoja. Se requieren columnas NOMBRE e INTENTO 1, 2 y 3; se leen también grado, integrantes y total.

1. Cotejar cada fila con un puente inscrito. No se crean duplicados automáticamente. El nombre exacto propone una coincidencia, pero el docente debe confirmar grado e integrantes.
2. Revisar resultado y carga de cada intento: rojo propone fallo; un nombre con relleno de color propone descalificación. Confirmar estas interpretaciones, especialmente con formatos condicionales o colores de tema.
3. Aclarar celdas rojas vacías: falta la carga, y no se inventa un número. Si no se conoce, excluir la fila hasta aclararla. Una celda sin intento no suma cero ni crea una ronda.
4. Justificar discrepancias de total. La clasificación suma únicamente intentos válidos. El total original se conserva en el respaldo.
5. Indicar el motivo de cada descalificación. Sus pruebas se conservan sin asignarle puesto.
6. Confirmar cada fila y el lote; importar.

La operación se guarda completa o se revierte completa. No sobrescribe ni elimina rondas existentes: una diferencia exige cotejo. Repetir la misma solicitud no duplica resultados. Se conserva el archivo original en almacenamiento privado y un registro del docente, hash SHA-256, hoja, filas y resoluciones. Las horas técnicas de carga de las rondas importadas no representan la hora ni la duración real de la prueba.

Los empates con una masa desconocida quedan provisionales; la falta de masa nunca equivale a cero gramos.
