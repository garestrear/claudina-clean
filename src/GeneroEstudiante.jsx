import React,{useState} from 'react';
import {supabase} from './lib/supabase';
export const referenciaFamiliar=estudiante=>estudiante?.genero==='F'?'hija':estudiante?.genero==='M'?'hijo':'estudiante';
export default function GeneroEstudiante({estudiante,onGuardar,ocultarDefinido=false}){
 const[guardando,setGuardando]=useState(false),[error,setError]=useState('');
 async function guardar(valor){if(guardando)return;setGuardando(true);setError('');try{
  const{error}=await supabase.rpc('estudiante_genero',{ficha:estudiante.id,valor:valor||null});if(error)throw error;
  onGuardar?.(valor||null);
 }catch(e){setError('No se pudo guardar el género: '+e.message)}finally{setGuardando(false)}}
 if(ocultarDefinido&&['M','F','NB'].includes(estudiante.genero))return null;
 return <label>Género<select aria-label={`Género de ${estudiante.nombre}`} value={estudiante.genero||''} disabled={guardando} onChange={e=>guardar(e.target.value)}><option value="">Sin seleccionar</option><option value="M">M — Masculino</option><option value="F">F — Femenino</option><option value="NB">NB — No binario</option></select>{guardando&&<small role="status">Guardando…</small>}{error&&<small className="error" role="status">{error}</small>}</label>;
}
