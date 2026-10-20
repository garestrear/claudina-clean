export function agruparCanciones(actividades=[]){
 const grupos=new Map();
 for(const actividad of actividades){
  const clave=actividad.audio||actividad.id;
  if(!grupos.has(clave))grupos.set(clave,{id:clave,titulo:actividad.titulo.split(' · ')[0],actividades:[]});
  grupos.get(clave).actividades.push(actividad);
 }
 return [...grupos.values()];
}
export function estadoPractica(actividad){
 const p=actividad.mi_progreso;
 if(!p)return 'Sin empezar';
 return p.total>0&&p.mejor_aciertos>=p.total?'Completada':'En práctica';
}
