import {supabase} from './lib/supabase';

const prefijo='Recuperación de aseo: ';
export const detalleRecuperacion=id=>prefijo+id;
export function origenRecuperacion(p){
  const detalle=(p.tareas||[]).find(t=>t.tipo==='aporte_especial'&&t.detalle?.startsWith(prefijo))?.detalle;
  const id=detalle?.slice(prefijo.length);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')?id:null;
}
export async function cargarParticipacionesAseo(){
  const filas=[];
  for(let desde=0;;desde+=500){
    const{data,error}=await supabase.from('participaciones').select('id,estudiante_id,estado,calificacion,registro_id,registros_aseo!inner(fecha),tareas(tipo,detalle)').order('id').range(desde,desde+499);
    if(error)throw error;
    filas.push(...data);
    if(data.length<500)return filas;
  }
}
export function recuperacionesValidas(filas){
  const porId=new Map(filas.map(p=>[p.id,p])),resultado=new Map();
  for(const p of [...filas].sort((a,b)=>a.registros_aseo.fecha.localeCompare(b.registros_aseo.fecha)||a.id.localeCompare(b.id))){
    const id=origenRecuperacion(p),original=porId.get(id);
    if(original&&['ausente','no_cumplio'].includes(original.estado)&&!origenRecuperacion(original)&&p.estudiante_id===original.estudiante_id&&p.estado==='cumplio'&&p.calificacion!=null&&p.registros_aseo.fecha>original.registros_aseo.fecha&&!resultado.has(id))resultado.set(id,p);
  }
  return resultado;
}
export function notasConRecuperaciones(filas){
  const recuperadas=recuperacionesValidas(filas),usadas=new Set([...recuperadas.values()].map(p=>p.id));
  return filas.filter(p=>!usadas.has(p.id)).map(p=>{
    const recuperacion=recuperadas.get(p.id);
    return {...p,notaEfectiva:recuperacion?recuperacion.calificacion:['ausente','no_cumplio'].includes(p.estado)?2:p.calificacion,recuperacion};
  });
}
