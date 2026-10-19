import {incluyeGrupo} from './GruposDocente';
const desde=()=>new Date(Date.now()-90*86400000).toISOString().slice(0,10);
const conClave=(tipo,filas)=>(filas||[]).map((r,i)=>({...r,id:tipo+':'+(r.id??i)}));
export async function cargarNovedades(db,{rol,id,ficha,grupos}){
 const resultado={};const trabajos=[];
 const consulta=async q=>{const{data,error}=await q;if(error)throw error;return data};
 const rpc=n=>consulta(db.rpc(n));
 const guardar=(seccion,fn,silencioso=false)=>trabajos.push((async()=>{try{resultado[seccion]={filas:await fn(),silencioso}}catch{/* Un módulo ausente o sin permiso conserva su último indicador. */}})());
 const propio=rol==='estudiante';const docente=rol==='profesor';
 const delGrupo=grado=>!docente||incluyeGrupo(grupos,grado);
 guardar('eventos',async()=>{const filas=await rpc('eventos_listar');return filas.filter(e=>docente?e.grados?.some(delGrupo):e.estado==='abierto'&&!e.respondido)});
 guardar('convivencia',async()=>(await rpc('convivencia_listar')).filter(c=>delGrupo(c.grado)));
 guardar('feria',async()=>{const internos=(await rpc('feria_contexto')).proyectos;let externos=[];if(docente)try{externos=await rpc('feria_externa_contexto')}catch{}return[...conClave('interno',internos),...conClave('externo',externos)]});
 if(rol!=='acudiente')guardar('ingles',async()=>{const filas=await rpc('ingles_contexto');return filas.filter(a=>!docente||a.grados?.some(delGrupo)).map(({mi_progreso,...a})=>a)});
 if(rol==='acudiente'){
  const contexto=consulta(db.rpc('acudiente_contexto'));
  guardar('avisos',async()=>{const d=await contexto;return [...conClave('aviso',d.avisos),...conClave('mensaje',d.mensajes)]});
  guardar('aseo',async()=>conClave('aseo',(await contexto).participaciones),true);
  guardar('horario',async()=>{const d=await contexto;return [...conClave('base',d.horario_base),...conClave('cambio',d.horario_cambios)]},true);
  guardar('reportes',async()=>conClave('reporte',(await contexto).reportes),true);
  guardar('encuestas',async()=>{const d=await rpc('acudiente_encuestas');return conClave('encuesta',d.encuestas)});
 }else{
  guardar('encuestas',async()=>{const filas=await rpc('encuestas_listar');return filas.filter(e=>(!docente||e.grados_participantes?.some(delGrupo))&&(docente||e.estado==='abierta'||e.resultados_publicados))});
  if(!propio||ficha){
   const grado=ficha?.grado,grupo=[7,8].includes(grado)?'7-8':String(grado);
   guardar(docente?'avisos':'inicio',async()=>{
    let q=db.from('avisos').select('id,tipo,titulo,contenido,grado,fecha_evento,foto_path,publicado').order('created_at',{ascending:false}).limit(100);
    if(propio)q=q.eq('publicado',true).or('grado.is.null,grado.eq.'+grado);
    const [avisos,mensajes]=await Promise.all([consulta(q),consulta(db.from('mensajes_estudiantes').select('id,titulo,contenido,estado').in('estado',docente?['pendiente','aprobado','oculto']:['aprobado']).order('created_at',{ascending:false}).limit(100))]);
    return [...conClave('aviso',avisos.filter(a=>delGrupo(a.grado))),...conClave('mensaje',mensajes),];
   });
   guardar('horario',async()=>{let b=db.from('horario_base').select('*'),c=db.from('horario_cambios').select('*').gte('fecha',desde());if(propio){b=b.eq('grupo',grupo);c=c.eq('grupo',grupo)}else{b=b.in('grupo',grupos);c=c.in('grupo',grupos)}const [base,cambios]=await Promise.all([consulta(b),consulta(c)]);return [...conClave('base',base),...conClave('cambio',cambios)]},true);
   const aseo=(async()=>{let q=db.from('participaciones').select('id,estudiante_id,estado,calificacion,registro_id,registros_aseo!inner(id,fecha,grupo,observaciones),tareas(tipo,detalle,realizada)').gte('registros_aseo.fecha',desde()).limit(1000);if(propio)q=q.eq('estudiante_id',ficha.id);const filas=await consulta(q);return filas.filter(p=>!docente||incluyeGrupo(grupos,p.registros_aseo.grupo))})();
   if(docente){guardar('hoy',()=>aseo,true);guardar('consolidado',()=>aseo,true);guardar('historial',()=>aseo,true)}
   else{guardar('calificaciones',()=>aseo,true);guardar('evidencias',async()=>consulta(db.from('evidencias_aseo_estudiante').select('id,fecha,path').eq('estudiante_id',ficha.id).gte('fecha',desde())),true);guardar('valoraciones',async()=>consulta(db.from('registros_aseo').select('id,fecha,grupo,observaciones').eq('grupo',grupo).gte('fecha',desde())),true)}
  }
  if(docente){
   const alumnos=consulta(db.from('estudiantes').select('id,nombre,grado,activo,email,auth_user_id').order('id').limit(1000));
   guardar('estudiantes',async()=>(await alumnos).filter(s=>delGrupo(s.grado)),true);
   guardar('asignacion',async()=>{const [filas,estudiantes]=await Promise.all([consulta(db.from('asignaciones').select('id,estudiante_id,dia').limit(1000)),alumnos]);const ids=new Set(estudiantes.filter(s=>delGrupo(s.grado)).map(s=>s.id));return filas.filter(f=>ids.has(f.estudiante_id))},true);
   guardar('profesores',async()=>consulta(db.from('perfiles').select('id,nombre,rol').eq('rol','profesor')),true);
   guardar('reportes',async()=>{const [filas,estudiantes]=await Promise.all([consulta(db.from('reportes').select('id,autor,tipo,descripcion,estado').order('created_at',{ascending:false}).limit(100)),alumnos]);const ids=new Set(estudiantes.filter(s=>delGrupo(s.grado)).map(s=>s.auth_user_id));return filas.filter(f=>ids.has(f.autor))});
  }
 }
 await Promise.all(trabajos);return resultado;
}
