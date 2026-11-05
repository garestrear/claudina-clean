export function textoUbicacion(proyecto){
 const ubicaciones=proyecto?.ubicaciones||[];
 if(!ubicaciones.length)return 'Aula por asignar';
 const nombres=[...new Set(ubicaciones.map(u=>u.espacio_nombre).filter(Boolean))];
 return nombres.length===1?'Aula: '+nombres[0]:'Ubicaciones: '+ubicaciones.map(u=>`${u.espacio_nombre} (${String(u.inicio).slice(0,5)}–${String(u.fin).slice(0,5)})`).join(' · ');
}

// Ubicación completa en credenciales, sin perder el puesto individual.
export function textoUbicacionEscarapela(persona){
 const ubicaciones=persona?.ubicaciones||[];
 if(!ubicaciones.length)return 'Salón y puesto por asignar';
 return ubicaciones.map(u=>`${u.espacio_nombre||'Salón por asignar'} · ${u.puesto||'Puesto por asignar'}${ubicaciones.length>1?` (${String(u.inicio).slice(0,5)}–${String(u.fin).slice(0,5)})`:''}`).join(' / ');
}
