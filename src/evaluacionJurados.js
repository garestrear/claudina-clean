export const categoriasEvaluacion={stem:'Experiencias de ciencia y tecnología',arte:'Arte y Creatividad',emprendimiento:'Emprendimientos',familias:'Emprendimientos de familias',puentes_juvenil:'Puentes juvenil',puentes_infantil:'Puentes infantil'};
export const claveProyecto=p=>`${p.origen}:${p.proyecto_id||p.id}`;
export const minutosHora=h=>Number(h.slice(0,2))*60+Number(h.slice(3,5));
export const horaMinutos=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
export const rubricasAnteriores={
 stem:[['Problema y propósito',15],['Investigación y comprensión',20],['Desarrollo, pruebas y evidencias',25],['Creatividad y pertinencia',20],['Exposición y respuestas',20]],
 arte:[['Intención y concepto',15],['Exploración e investigación',15],['Técnica y proceso creativo',25],['Originalidad y expresión',25],['Presentación y reflexión',20]],
 emprendimiento:[['Necesidad y público',20],['Propuesta de valor',25],['Desarrollo del producto o servicio',20],['Viabilidad y uso de recursos',20],['Presentación y respuestas',15]],
 familias:[['Necesidad y público',20],['Propuesta de valor',25],['Desarrollo del producto o servicio',20],['Viabilidad y uso de recursos',20],['Presentación y respuestas',15]],
 puentes_juvenil:[['Diseño y fundamentos',25],['Construcción y cumplimiento de reglas',25],['Pruebas y evidencias de resistencia',25],['Creatividad y uso de materiales',10],['Exposición y respuestas',15]],
 puentes_infantil:[['Idea y comprensión del puente',20],['Construcción y cuidado',25],['Pruebas y aprendizaje',25],['Creatividad y uso de materiales',15],['Explicación del equipo',15]]
};
export const rubricas={
 stem:[['Comprensión de la experiencia',30],['Realización y funcionamiento',25],['Observación y aprendizaje',20],['Comunicación y participación',15],['Creatividad y aprovechamiento de materiales',10]],
 arte:[['Intención y expresión',25],['Exploración de materiales y técnicas',25],['Realización y cuidado',20],['Creatividad y aporte propio',15],['Comunicación y aprendizaje',15]],
 emprendimiento:[['Identidad del emprendimiento',20],['Producto y utilidad',25],['Costos y precio de venta',25],['Elaboración y aprovechamiento de recursos',15],['Comunicación y aprendizaje',15]],
 familias:[['Necesidad y público',20],['Propuesta de valor',25],['Desarrollo del producto o servicio',20],['Viabilidad y uso de recursos',20],['Presentación y respuestas',15]],
 puentes_juvenil:[['Diseño y fundamentos',25],['Construcción y cumplimiento de reglas',25],['Pruebas y evidencias de resistencia',25],['Creatividad y uso de materiales',10],['Exposición y respuestas',15]],
 puentes_infantil:[['Idea y comprensión del puente',20],['Construcción y cuidado',25],['Pruebas y aprendizaje',25],['Creatividad y uso de materiales',15],['Explicación del equipo',15]]
};
export function puntajeEvaluacion(categoria,notas,version=2){const r=(version===1?rubricasAnteriores:rubricas)[categoria];return r&&notas?.length===5&&notas.every(n=>Number.isInteger(n)&&n>=1&&n<=5)?Math.round(r.reduce((s,[,peso],i)=>s+notas[i]*peso/5,0)*100)/100:null}

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
export function resultadosProyecto(proyecto,visitas,jurados){
 const vs=visitas.filter(v=>claveProyecto(v)===claveProyecto(proyecto));
 const calificaciones=vs.filter(v=>v.evaluacion?.enviada).map(v=>({jurado:jurados.find(j=>j.id===v.jurado_id)?.nombre||'Jurado',puntaje:Number(v.evaluacion.puntaje),manual:Boolean(v.evaluacion.registro_manual)}));
 const notas=calificaciones.map(c=>c.puntaje);
 return {...proyecto,asignadas:vs.length,evaluadas:notas.length,calificaciones,promedio:notas.length?Math.round(notas.reduce((a,b)=>a+b,0)/notas.length*100)/100:null,diferencia:notas.length?Math.max(...notas)-Math.min(...notas):0};
}
export function csvResultados(proyectos){const q=v=>'"'+String(/^[=+@\-\t\r]/.test(String(v??''))?"'"+v:v??'').replaceAll('"','""')+'"';return '\ufeff'+[['Código','Proyecto','Categoría','Evaluaciones','Promedio /100','Estado','Calificaciones de jurados'],...proyectos.map(p=>[p.codigo,p.titulo,categoriasEvaluacion[p.categoria],p.evaluadas,p.promedio??'',p.evaluadas>=3?'Completo':p.evaluadas?'Parcial':'Pendiente',(p.calificaciones||[]).map(c=>`${c.jurado}: ${c.puntaje}/100${c.manual?' (papel)':''}`).join(' | ')])].map(f=>f.map(q).join(';')).join('\r\n')}


