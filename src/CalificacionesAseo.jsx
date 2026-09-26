import React,{useEffect,useMemo,useState} from 'react';
import {supabase} from './lib/supabase';
import FiltroGrado,{coincideGrado} from './FiltroGrado';

const etiqueta={cumplio:'Cumplió',no_cumplio:'No cumplió',ausente:'Ausente'};
const nota=p=>p.estado==='ausente'||p.estado==='no_cumplio'?2:p.calificacion;
const promedio=items=>items.length?(items.reduce((s,p)=>s+nota(p),0)/items.length).toFixed(2):'—';

async function todasParticipaciones(){
  const filas=[];
  for(let desde=0;;desde+=500){
    const {data,error}=await supabase.from('participaciones').select('estudiante_id,estado,calificacion,registro_id,registros_aseo!inner(fecha)').order('id').range(desde,desde+499);
    if(error)throw error;
    filas.push(...data);
    if(data.length<500)break;
  }
  return filas;
}

export function CalificacionesEstudiante({ficha}){
  const[filas,setFilas]=useState([]),[error,setError]=useState(''),[cargando,setCargando]=useState(true);
  useEffect(()=>{let activo=true;(async()=>{try{
    const datos=(await todasParticipaciones()).filter(p=>p.estudiante_id===ficha.id&&nota(p)!=null).sort((a,b)=>b.registros_aseo.fecha.localeCompare(a.registros_aseo.fecha));
    if(activo)setFilas(datos);
  }catch(e){if(activo)setError(e.message)}finally{if(activo)setCargando(false)}})();return()=>{activo=false}},[ficha.id]);
  return <article className="card"><h3>📈 Mis calificaciones de aseo</h3>{cargando?<p>Cargando notas…</p>:error?<p className="error">No se pudieron cargar las calificaciones: {error}</p>:<><p><b>Promedio: {promedio(filas)}/10</b> · {filas.length} aseo(s) calificado(s)</p>{filas.length?<div className="gradesTableWrap"><table className="gradesTable"><thead><tr><th>Fecha</th><th>Resultado</th><th>Calificación</th></tr></thead><tbody>{filas.map(p=><tr key={p.registro_id}><td>{p.registros_aseo.fecha}</td><td>{etiqueta[p.estado]||'Sin estado'}</td><td><b>{nota(p)??'—'}/10</b></td></tr>)}</tbody></table></div>:<p>Aún no tienes aseos calificados.</p>}</>}</article>;
}

export function ConsolidadoAseo(){
  const[estudiantes,setEstudiantes]=useState([]),[filas,setFilas]=useState([]),[grado,setGrado]=useState('todos'),[desde,setDesde]=useState(''),[hasta,setHasta]=useState(''),[seleccion,setSeleccion]=useState(null),[error,setError]=useState(''),[cargando,setCargando]=useState(true);
  useEffect(()=>{let activo=true;(async()=>{try{const [{data,error:e},datos]=await Promise.all([supabase.from('estudiantes').select('id,nombre,grado,activo').order('nombre'),todasParticipaciones()]);if(e)throw e;if(activo){setEstudiantes(data||[]);setFilas(datos)}}catch(e){if(activo)setError(e.message)}finally{if(activo)setCargando(false)}})();return()=>{activo=false}},[]);
  const filtradas=useMemo(()=>filas.filter(p=>nota(p)!=null&&(!desde||p.registros_aseo.fecha>=desde)&&(!hasta||p.registros_aseo.fecha<=hasta)),[filas,desde,hasta]);
  const visibles=estudiantes.filter(s=>coincideGrado(grado,s.grado));
  const detalle=filtradas.filter(p=>p.estudiante_id===seleccion).sort((a,b)=>b.registros_aseo.fecha.localeCompare(a.registros_aseo.fecha));
  return <section><h2>📈 Consolidado de calificaciones</h2><p>Promedio de las notas oficiales de los aseos registrados. Cada ausencia o incumplimiento cuenta como 2/10.</p><FiltroGrado valor={grado} cambiar={setGrado}/><div className="gradesFilters"><label>Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)}/></label><label>Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></label></div>{error?<p className="error">No se pudo cargar el consolidado: {error}</p>:cargando?<div className="placeholder">Cargando calificaciones…</div>:<><div className="gradesTableWrap"><table className="gradesTable"><thead><tr><th>Estudiante</th><th>Grado</th><th>Aseos</th><th>Cumplió</th><th>No cumplió</th><th>Ausente</th><th>Promedio</th></tr></thead><tbody>{visibles.map(s=>{const ps=filtradas.filter(p=>p.estudiante_id===s.id);return <tr key={s.id} onClick={()=>setSeleccion(s.id)} className="gradesClickable"><td><button onClick={()=>setSeleccion(s.id)}>{s.nombre}</button>{!s.activo?' (retirado)':''}</td><td>{s.grado}°</td><td>{ps.length}</td><td>{ps.filter(p=>p.estado==='cumplio').length}</td><td>{ps.filter(p=>p.estado==='no_cumplio').length}</td><td>{ps.filter(p=>p.estado==='ausente').length}</td><td><b>{promedio(ps)}</b></td></tr>})}</tbody></table></div>{seleccion&&<article className="card"><h3>Detalle: {estudiantes.find(s=>s.id===seleccion)?.nombre}</h3>{detalle.length?<div className="gradesTableWrap"><table className="gradesTable"><thead><tr><th>Fecha</th><th>Resultado</th><th>Calificación</th></tr></thead><tbody>{detalle.map(p=><tr key={p.registro_id}><td>{p.registros_aseo.fecha}</td><td>{etiqueta[p.estado]||'Sin estado'}</td><td>{nota(p)??'—'}/10</td></tr>)}</tbody></table></div>:<p>No hay aseos calificados en este período.</p>}</article>}</>}</section>;
}
