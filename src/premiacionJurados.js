import {categoriasEvaluacion,claveProyecto} from './evaluacionJurados.js';
export function clasificacionPremiacion(resultados){
 return Object.entries(categoriasEvaluacion).filter(([id])=>id!=='familias').map(([categoria,nombre])=>{
  const proyectos=resultados.filter(p=>p.categoria===categoria&&p.origen==='claudina'&&!/^\[Emprendimiento familiar\]/i.test(p.titulo||''));
  const ordenados=proyectos.filter(p=>typeof p.promedio==='number'&&Number.isFinite(p.promedio)).slice().sort((a,b)=>b.promedio-a.promedio||String(a.titulo).localeCompare(String(b.titulo),'es')||claveProyecto(a).localeCompare(claveProyecto(b)));
  let puesto=0;
  const clasificados=ordenados.map((p,i)=>{if(i===0||p.promedio!==ordenados[i-1].promedio)puesto=i+1;return {...p,puesto,empate:ordenados.filter(o=>o.promedio===p.promedio).length>1}}).filter(p=>p.puesto<=5);
  return {categoria,nombre,clasificados,sinNota:proyectos.length-ordenados.length,total:proyectos.length};
 }).filter(c=>c.total>0);
}

// Cada estudiante se cuenta una vez, en el proyecto con su mejor promedio.
export function estudiantesPremiacion(resultados, participantes){
 const equipos=new Map();
 for(const persona of participantes){
  if(persona.tipo!=='expositor'||persona.proyecto_origen!=='claudina'||!persona.estudiante_id||!persona.activo||!persona.habilitado)continue;
  const clave=claveProyecto({origen:persona.proyecto_origen,proyecto_id:persona.proyecto_id});
  const equipo=equipos.get(clave)||[];
  equipo.push(persona);
  equipos.set(clave,equipo);
 }
 const orden=(a,b)=>a.localeCompare(b,'es',{sensitivity:'base'});
 const proyectos=resultados.filter(p=>p.origen==='claudina'&&p.categoria!=='familias'&&!/^\[Emprendimiento familiar\]/i.test(p.titulo||'')&&Number.isFinite(p.promedio));
 proyectos.sort((a,b)=>b.promedio-a.promedio||orden(a.titulo,b.titulo)||claveProyecto(a).localeCompare(claveProyecto(b)));
 const vistos=new Set(), estudiantes=[], sinEquipo=[];
 for(const proyecto of proyectos){
  const equipo=equipos.get(claveProyecto(proyecto))||[];
  if(!equipo.length)sinEquipo.push(proyecto.titulo);
  equipo.sort((a,b)=>orden(a.nombre,b.nombre)||a.estudiante_id.localeCompare(b.estudiante_id));
  for(const persona of equipo){
   if(vistos.has(persona.estudiante_id))continue;
   vistos.add(persona.estudiante_id);
   estudiantes.push({persona,proyecto});
  }
 }
 return {estudiantes:estudiantes.slice(0,30),sinEquipo,empateCorte:estudiantes.length>30&&estudiantes[29].proyecto.promedio===estudiantes[30].proyecto.promedio};
}
