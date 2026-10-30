export const categoriasEvaluacion={stem:'Ciencia y Tecnología',arte:'Arte y Creatividad',emprendimiento:'Emprendimientos',familias:'Emprendimientos de familias',puentes_juvenil:'Puentes juvenil',puentes_infantil:'Puentes infantil'};
export const claveProyecto=p=>`${p.origen}:${p.proyecto_id||p.id}`;
export const minutosHora=h=>Number(h.slice(0,2))*60+Number(h.slice(3,5));
export const horaMinutos=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export const rubricas={
 stem:[['Problema y propósito',15],['Investigación y comprensión',20],['Desarrollo, pruebas y evidencias',25],['Creatividad y pertinencia',20],['Exposición y respuestas',20]],
 arte:[['Intención y concepto',15],['Exploración e investigación',15],['Técnica y proceso creativo',25],['Originalidad y expresión',25],['Presentación y reflexión',20]],
 emprendimiento:[['Necesidad y público',20],['Propuesta de valor',25],['Desarrollo del producto o servicio',20],['Viabilidad y uso de recursos',20],['Presentación y respuestas',15]],
 familias:[['Necesidad y público',20],['Propuesta de valor',25],['Desarrollo del producto o servicio',20],['Viabilidad y uso de recursos',20],['Presentación y respuestas',15]],
 puentes_juvenil:[['Diseño y fundamentos',25],['Construcción y cumplimiento de reglas',25],['Pruebas y evidencias de resistencia',25],['Creatividad y uso de materiales',10],['Exposición y respuestas',15]],
 puentes_infantil:[['Idea y comprensión del puente',20],['Construcción y cuidado',25],['Pruebas y aprendizaje',25],['Creatividad y uso de materiales',15],['Explicación del equipo',15]]
};
export function puntajeEvaluacion(categoria,notas){const r=rubricas[categoria];return r&&notas?.length===5&&notas.every(n=>Number.isInteger(n)&&n>=1&&n<=5)?Math.round(r.reduce((s,[,peso],i)=>s+notas[i]*peso/5,0)*100)/100:null}

