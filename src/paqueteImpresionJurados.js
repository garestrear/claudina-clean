import {construirCartaJurado,cargarRecursosCarta} from './cartaJurado.js';
import {datosFormatoJurado,construirFormatosJurados} from './formatoEvaluacionJurado.js';
export function prepararPaqueteJurados(ctx,{modo='todo',passwordInicial='',passwords={},url='https://claudina-clean.vercel.app/?ingreso=jurado'}={}){
 if(!ctx?.docente)throw Error('Solo docentes pueden descargar el paquete de impresión.');
 if(!['todo','cartas','fichas'].includes(modo))throw Error('Selecciona qué deseas imprimir.');
 const jurados=(ctx.jurados||[]).filter(j=>j.habilitado&&!j.eliminado_en).slice().sort((a,b)=>a.nombre.localeCompare(b.nombre,'es'));
 if(!jurados.length)throw Error('No hay jurados activos para imprimir.');
 const cartas=[],fichas=[];
 for(const j of jurados){
  const visitas=(ctx.visitas||[]).filter(v=>v.jurado_id===j.id).slice().sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||String(a.inicio).localeCompare(String(b.inicio)));
  if(modo!=='fichas'){
   const sinAcceso=!j.usuario||!j.cuenta_id,clave=j.cambiar_password&&!sinAcceso?(passwords[j.id]||passwordInicial):'';
   if(j.cambiar_password&&!sinAcceso&&(clave.length<6||clave.length>128))throw Error('Escribe la contraseña inicial de '+j.nombre+'.');
   cartas.push({jurado:j,recorrido:{visitas,proyectos:ctx.proyectos||[],url,sinAcceso,passwordInicial:clave}});
  }
  if(modo!=='cartas'&&visitas.length)fichas.push(datosFormatoJurado(ctx,j.id));
 }
 if(modo==='fichas'&&!fichas.length)throw Error('No hay proyectos asignados para imprimir fichas.');
 return {modo,cartas,fichas,jurados:jurados.length,totalFichas:fichas.reduce((n,d)=>n+d.visitas.length,0)};
}
export function construirPaqueteJurados(jsPDF,paquete,recursos={}){
 let pdf=null;
 for(const c of paquete.cartas)pdf=construirCartaJurado(jsPDF,c.jurado,{...recursos,recorrido:c.recorrido,pdf});
 if(paquete.fichas.length)pdf=construirFormatosJurados(jsPDF,paquete.fichas,{regular:recursos.fuenteRegular,bold:recursos.fuenteNegrita},pdf);
 if(!pdf)throw Error('No hay documentos para imprimir.');
 pdf.setProperties({title:'Cartas y fichas de jurados - Feria STEAM 2026',author:'C.E.R. Claudina Múnera'});return pdf;
}
export async function descargarPaqueteJurados(paquete){const {jsPDF,recursos}=await cargarRecursosCarta();construirPaqueteJurados(jsPDF,paquete,recursos).save('Impresion-Jurados-Feria-STEAM-2026.pdf')}
