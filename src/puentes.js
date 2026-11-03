export const categoriasPuentes={puentes_infantil:'Infantil',puentes_juvenil:'Juvenil'};
export function clasificacionPuentes(puentes,rondas,categoria){
 const filas=puentes.filter(p=>p.categoria===categoria).map(p=>({...p,total:Math.round(rondas.filter(r=>r.puente_id===p.id&&r.resultado==='valida').reduce((s,r)=>s+Number(r.carga_kg),0)*1000)/1000,intentos:rondas.filter(r=>r.puente_id===p.id&&(r.cuenta_intento??r.resultado!=='anulada')).length,mejor:Math.max(0,...rondas.filter(r=>r.puente_id===p.id&&r.resultado==='valida').map(r=>Number(r.carga_kg))),probado:rondas.some(r=>r.puente_id===p.id&&['valida','fallo'].includes(r.resultado))}));
 filas.sort((a,b)=>Number(a.estado==='descalificado')-Number(b.estado==='descalificado')||Number(b.probado)-Number(a.probado)||b.total-a.total||Number(a.masa_g)-Number(b.masa_g)||a.titulo.localeCompare(b.titulo));
 let anterior=null,puesto=0,numero=0;
 return filas.map(p=>{if(!p.probado||p.estado==='descalificado')return {...p,puesto:null};numero++;if(!anterior||p.total!==anterior.total||Number(p.masa_g)!==Number(anterior.masa_g))puesto=numero;anterior=p;return {...p,puesto}});
}
export const segundosPuente=(fin,ahora)=>Math.max(0,Math.ceil((Date.parse(fin)-ahora)/1000));
export function siguienteCarga(config,mejor){return Math.min(mejor>0?mejor+Number(config?.incremento):Number(config?.inicial),Number(config?.limite))}
const csvCell=v=>'"'+String(v??'').replaceAll('"','""').replace(/^[=+@-]/,"'$&")+'"';
export function csvPuentes(datos){
 const filas=[['Categoría','Código','Puente','Integrantes','Masa g','Total válido kg','Intentos consumidos','Mejor carga kg','Puesto provisional','Estado','Motivo descalificación','Ronda','Carga total kg','Resultado','Inicio','Validado por','Motivo']];
 for(const cat of Object.keys(categoriasPuentes))for(const p of clasificacionPuentes(datos.puentes,datos.rondas,cat)){
  const rr=datos.rondas.filter(r=>r.puente_id===p.id);for(const r of rr.length?rr:[{}])filas.push([categoriasPuentes[cat],p.codigo,p.titulo,p.integrantes,p.masa_g,p.total,p.intentos,p.mejor,p.puesto,p.estado,p.estado==='descalificado'?p.motivo_fin:'',r.numero,r.carga_kg,r.resultado,r.inicio,r.validado_por,r.motivo||p.motivo_fin]);
 }
 return '\uFEFF'+filas.map(f=>f.map(csvCell).join(';')).join('\r\n');
}

export function solicitudPuente(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const b=globalThis.crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(n=>n.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-')}

