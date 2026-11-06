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
export function construirFormatoJurado(jsPDF,datos,recursos={}){return construirFormatosJurados(jsPDF,[datos],recursos)}
export function construirFormatosJurados(jsPDF,lotes,recursos={},documento=null){
 const fichas=lotes.flatMap(d=>d.visitas.map((v,i)=>({...d,v,numero:i+1,total:d.visitas.length})));
 if(!fichas.length||fichas.some(d=>!d.jurado?.nombre))throw Error('Selecciona jurados con visitas asignadas.');
 const pdf=documento||new jsPDF({unit:'mm',format:'letter',orientation:'landscape',compress:true});let fuente='helvetica';
 if(recursos.regular&&recursos.bold){for(const [estilo,archivo] of [['normal','regular'],['bold','bold']]){pdf.addFileToVFS(archivo+'.ttf',recursos[archivo]);pdf.addFont(archivo+'.ttf','Formato',estilo)}fuente='Formato'}
 const ancho=123.7;
 function lineas(texto,size,w,max=99){pdf.setFontSize(size);const ls=pdf.splitTextToSize(String(texto??''),w);if(ls.length>max){const recorte=ls.slice(0,max);while(pdf.getTextWidth(recorte[max-1]+'…')>w)recorte[max-1]=recorte[max-1].slice(0,-1);recorte[max-1]+='…';return recorte}return ls}
 function t(texto,x,y,size=8.5,bold=false,w=ancho,max=99){pdf.setFont(fuente,bold?'bold':'normal');const ls=lineas(texto,size,w,max);pdf.text(ls,x,y,{lineHeightFactor:1.2});return ls.length*size*.35278*1.2}
 fichas.forEach(({jurado,proyectos,v,numero,total},i)=>{
  if((!i&&documento)||(i&&i%2===0))pdf.addPage('letter','landscape');
  if(i%2===0){pdf.setDrawColor('#888888');pdf.setLineWidth(.2);pdf.setLineDashPattern([2,2],0);pdf.line(139.7,5,139.7,210.9);pdf.setLineDashPattern([],0)}
  const x=8+(i%2)*139.7,p=proyectos.find(p=>claveProyecto(p)===claveProyecto(v));if(!p)throw Error('Actualiza la lista: hay un proyecto no disponible.');
  const version=v.evaluacion?(v.evaluacion.rubrica_version||1):2,r=(version===1?rubricasAnteriores:rubricas)[p.categoria];if(!r)throw Error('La categoría no tiene rúbrica.');
  const h=z=>String(z||'').slice(0,5),u=p.ubicaciones?.find(u=>u.fecha===v.fecha&&h(u.inicio)<=h(v.inicio)&&h(u.fin)>=h(v.fin));
  let y=12;pdf.setTextColor(0);t('Feria STEAM 2026 · Evaluación en papel',x,y,10,true);y+=6;
  y+=t('Jurado: '+nombreFeria(jurado.nombre),x,y,9,true,ancho,2)+1.5;
  y+=t('Proyecto: '+(p.codigo||'')+' · '+textoFeria(p.titulo),x,y,9,true,ancho,4)+1.5;
  y+=t(`${v.fecha} · ${h(v.inicio)}-${h(v.fin)} · ${nombreFeria(u?.espacio_nombre)||'Aula por confirmar'}${u?.puesto?' · '+u.puesto:''}`,x,y,8,false,ancho,2)+1;
  y+=t(categoriasEvaluacion[p.categoria]+` · Ficha ${numero}/${total} · Rúbrica ${version}`,x,y,8,false,ancho,2)+2;
  if(v.evaluacion?.enviada)y+=t('YA ENVIADA: copia de consulta; no volver a calificar.',x,y,8,true)+1;
  y+=t('Marca una nota por criterio. Valora según la edad: 3 significa que logra lo esperado. No exijas trabajo profesional ni investigación prolongada.',x,y,8)+1;
  y+=t('1 Inicial · 2 En proceso · 3 Logrado · 4 Muy logrado · 5 Destacado',x,y,7.5)+3;
  pdf.setFillColor('#edf4ef');pdf.rect(x,y,ancho,6,'F');t('Criterio y peso',x+2,y+4.2,8.5,true);t('Nota',x+98,y+4.2,8,true,24);y+=6;
  r.forEach(([nombre,peso],k)=>{
   pdf.setFont(fuente,'bold');const nombreLs=lineas(`${nombre} (${peso} %)`,8.2,88,3);
   const descripcion=version===2?descripcionesRubricas[p.categoria]?.[k]:'';pdf.setFont(fuente,'normal');const desc=descripcion?lineas(descripcion,7.3,88,2):[];
   const alto=Math.max(14,4+nombreLs.length*3.5+desc.length*3.1);
   pdf.setDrawColor('#9eaaa0');pdf.setLineWidth(.15);pdf.rect(x,y,ancho,alto);pdf.line(x+93,y,x+93,y+alto);
   t(`${nombre} (${peso} %)`,x+2,y+4,8.2,true,88,3);if(desc.length)t(descripcion,x+2,y+4+nombreLs.length*3.5,7.3,false,88,2);
   for(let n=1;n<=5;n++){const cx=x+97+(n-1)*5.5,cy=y+alto/2;pdf.circle(cx,cy,2);t(n,cx-.7,cy+.8,6.7,false,4);if(v.evaluacion?.notas?.[k]===n){pdf.line(cx-1.5,cy-1.5,cx+1.5,cy+1.5);pdf.line(cx+1.5,cy-1.5,cx-1.5,cy+1.5)}}
   y+=alto;
  });
  y+=5;t('Un logro:',x,y,8.5,true);y+=7;pdf.line(x,y,x+ancho,y);y+=7;pdf.line(x,y,x+ancho,y);y+=5;
  t('Una sugerencia amable:',x,y,8.5,true);y+=7;pdf.line(x,y,x+ancho,y);y+=7;pdf.line(x,y,x+ancho,y);y+=6;
  t('Firma: ____________________  Fecha: __________',x,y,8);y+=5;
  t('Puntaje opcional: suma de (nota × peso ÷ 5) = ____ / 100',x,y,7.5);
  if(y>204)throw Error('No se pudo acomodar la ficha en media hoja. Revisa los datos del proyecto.');
  t('Entrega al comité. El PDF no guarda notas en la app.',x,209,7);
 });
 pdf.setProperties({title:'Evaluaciones en papel - Feria STEAM',author:'C.E.R. Claudina Múnera'});return pdf;
}
export async function descargarFormatoJurado(datos){
 const [{jsPDF},regular,bold]=await Promise.all([import('jspdf'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const b64=async url=>{const res=await fetch(url);if(!res.ok)throw Error('No se pudieron cargar las fuentes de impresión.');const blob=await res.blob();return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('No se pudo preparar la impresión.'));r.readAsDataURL(blob)})};
 const [r,b]=await Promise.all([b64(regular.default),b64(bold.default)]);construirFormatoJurado(jsPDF,datos,{regular:r,bold:b}).save('Evaluaciones-Jurado-'+datos.jurado.nombre.replace(/[^\p{L}\p{N}]+/gu,'-')+'.pdf');
}
