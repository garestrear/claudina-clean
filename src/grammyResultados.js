// Prioridad global por votos; el orden de categoría resuelve igualdad entre premios.
export function repartirPremios(categorias, conteo) {
 const activas = categorias.filter(c => c.habilitada).sort((a,b) => a.orden-b.orden || a.id-b.id);
 const filas = conteo.filter(v => activas.some(c => c.id===v.categoria_id) && Number(v.votos)>0);
 const orden = (a,b) => Number(b.votos)-Number(a.votos) || a.nombre.localeCompare(b.nombre,'es') || String(a.candidato_id).localeCompare(String(b.candidato_id));
 const asignados = new Map(), resultados = new Map();
 let pendientes = [...activas];
 while(pendientes.length) {
  const opciones = pendientes.map(c => ({c, disponibles:filas.filter(v => v.categoria_id===c.id && !asignados.has(v.candidato_id)).sort(orden)}));
  opciones.sort((a,b) => Number(b.disponibles[0]?.votos||0)-Number(a.disponibles[0]?.votos||0) || a.c.orden-b.c.orden || a.c.id-b.c.id);
  const resoluble = opciones.find(({disponibles:d}) => !d.length || d.filter(v=>Number(v.votos)===Number(d[0].votos)).length===1 || Number(d[0].votos)>3);
  if(!resoluble) { pendientes.forEach(c=>resultados.set(c.id,{ganadores:[]})); break; }
  const {c,disponibles} = resoluble;
  const primeros = disponibles.filter(v => Number(v.votos)===Number(disponibles[0]?.votos));
  const empatePendiente = primeros.length>1 && Number(primeros[0].votos)<=3;
  const ganadores = empatePendiente ? [] : primeros;
  ganadores.forEach(v => asignados.set(v.candidato_id,c.id));
  resultados.set(c.id,{ganadores});
  pendientes = pendientes.filter(x => x.id!==c.id);
 }
 // Los nominados perdedores siguen disponibles; solo se excluyen ganadores de otro premio.
 return activas.map(c => {
  const disponibles = filas.filter(v => v.categoria_id===c.id && (!asignados.has(v.candidato_id)||asignados.get(v.candidato_id)===c.id)).sort(orden);
  const ganadores = resultados.get(c.id).ganadores;
  const primeros = disponibles.filter(v => Number(v.votos)===Number(disponibles[0]?.votos));
  return {categoria:c,ganadores,nominados:disponibles.slice(0,3),empatados:ganadores.length?[]:primeros,pendiente:!ganadores.length&&disponibles.length>0};
 });
}
