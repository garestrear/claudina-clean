export function generarGruposCarrusel(ctx,anterior=null){
 if(ctx.segunda_franja)return generarSegundaFranja(ctx,anterior);
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
export function rondasCarrusel(aulas,grupos,inicio,fin,minutos,maxRotaciones=null){
 const valor=s=>Number(s.slice(0,2))*60+Number(s.slice(3,5)),hora=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 if(!aulas.length||!Number.isInteger(minutos)||minutos<5||minutos>60)return[];
 const rondas=[];for(let t=valor(inicio),i=0;t<valor(fin)&&(maxRotaciones==null||i<maxRotaciones);t+=minutos,i++)rondas.push({inicio:hora(t),fin:hora(Math.min(t+minutos,valor(fin))),visitas:grupos.filter(g=>g.estudiantes_ids.length).map(g=>({grupo:g.numero,aula:aulas[(g.numero-1+i)%aulas.length]}))});return rondas;
}

export function generarSegundaFranja(ctx,anterior=null){
 if(ctx.aulas.length!==5)throw new Error('La segunda franja requiere cinco espacios de visita para formar cinco grupos simultáneos. Revisa la ubicación de los cinco proyectos.');
 const grados=new Map();
 for(const e of ctx.visitantes){const grado=Number(e.grado);if(grado===0)continue;if(!Number.isInteger(grado)||grado<1||grado>8)throw new Error('Revisa el grado de los estudiantes antes de generar la segunda franja.');const clave=grado>=6?6:grado;if(!grados.has(clave))grados.set(clave,[]);grados.get(clave).push(e.id)}
 const bloques=[...grados].map(([grado,ids])=>({grados:[grado],ids}));
 while(bloques.length>5){
  const menores=bloques.filter(b=>!b.grados.includes(6)).sort((a,b)=>a.ids.length-b.ids.length||Math.min(...a.grados)-Math.min(...b.grados));
  const[a,b]=menores;bloques.splice(bloques.indexOf(a),1);bloques.splice(bloques.indexOf(b),1);bloques.push({grados:[...a.grados,...b.grados].sort((x,y)=>x-y),ids:[...a.ids,...b.ids]});
 }
 while(bloques.length<5){const segundo=bloques.find(b=>b.grados.length===1&&b.grados[0]===2&&b.ids.length>1);if(!segundo)throw new Error('No se pueden formar cinco grupos sin dividir otros grados. Revisa los estudiantes disponibles de la segunda franja.');const mitad=segundo.ids.splice(Math.ceil(segundo.ids.length/2));bloques.push({grados:[2],ids:mitad})}
 bloques.sort((a,b)=>Math.min(...a.grados)-Math.min(...b.grados));
 const grupos=bloques.map((b,i)=>({numero:i+1,docente_id:'',estudiantes_ids:b.ids,descripcion:b.grados.includes(6)?'Bachillerato (6°, 7° y 8°)':b.grados.map(g=>g+'°').join(' + ')}));
 const lideres=ctx.aulas.filter(a=>a.requiere_lider).map(a=>({espacio_id:a.id,docente_id:anterior?.lideres?.find(l=>l.espacio_id===a.id)?.docente_id||''}));
 const usados=new Set();for(const rol of [...lideres,...grupos]){const previo=rol.espacio_id?rol.docente_id:anterior?.grupos?.find(g=>g.numero===rol.numero)?.docente_id;rol.docente_id=previo&&!usados.has(previo)&&ctx.docentes.some(d=>d.id===previo)?previo:'';if(rol.docente_id)usados.add(rol.docente_id)}
 return{minutos:20,max_rotaciones:4,segunda_franja:true,lideres,grupos};
}