export const descripcionesExperiencia=[
 'Explica con sus propias palabras qué hizo, qué ocurrió y una posible razón.',
 'Muestra la experiencia o sus pasos. Si falla, explica qué esperaba observar.',
 'Cuenta qué aprendió, qué le sorprendió o qué cambiaría al repetirla.',
 'Comunica lo principal y participa según sus posibilidades; se respeta el nerviosismo.',
 'Aporta un detalle propio o utiliza ingeniosamente los materiales disponibles.'
];
export const nivelesEvaluacion=[['Primer acercamiento','Necesita bastante acompañamiento para mostrar o explicar lo realizado.'],['En proceso','Reconoce algunos elementos, aunque todavía le cuesta relacionarlos.'],['Logrado','Muestra y explica lo principal de manera acorde a su edad.'],['Muy logrado','Explica con claridad, relaciona lo observado y responde preguntas sencillas.'],['Destacado','Aporta una reflexión, una explicación propia o una posible mejora.']];
export const orientacionesEvaluacion=[
 'Valora la comprensión y el aprendizaje según la edad; no exijas una investigación extensa ni resultados novedosos.',
 'A los pequeños puedes preguntarles qué pasó y qué aprendieron; a los jóvenes, por qué creen que ocurrió y qué cambiarían.',
 'Una explicación sencilla puede ser excelente. No premies la memorización, el costo de los materiales o la ayuda adulta por sí mismos.',
 'No descuentes automáticamente por nervios, lectura o una falla: pueden explicar el proceso, mostrar fotos o contar lo observado antes.',
 'El nivel 3 representa un buen cumplimiento. Para un 5 no se requieren conocimientos universitarios ni materiales costosos.',
 'Cierra con un logro concreto y una sugerencia amable. Los registros de proyectos prolongados son evidencia adicional, no una exigencia para todos.'
];

export const descripcionesRubricas={
 stem:descripcionesExperiencia,
 arte:['Cuenta qué quiso representar, comunicar o hacer sentir.','Reconoce sus materiales y explica qué probó o descubrió.','Muestra dedicación según su edad y los recursos disponibles.','Identifica decisiones propias: colores, formas, personajes o adaptaciones.','Comparte cómo lo hizo, qué disfrutó, qué le costó o qué probaría después.'],
 emprendimiento:['Presenta nombre, logo y eslogan, y explica su relación con lo que ofrece; pueden estar hechos a mano.','Muestra qué ofrece, a quién puede servir y cómo se utiliza o disfruta.','Explica gastos, costo por unidad y precio con cuentas sencillas; distingue ventas y ganancia.','Cuenta cómo elaboró el producto, sus cuidados y el uso de materiales.','Explica su propuesta con sus palabras y cuenta qué aprendió o mejoraría.']
};
