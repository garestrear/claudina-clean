import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {gradoFeria} from './feriaCiencia.js';

export default function FeriaAprobadosEstudiante(){
 const [datos,setDatos]=useState(null),[error,setError]=useState(''),[cargando,setCargando]=useState(true),[buscar,setBuscar]=useState('');
 const turno=useRef(0);
 async function cargar(){
  const n=++turno.current;setCargando(true);setError('');
  try{
   const {data,error:sesionError}=await supabase.auth.getSession();
   if(sesionError||!data?.session?.access_token)throw new Error('Ingresa de nuevo para consultar los proyectos aprobados.');
   const respuesta=await fetch('/api/feria-aprobados',{headers:{Authorization:'Bearer '+data.session.access_token},cache:'no-store'});
   const resultado=await respuesta.json();
   if(!respuesta.ok)throw new Error(resultado.error||'No se pudo consultar la feria.');
   if(n===turno.current)setDatos(resultado);
  }catch(e){if(n===turno.current)setError(e.message)}finally{if(n===turno.current)setCargando(false)}
 }
 useEffect(()=>{cargar();return()=>{turno.current++}},[]);
 const consulta=buscar.trim().toLocaleLowerCase('es');
 const visibles=(datos?.proyectos||[]).filter(p=>[p.titulo,p.integrantes,p.institucion].join(' ').toLocaleLowerCase('es').includes(consulta));
 return <section className="fairStudentExhibition" aria-label="Proyectos presentados y aprobados">
  <h3>Proyectos presentados y aprobados</h3>
  {datos&&<div className="fairOverview"><div><b>{datos.presentados}</b><span>Proyectos presentados</span></div><div><b>{datos.aprobados}</b><span>Proyectos aprobados</span></div></div>}
  <div className="fairListHeading"><div><h4>Proyectos aprobados de la feria</h4><p>Conoce las propuestas y sus integrantes.</p></div><button type="button" onClick={cargar} disabled={cargando}>Actualizar aprobados</button></div>
  {cargando&&!datos&&<p role="status">Consultando proyectos aprobados…</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  {datos&&<><label className="fairApprovedSearch">Buscar proyecto o integrante<input type="search" value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Nombre del proyecto o integrante"/></label><div className="fairGrid">{visibles.map((p,i)=><article className="fairCard" key={i}><h4>{p.titulo}</h4><p className="fairMembers"><b>Integrantes:</b> {p.integrantes||'Sin integrantes indicados.'}</p><small>{p.institucion}{p.grado!=null?' · '+gradoFeria(p.grado):''}</small></article>)}</div>{!visibles.length&&<p className="fairEmpty">{consulta?'No hay proyectos aprobados con esa búsqueda.':'Aún no hay proyectos aprobados para mostrar.'}</p>}</>}
 </section>;
}
