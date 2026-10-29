const escapar=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function htmlListaEstudiantes(estudiantes,fecha=new Date()){
 const grados=[...new Set(estudiantes.map(e=>Number(e.grado)))].sort((a,b)=>a-b);
 const paginas=grados.map(grado=>{
  const lista=estudiantes.filter(e=>Number(e.grado)===grado).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
  return `<section><header><b>C.E.R. Claudina Múnera · Claudina App</b><h1>Lista de estudiantes · ${grado===0?'TS y JR':grado+'°'}</h1><p>${lista.length} estudiantes · ${escapar(fecha.toLocaleDateString('es-CO',{timeZone:'America/Bogota'}))}</p></header><table><thead><tr><th>N.º</th><th>Nombre</th><th>Correo registrado</th><th>Documento registrado</th><th>Estado</th></tr></thead><tbody>${lista.map((e,i)=>`<tr><td>${i+1}</td><td>${escapar(e.nombre)}</td><td>${escapar(e.email||'Sin registrar')}</td><td>${escapar(e.documento||'Sin registrar')}</td><td>${e.activo?'Activo':'Retirado'}</td></tr>`).join('')}</tbody></table></section>`;
 }).join('');
 return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lista de estudiantes por grado · Claudina App</title><style>body{font:14px/1.5 Arial,sans-serif;color:#17372b;margin:24px}main{max-width:1050px;margin:auto}header{border-bottom:3px solid #176d4b;margin-bottom:20px}h1{font-size:23px}section{margin-bottom:40px}table{border-collapse:collapse;width:100%;font-size:12px;table-layout:fixed}th,td{padding:9px 7px;border:1px solid #c4d8cc;text-align:left;overflow-wrap:anywhere}th{background:#e9f4ee}th:first-child{width:5%}th:nth-child(2){width:28%}th:nth-child(3){width:30%}th:nth-child(4){width:23%}th:last-child{width:14%}button{background:#176d4b;color:white;border:0;border-radius:8px;padding:12px 20px;cursor:pointer}.controls{margin-bottom:24px}@media print{@page{size:A4 landscape;margin:14mm}body{margin:0;color:#111}.controls{display:none}section{break-before:page}section:first-of-type{break-before:auto}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><main><div class="controls"><button onclick="window.print()">Imprimir / Guardar como PDF</button><p>Listado de los estudiantes del filtro seleccionado. Cada grado empieza en una página nueva.</p></div>${paginas}</main></body></html>`;
}
export function imprimirListaEstudiantes(estudiantes){
 if(!estudiantes.length)throw new Error('No hay estudiantes en el filtro seleccionado.');
 const ventana=window.open('','_blank');
 if(!ventana)throw new Error('Permite abrir la ventana de impresión e inténtalo de nuevo.');
 ventana.opener=null;ventana.document.open();ventana.document.write(htmlListaEstudiantes(estudiantes));ventana.document.close();ventana.focus();
}
