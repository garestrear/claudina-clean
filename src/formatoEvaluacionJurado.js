import {claveProyecto,rubricas,rubricasAnteriores,categoriasEvaluacion,descripcionesRubricas,nivelesEvaluacion} from './evaluacionJurados.js';
import {nombreFeria,textoFeria} from './estiloTextoFeria.js';
export function datosFormatoJurado(ctx,id){
 if(!ctx?.docente)throw Error('Solo docentes pueden descargar los formatos.');
 const jurado=ctx.jurados?.find(j=>j.id===id&&j.habilitado);if(!jurado)throw Error('El jurado no está activo.');
 const visitas=(ctx.visitas||[]).filter(v=>v.jurado_id===id).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||String(a.inicio).localeCompare(String(b.inicio)));
 if(!visitas.length)throw Error('Este jurado aún no tiene proyectos asignados.');
 if(visitas.some(v=>!v.evaluacion)&&ctx.config?.rubrica_version!==2)throw Error('Activa feria-rubrica-experiencias.sql antes de descargar los nuevos formatos.');
 return {jurado,visitas,proyectos:ctx.proyectos||[]};
}
export function construirFormatoJurado(jsPDF,{jurado,visitas,proyectos},recursos={}){
 if(!jurado?.nombre||!visitas?.length)throw Error('Selecciona un jurado con visitas asignadas.');
 const pdf=new jsPDF({unit:'mm',format:'letter',compress:true});let fuente='helvetica';
 if(recursos.regular&&recursos.bold){for(const [estilo,archivo] of [['normal','regular'],['bold','bold']]){pdf.addFileToVFS(archivo+'.ttf',recursos[archivo]);pdf.addFont(archivo+'.ttf','Formato',estilo)}fuente='Formato'}
 function t(texto,x,y,tamano=10,bold=false,ancho=180){pdf.setFont(fuente,bold?'bold':'normal');pdf.setFontSize(tamano);const lineas=pdf.splitTextToSize(String(texto??''),ancho);pdf.text(lineas,x,y,{lineHeightFactor:1.2});return lineas.length*tamano*.35278*1.2}
 visitas.forEach((v,index)=>{
  if(index)pdf.addPage();const p=proyectos.find(p=>claveProyecto(p)===claveProyecto(v));if(!p)throw Error('Actualiza la lista: hay un proyecto no disponible.');
  const version=v.evaluacion?(v.evaluacion.rubrica_version||1):2,r=(version===1?rubricasAnteriores:rubricas)[p.categoria];if(!r)throw Error('La categoría no tiene rúbrica.');
  const h=x=>String(x||'').slice(0,5),u=p.ubicaciones?.find(u=>u.fecha===v.fecha&&h(u.inicio)<=h(v.inicio)&&h(u.fin)>=h(v.fin));
  let y=18;pdf.setTextColor(0);t('Feria STEAM 2026 · Claudina Múnera',18,y,14,true);y+=8;
  t('Evaluación en papel · '+(index+1)+' de '+visitas.length,18,y,11,true);y+=7;
  y+=t('Jurado: '+nombreFeria(jurado.nombre),18,y,11,true)+2;
  y+=t('Proyecto: '+(p.codigo||'')+' · '+textoFeria(p.titulo),18,y,11,true)+2;
  y+=t(`${v.fecha} · ${h(v.inicio)}-${h(v.fin)} · ${nombreFeria(u?.espacio_nombre)||'Aula por confirmar'}${u?.puesto?' · '+u.puesto:''}`,18,y,9)+2;
  y+=t(categoriasEvaluacion[p.categoria]+` · Rúbrica ${version}`,18,y,9)+3;
  if(v.evaluacion?.enviada){y+=t('YA ENVIADA EN LA APP: copia de consulta. No volver a calificar.',18,y,10,true)+2}
  y+=t('Marca una sola nota de 1 a 5 por criterio. Valora según la edad. 3 significa que logra lo esperado; no se exige trabajo profesional ni investigación prolongada.',18,y,9)+2;
  y+=t(nivelesEvaluacion.map(([n],i)=>`${i+1}: ${n}`).join(' · '),18,y,8.5)+4;
  pdf.setFillColor('#edf4ef');pdf.rect(18,y,180,8,'F');t('Criterio y peso',21,y+5.5,10,true);t('Nota (marca una)',153,y+5.5,9,true,42);y+=8;
  r.forEach(([nombre,peso],i)=>{
   pdf.setFont(fuente,'bold');pdf.setFontSize(9.5);const nombreLineas=pdf.splitTextToSize(`${nombre} (${peso} %)`,124);
   pdf.setFont(fuente,'normal');pdf.setFontSize(8.5);const descripcion=version===2?descripcionesRubricas[p.categoria]?.[i]:'';const desc=descripcion?pdf.splitTextToSize(descripcion,124):[];
   const alto=Math.max(18,6+nombreLineas.length*4.1+desc.length*3.6);pdf.setDrawColor('#a6b4a9');pdf.rect(18,y,180,alto);pdf.line(149,y,149,y+alto);
   t(`${nombre} (${peso} %)`,21,y+5,9.5,true,124);if(desc.length)t(descripcion,21,y+5+nombreLineas.length*4.1,8.5,false,124);
   for(let n=1;n<=5;n++){const x=154+(n-1)*9;pdf.circle(x,y+alto/2,3);t(n,x-1,y+alto/2+1,8);if(v.evaluacion?.notas?.[i]===n){pdf.setLineWidth(.5);pdf.line(x-2,y+alto/2-2,x+2,y+alto/2+2);pdf.line(x+2,y+alto/2-2,x-2,y+alto/2+2);pdf.setLineWidth(.2)}}
   y+=alto;
  });
  y+=7;t('Un logro que quiero destacar:',18,y,10,true);y+=9;for(let i=0;i<2;i++){pdf.line(18,y,198,y);y+=8}
  t('Una sugerencia amable para seguir aprendiendo:',18,y,10,true);y+=9;for(let i=0;i<2;i++){pdf.line(18,y,198,y);y+=8}
  y+=2;t('Firma del jurado: ____________________   Fecha: __________',18,y,9);
  t('Puntaje opcional: suma de (nota × peso ÷ 5) = ______ / 100',18,y+7,9);
  t('Entrega el formato al comité. Este PDF no guarda ni envía notas a la app.',18,268,8);
  if(y+7>260)throw Error('El texto del proyecto es demasiado extenso para esta ficha. Reduce el título antes de imprimir.');
 });
 pdf.setProperties({title:'Evaluaciones en papel - '+nombreFeria(jurado.nombre),author:'C.E.R. Claudina Múnera'});return pdf;
}
export async function descargarFormatoJurado(datos){
 const [{jsPDF},regular,bold]=await Promise.all([import('jspdf'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const b64=async url=>{const res=await fetch(url);if(!res.ok)throw Error('No se pudieron cargar las fuentes de impresión.');const blob=await res.blob();return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('No se pudo preparar la impresión.'));r.readAsDataURL(blob)})};
 const [r,b]=await Promise.all([b64(regular.default),b64(bold.default)]);construirFormatoJurado(jsPDF,datos,{regular:r,bold:b}).save('Evaluaciones-Jurado-'+datos.jurado.nombre.replace(/[^\p{L}\p{N}]+/gu,'-')+'.pdf');
}
