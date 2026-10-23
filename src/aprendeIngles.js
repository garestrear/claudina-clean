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

export function mezclarPalabras(banco=[]){
 const palabras=[...banco];for(let i=palabras.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[palabras[i],palabras[j]]=[palabras[j],palabras[i]]}return palabras;
}
export function palabrasPendientes(banco=[],respuestas={},casillas={},revision=null){
 const normalizar=v=>String(v||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
 const usadas=new Map();for(const[id,valor]of Object.entries(respuestas)){if(casillas[id]?.correcta===true||revision?.[id]===true){const palabra=normalizar(valor);usadas.set(palabra,(usadas.get(palabra)||0)+1)}}
 return banco.flatMap((palabra,indice)=>{const clave=normalizar(palabra),cantidad=usadas.get(clave)||0;if(cantidad){usadas.set(clave,cantidad-1);return []}return [{palabra,indice}]});
}

export function contarPalabrasPendientes(pendientes=[]){
 const grupos=new Map();
 for(const {palabra,indice} of pendientes){const clave=palabra.trim().toLowerCase().replace(/[^a-z0-9]/g,'');if(!grupos.has(clave))grupos.set(clave,{palabra,indice,cantidad:0});grupos.get(clave).cantidad++}
 return [...grupos.values()];
}
