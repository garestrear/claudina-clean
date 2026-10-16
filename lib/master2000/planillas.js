// Self-contained DOM reader, shared by the adapter and synthetic DOM tests.
export function leerPlanillasDOM(){
 const normal=s=>String(s||'').replace(/\s+/g,' ').trim();
 const materias=[];
 for(const t of document.querySelectorAll('table')){
  if(t.querySelector('table'))continue;
  const filas=Array.from(t.rows),cabecera=filas.find(r=>normal(r.cells[0]?.textContent)==='1.1');
  if(!cabecera)continue;
  const fila=filas[filas.indexOf(cabecera)+1];if(!fila)continue;
  const nombre=normal(filas[0]?.textContent),detalle=filas[1]?.cells[0]?.id||'';
  const grupos=filas[filas.indexOf(cabecera)-1];let columna=0;const categorias=[];
  for(const celda of grupos?.cells||[]){for(let n=0;n<celda.colSpan;n++)categorias[columna++]=normal(celda.textContent)}
  const resumen=[],actividades=[];
  for(let i=0;i<cabecera.cells.length;i++){
   const codigo=normal(cabecera.cells[i].textContent),celda=fila.cells[i];if(!celda)continue;
   const nota=normal(celda.querySelector('.popoverData')?.childNodes[0]?.textContent||celda.textContent);
   if(/^\d+\.\d+$/.test(codigo)){
    actividades.push({codigo,nota:nota||null,categoria:categorias[i]||'',descripcion:null,celda:nota?celda.id:null});
   }else resumen.push({columna:codigo,valor:nota});
  }
  const codigo=detalle.replace(/^demoArr/,'');
  if(!/^[A-Za-z0-9_-]+$/.test(codigo)||!nombre)throw new Error('FORMATO');
  materias.push({codigo,nombre,actividades,resumen,detalle});
 }
 return {encabezado:normal(document.querySelector('#nombre_modulo')?.textContent),estudiante:normal(document.querySelector('#InfoEstudiante')?.textContent||document.body.innerText.match(/Estudiante:\s*([^\n]+)/)?.[1]),materias};
}
export function descripcionActividad(texto){return String(texto||'').split(/ACTIVIDAD\s*:/i).slice(1).join('ACTIVIDAD:').trim()||null}
export function nombreComparable(nombre){return String(nombre||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z ]/g,' ').trim().split(/\s+/).filter(Boolean).sort().join(' ')}
export function respuestaPublica(datos){return {periodo:datos.periodo,ano:datos.ano,consultado_en:datos.consultado_en,materias:datos.materias.map(({codigo,nombre,actividades,resumen})=>({codigo,nombre,resumen,actividades:actividades.map(({codigo,nota,categoria,descripcion})=>({codigo,nota,categoria,descripcion}))}))}}
