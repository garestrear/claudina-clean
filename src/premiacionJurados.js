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