// Flujo máximo: tres personas diferentes por proyecto, carga mínima viable y
// exclusión de asesores/conflictos. No modifica los datos de origen.
function asignar(proyectos,jurados,capacidad){
 const n=proyectos.length,m=jurados.length,fin=n+m+1,g=Array.from({length:fin+1},()=>[]);
 const add=(u,v,c)=>{const a={v,c,rev:g[v].length},b={v:u,c:0,rev:g[u].length};g[u].push(a);g[v].push(b);return a};
 const enlaces=[];
 proyectos.forEach((p,i)=>{add(0,i+1,3);jurados.map((j,k)=>({j,k,afinidad:(p.areas||[]).filter(a=>j.areas?.includes(a)).length})).sort((a,b)=>b.afinidad-a.afinidad||a.k-b.k).forEach(({j,k})=>{
  if((p.asesor_id&&j.usuario_id===p.asesor_id)||(p.autor_id&&j.usuario_id===p.autor_id)||j.conflictos?.includes(claveProyecto(p)))return;
  enlaces.push({i,k,arco:add(i+1,n+k+1,1)});
 })});
 jurados.forEach((_,k)=>add(n+k+1,fin,capacidad));let flujo=0;
 for(;;){const padres=Array(fin+1).fill(null),cola=[0];padres[0]=[-1,-1];for(let t=0;t<cola.length&&!padres[fin];t++){const u=cola[t];g[u].forEach((a,k)=>{if(a.c&&!padres[a.v]){padres[a.v]=[u,k];cola.push(a.v)}})}if(!padres[fin])break;for(let v=fin;v;){const[u,k]=padres[v],a=g[u][k];a.c--;g[v][a.rev].c++;v=u}flujo++}
 return flujo===n*3?enlaces.filter(e=>e.arco.c===0).map(({i,k})=>({i,k})):null;
}
export function generarRecorrido(proyectos,jurados,{fecha,inicio='08:00',fin='10:00'}={}){
 const desde=minutosHora(inicio),hasta=minutosHora(fin);
 if(!fecha||!Number.isFinite(desde)||!Number.isFinite(hasta)||hasta-desde>120||hasta-desde<110)throw Error('Selecciona una franja de 110 a 120 minutos.');
 if(!proyectos.length)throw Error('No hay proyectos aprobados para evaluar.');
 if(jurados.length<3||jurados.length*10<proyectos.length*3)throw Error(`Se necesitan al menos ${Math.max(3,Math.ceil(proyectos.length*3/10))} jurados habilitados.`);
 for(const p of proyectos)if(!(p.ubicaciones||[]).some(u=>u.fecha===fecha&&minutosHora(u.inicio)<=desde&&minutosHora(u.fin)>=desde+110))throw Error(`Amplía la reserva de «${p.titulo}» para cubrir las diez rondas de evaluación (${inicio}–${horaMinutos(desde+110)}).`);
 let pares=null;for(let cap=Math.max(3,Math.ceil(proyectos.length*3/jurados.length));cap<=10&&!pares;cap++)pares=asignar(proyectos,jurados,cap);
 if(!pares)throw Error('No es posible asignar tres jurados por proyecto con los conflictos actuales. Habilita más jurados o revisa las exclusiones.');
 // Un grafo bipartito de grado máximo D se completa a D-regular y se
 // descompone en D emparejamientos: garantiza ausencia de cruces, sin azar.
 const N=Math.max(proyectos.length,jurados.length),mat=Array.from({length:N},()=>Array(N).fill(0));
 pares.forEach(({i,k})=>mat[i][k]++);const reales=mat.map(f=>[...f]);
 const D=Math.max(...Array.from({length:N},(_,k)=>mat.reduce((s,f)=>s+f[k],0)),3);
 const faltaI=mat.map(f=>D-f.reduce((s,v)=>s+v,0)),faltaK=Array.from({length:N},(_,k)=>D-mat.reduce((s,f)=>s+f[k],0));
 for(let i=0,k=0;i<N;i++)while(faltaI[i]){while(!faltaK[k])k++;const v=Math.min(faltaI[i],faltaK[k]);mat[i][k]+=v;faltaI[i]-=v;faltaK[k]-=v}
 const visitas=[];
 for(let ronda=0;ronda<D;ronda++){
  const match=Array(N).fill(-1);
  function buscar(i,vistos){for(let k=0;k<N;k++)if(mat[i][k]&&!vistos[k]){vistos[k]=true;if(match[k]===-1||buscar(match[k],vistos)){match[k]=i;return true}}return false}
  for(let i=0;i<N;i++)if(!buscar(i,Array(N).fill(false)))throw Error('No se pudo ordenar el recorrido.');
  match.forEach((i,k)=>{mat[i][k]--;if(reales[i][k]){reales[i][k]--;visitas.push({origen:proyectos[i].origen,proyecto_id:proyectos[i].id,jurado_id:jurados[k].id,ronda,inicio:horaMinutos(desde+ronda*11),fin:horaMinutos(desde+ronda*11+10),fecha})}});
 }
 return visitas.sort((a,b)=>a.ronda-b.ronda||a.jurado_id.localeCompare(b.jurado_id));
}
export function csvResultados(proyectos){const q=v=>'"'+String(/^[=+@\-\t\r]/.test(String(v??''))?"'"+v:v??'').replaceAll('"','""')+'"';return '\ufeff'+[['Código','Proyecto','Categoría','Evaluaciones','Promedio /100','Estado'],...proyectos.map(p=>[p.codigo,p.titulo,categoriasEvaluacion[p.categoria],p.evaluadas,p.evaluadas===3?p.promedio:'',p.evaluadas===3?'Completo':'Pendiente'])].map(f=>f.map(q).join(';')).join('\r\n')}
