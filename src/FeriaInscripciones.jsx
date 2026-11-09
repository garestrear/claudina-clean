import {sondearVisible} from './sondeoVisible.js';
import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
const horaLocal=iso=>iso?new Date(new Date(iso).getTime()-5*3600000).toISOString().slice(0,16):'';
export default function FeriaInscripciones({profesor,onEstado}){
 const inicial=useRef(false);
 const[config,setConfig]=useState(null),[limite,setLimite]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function cargar(){
  try{const{data,error}=await supabase.rpc('feria_inscripciones_estado');if(error)throw error;setConfig(data);if(!inicial.current){setLimite(horaLocal(data.fecha_limite));inicial.current=true;}setError('');onEstado(!data.abierta)}catch(e){setError(e.message);onEstado(true)}
 }
 useEffect(()=>sondearVisible(cargar,{intervalo:120000}),[]);
 useEffect(()=>{if(!config?.abierta||!config.fecha_limite)return;const timer=setInterval(()=>{if(Date.now()>=Date.parse(config.fecha_limite)){setConfig(c=>({...c,abierta:false}));onEstado(true)}},1000);return()=>clearInterval(timer)},[config]);
 async function guardar(cerrada){
  setBusy(true);setError('');
  try{const{data,error}=await supabase.rpc('feria_inscripciones_configurar',{cerrar:cerrada,limite:limite?new Date(limite+':00-05:00').toISOString():null});if(error)throw error;setConfig(data);onEstado(!data.abierta)}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <aside className="fairHint" aria-label="Inscripciones de la feria">
  <p role="status"><b>{config?(config.abierta?'Inscripciones y modificaciones abiertas':'Inscripciones y modificaciones cerradas'):'Consultando plazo de inscripción…'}</b>{config?.fecha_limite&&<> · Fecha límite: {new Date(config.fecha_limite).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</>}</p>
  {config&&!config.abierta&&<p>Los estudiantes y acudientes pueden consultar sus proyectos. Los docentes pueden continuar con la revisión y la logística.</p>}
  {profesor&&<details><summary>Administrar plazo de inscripción</summary><label>Fecha y hora límite (Colombia)<input type="datetime-local" value={limite} onChange={e=>setLimite(e.target.value)} disabled={busy}/></label><p>Al llegar esta fecha se bloquean nuevas inscripciones y cambios de estudiantes y acudientes, incluidos los emprendimientos familiares. Deja la fecha vacía para abrir sin límite.</p><button disabled={busy||!config} onClick={()=>guardar(false)}>Guardar plazo / reabrir</button> <button disabled={busy||!config} onClick={()=>guardar(true)}>Cerrar inscripciones y modificaciones ahora</button></details>}
  {error&&<p role="alert">{profesor?'Activa supabase/feria-cierre-inscripciones.sql en Supabase y vuelve a actualizar. ':'No pudimos consultar el plazo; vuelve a actualizar. '}{profesor&&error}</p>}
 </aside>;
}
