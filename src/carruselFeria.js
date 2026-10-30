export function generarGruposCarrusel(ctx,anterior=null){
 const grupos=ctx.aulas.map((a,i)=>({numero:i+1,docente_id:'',estudiantes_ids:[]}));
 ctx.visitantes.forEach((e,i)=>{if(grupos.length)grupos[i%grupos.length].estudiantes_ids.push(e.id)});
 const lideres=ctx.aulas.filter(a=>a.requiere_lider).map(a=>({espacio_id:a.id,docente_id:anterior?.lideres?.find(l=>l.espacio_id===a.id)?.docente_id||''}));
 lideres.forEach(l=>{if(!ctx.docentes.some(d=>d.id===l.docente_id))l.docente_id=''});
 const usados=new Set(lideres.map(l=>l.docente_id).filter(Boolean));
 grupos.forEach(g=>{const d=anterior?.grupos?.find(a=>a.numero===g.numero)?.docente_id;if(d&&!usados.has(d)&&ctx.docentes.some(p=>p.id===d)){g.docente_id=d;usados.add(d)}});
 return{minutos:anterior?.minutos||20,lideres,grupos};
}
export function rondasCarrusel(aulas,grupos,inicio,fin,minutos){
 const valor=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5)),hora=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 if(!aulas.length||!Number.isInteger(minutos)||minutos<5||minutos>60)return[];
 const rondas=[];for(let t=valor(inicio),i=0;t<valor(fin);t+=minutos,i++)rondas.push({inicio:hora(t),fin:hora(Math.min(t+minutos,valor(fin))),visitas:grupos.filter(g=>g.estudiantes_ids.length).map(g=>({grupo:g.numero,aula:aulas[(g.numero-1+i)%aulas.length]}))});return rondas;
}
