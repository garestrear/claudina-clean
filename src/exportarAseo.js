import {nombreGrupo} from '../lib/gruposDocente.js';

export async function descargarConsolidadoAseo(resultados, grupo, desde, hasta, limite) {
  const modulo = await import('exceljs/dist/exceljs.min.js');
  const Excel = modulo.default || modulo;
  const libro = new Excel.Workbook();
  const grupos = new Map();
  for (const fila of resultados) {
    const clave = grupo === 'todos'
      ? ([7, 8].includes(Number(fila.estudiante.grado)) ? '7-8' : String(fila.estudiante.grado))
      : grupo;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(fila);
  }
  for (const [clave, filas] of grupos) {
    const hoja = libro.addWorksheet(nombreGrupo(clave));
    hoja.columns = [{width: 40}, {width: 14}, {width: 14}, {width: 16}, {width: 17}, {width: 12},
      {width: 15}, {width: 12}, {width: 15}];
    hoja.addRow(['Calificaciones de aseo', nombreGrupo(clave)]);
    hoja.addRow(['Fechas', desde || 'Desde el inicio', hasta || 'Hasta hoy']);
    hoja.addRow(['Criterio', limite == null ? 'Todas las notas' : `Mejores ${limite} notas (0/10 por cada faltante)`]);
    const encabezado = hoja.addRow(['Estudiante', 'Grado', 'Aseos', 'Notas usadas', 'Por completar', 'Cumplió',
      'No cumplió', 'Ausente', 'Promedio / 10']);
    encabezado.font = {bold: true};
    hoja.autoFilter = {from: 'A4', to: 'I4'};
    hoja.views = [{state: 'frozen', ySplit: 4}];
    for (const {estudiante, total, usadas, faltantes, cumplio, noCumplio, ausente, promedio} of filas) {
      const fila = hoja.addRow([
        estudiante.nombre + (estudiante.activo ? '' : ' (retirado)'),
        nombreGrupo(String(estudiante.grado)), total, usadas, faltantes, cumplio, noCumplio, ausente,
        promedio == null ? null : Number(promedio.toFixed(2)),
      ]);
      fila.getCell(9).numFmt = '0.00';
    }
  }
  const archivo = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([archivo], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `calificaciones-aseo-${grupo}.xlsx`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
