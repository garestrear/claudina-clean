export function textoUbicacion(proyecto){
 const ubicaciones=proyecto?.ubicaciones||[];
 if(!ubicaciones.length)return 'Aula por asignar';
 const nombres=[...new Set(ubicaciones.map(u=>u.espacio_nombre).filter(Boolean))];
 return nombres.length===1?'Aula: '+nombres[0]:'Ubicaciones: '+ubicaciones.map(u=>`${u.espacio_nombre} (${String(u.inicio).slice(0,5)}–${String(u.fin).slice(0,5)})`).join(' · ');
}
