import React,{useState} from 'react';
import {supabase} from './lib/supabase';
import {descargarMencion} from './documentosParticipantes.js';
export default function FeriaMencionHonor({proyecto,docente=false}){
 const[abierto,setAbierto]=useState(false),[motivo,setMotivo]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[aviso,setAviso]=useState(''),[confirmado,setConfirmado]=useState(false);
 if(!docente)return null;
 async function generar(borrador){
  if(busy||(!borrador&&!confirmado))return;
  setBusy(true);setError('');setAviso('');
  try{
   const r=await supabase.rpc('feria_firmantes_contexto');if(r.error)throw r.error;
   await descargarMencion(proyecto,{motivo,firmantes:r.data?.firmantes,borrador});
   setAviso(borrador?'Vista previa descargada.':'Mención de honor descargada. Puedes imprimirla o compartir el PDF.');
  }catch(e){setError('No se pudo generar la mención: '+(e.message||'Revisa tu conexión y vuelve a intentar.'))}finally{setBusy(false)}
 }
 return <section className="fairProjectCredentials"><button type="button" aria-expanded={abierto} onClick={()=>setAbierto(v=>!v)}>Mención de honor</button>{abierto&&<div className="fairParticipantForm"><h4>Reconocer este proyecto destacado</h4><p>Cualquier docente puede otorgar esta mención según su criterio, independientemente de las notas o del puesto. Se genera un certificado para el proyecto y su equipo.</p><p>Usa las firmas guardadas en Participantes y certificados. El PDF se descarga para imprimir o compartir.</p><label>Motivo del reconocimiento (opcional)<textarea rows={3} maxLength={300} value={motivo} disabled={busy} onChange={e=>{setMotivo(e.target.value);setConfirmado(false)}} placeholder="Por su creatividad, investigación y trabajo en equipo…"/></label><label className="fairParticipantCheckbox"><input type="checkbox" checked={confirmado} disabled={busy} onChange={e=>setConfirmado(e.target.checked)}/>Considero que este proyecto es destacado y le otorgo mención de honor.</label><div className="fairParticipantActions"><button type="button" disabled={busy} onClick={()=>generar(true)}>Vista previa de la mención</button><button type="button" className="fairPrimary" disabled={busy||!confirmado} onClick={()=>generar(false)}>{busy?'Generando…':'Generar mención de honor PDF'}</button></div>{error&&<p role="alert" className="error">{error}</p>}{aviso&&<p role="status">{aviso}</p>}</div>}</section>;
}
