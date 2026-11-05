export function generarGruposCarrusel(ctx,anterior=null){
 const grupos=ctx.aulas.map((a,i)=>({numero:i+1,docente_id:'',estudiantes_ids:[]}));
 // El grado 0 reúne TS y preescolar; primero también es indivisible.
 const porGrado=new Map();
 for(const e of ctx.visitantes){const clave=e.grado==null?'sin-grado':Number(e.grado);if(!porGrado.has(clave))porGrado.set(clave,[]);porGrado.get(clave).push(e.id)}
 const aforos=ctx.aulas.map(a=>Number(a.aforo)).filter(n=>n>0);
 const limite=aforos.length?Math.min(...aforos):Infinity;
 const bloques=[];
 for(const [grado,ids] of porGrado){
  const tamano=grado===0||grado===1?ids.length:grado==='sin-grado'?1:limite;
  for(let i=0;i<ids.length;i+=tamano)bloques.push({grado,ids:ids.slice(i,i+tamano)});
 }
 // Primero los bloques obligatorios y luego los grados más numerosos.
 bloques.sort((a,b)=>Number(b.grado===0||b.grado===1)-Number(a.grado===0||a.grado===1)||b.ids.length-a.ids.length);
 for(const bloque of bloques){
  const destino=grupos.reduce((mejor,g)=>!mejor||g.estudiantes_ids.length<mejor.estudiantes_ids.length?g:mejor,null);
  if(destino)destino.estudiantes_ids.push(...bloque.ids);
 }
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
