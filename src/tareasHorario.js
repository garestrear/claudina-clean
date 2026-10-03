import {materiasEscolares} from './materias.js';
const grupoGrado=grado=>Number(grado)===7||Number(grado)===8?'7-8':String(grado);
export function tareasParaHorario(tareas,{grupo,profesor='',desde,hasta=desde,base=[],cambios=[]}){
 return tareas.filter(t=>t.fecha_evento&&t.fecha_evento>=desde&&t.fecha_evento<=hasta).filter(t=>{
  if(!profesor)return t.grado==null||grupoGrado(t.grado)===grupo;
  const materia=materiasEscolares.find(m=>t.titulo.startsWith(m+' · '));
  if(!materia)return false;
  const grupos=t.grado==null?['6','7-8']:[grupoGrado(t.grado)];
  return grupos.some(g=>{
   const especiales=cambios.filter(c=>c.fecha===t.fecha_evento&&c.grupo===g&&!c.cancelada&&c.materia===materia);
   const responsables=especiales.length?especiales:base.filter(c=>c.grupo===g&&c.materia===materia);
   return responsables.some(c=>c.profesor?.trim()===profesor);
  });
 }).sort((a,b)=>a.fecha_evento.localeCompare(b.fecha_evento)||a.titulo.localeCompare(b.titulo,'es'));
}
