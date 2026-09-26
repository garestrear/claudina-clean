import {supabase} from './lib/supabase';

export const fechaBogota=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

export const nombresTareas={barrer:'🧹 Barrer',trapear:'🪣 Trapear',basura:'🗑️ Botar basura',puestos:'🪑 Ordenar puestos',tablero:'🧽 Borrar tablero',tv:'📺 Apagar TV'};

// Busca hacia atrás hasta encontrar el último aseo con una tarea realizada por cada estudiante.
export async function ultimasActividades(estudiantes,antesDe=fechaBogota()){
  const ids=[...new Set(estudiantes)].filter(Boolean), resultado={};
  if(!ids.length)return resultado;
  for(let desde=0;Object.keys(resultado).length<ids.length;desde+=100){
    const{data:registros,error:re}=await supabase.from('registros_aseo').select('id,fecha').lt('fecha',antesDe).order('fecha',{ascending:false}).range(desde,desde+99);
    if(re)throw re;
    if(!registros?.length)break;
    const pendientes=ids.filter(id=>!resultado[id]);
    const{data:participaciones,error:pe}=await supabase.from('participaciones').select('estudiante_id,registro_id,tareas(tipo,realizada)').eq('estado','cumplio').in('estudiante_id',pendientes).in('registro_id',registros.map(r=>r.id));
    if(pe)throw pe;
    const porRegistro=Object.fromEntries(registros.map(r=>[r.id,r.fecha]));
    for(const p of (participaciones||[]).sort((a,b)=>porRegistro[b.registro_id].localeCompare(porRegistro[a.registro_id]))){
      if(resultado[p.estudiante_id])continue;
      const tipos=[...new Set((p.tareas||[]).filter(t=>t.realizada&&nombresTareas[t.tipo]).map(t=>t.tipo))];
      if(tipos.length)resultado[p.estudiante_id]={fecha:porRegistro[p.registro_id],tipos};
    }
    if(registros.length<100)break;
  }
  return resultado;
}
