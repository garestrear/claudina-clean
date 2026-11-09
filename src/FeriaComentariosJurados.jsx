import React,{useEffect,useState} from 'react';
import {supabase} from './lib/supabase';

export default function FeriaComentariosJurados({proyecto}){
 const [comentarios,setComentarios]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[intento,setIntento]=useState(0);
 useEffect(()=>{
  let vigente=true;
  setLoading(true);setError('');setComentarios([]);
  supabase.rpc('feria_comentarios_jurados',{proyecto}).then(({data,error})=>{
   if(!vigente)return;
   if(error)setError('No pudimos cargar los comentarios de los jurados.');
   else setComentarios(data||[]);
  }).catch(()=>{if(vigente)setError('No pudimos cargar los comentarios de los jurados.')}).finally(()=>{if(vigente)setLoading(false)});
  return()=>{vigente=false};
 },[proyecto,intento]);
 return <section className="fairHistory" aria-label="Comentarios de los jurados">
  <h3>Comentarios de los jurados</h3>
  {loading?<p role="status">Cargando comentarios…</p>:error?<><p className="error" role="alert">{error}</p><button type="button" onClick={()=>setIntento(i=>i+1)}>Reintentar</button></>:comentarios.length?comentarios.map(c=><article key={c.id}>
   <h4>{c.jurado||'Jurado'}</h4>
   {c.destacado?.trim()&&<div><b>Lo más destacado</b><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.destacado}</p></div>}
   {c.sugerencia?.trim()&&<div><b>Una sugerencia para mejorar</b><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{c.sugerencia}</p></div>}
  </article>):<p>Aún no hay comentarios de evaluaciones enviadas para este proyecto.</p>}
 </section>;
}
