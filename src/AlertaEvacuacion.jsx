import React,{useEffect,useState} from 'react';
import {supabase} from './lib/supabase';
import ActivarNotificaciones from './ActivarNotificaciones';

export default function AlertaEvacuacion({profesor=false}){
  const[alerta,setAlerta]=useState(null),[preparando,setPreparando]=useState(false),[modo,setModo]=useState('simulacro'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[envio,setEnvio]=useState('');

  async function consultar(){
    const{data,error}=await supabase.from('alertas_evacuacion').select('id,modo,activada_at').is('finalizada_at',null).order('activada_at',{ascending:false}).limit(1).maybeSingle();
    if(error){if(profesor)setError('No se pudo consultar el estado de la alerta. Revisa la conexión.');return}
    setAlerta(data||null);setError('');
  }
  useEffect(()=>{
    consultar();const intervalo=window.setInterval(consultar,3000);
    const alVolver=()=>{if(document.visibilityState==='visible')consultar()};
    document.addEventListener('visibilitychange',alVolver);
    return()=>{window.clearInterval(intervalo);document.removeEventListener('visibilitychange',alVolver)};
  },[]);

  async function activar(){
    if(busy)return;setBusy(true);setError('');
    try{
      const{data:{session}}=await supabase.auth.getSession();
      const respuesta=await fetch('/api/emergency',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token||''}`},body:JSON.stringify({modo})});
      const resultado=await respuesta.json();
      if(!respuesta.ok)throw new Error(resultado.error||'No se pudo activar.');
      setAlerta({id:resultado.alertaId,modo,activada_at:new Date().toISOString()});setPreparando(false);
      setEnvio(resultado.errorEnvio?`La alerta está activa. ${resultado.errorEnvio}`:resultado.dispositivos===0?'La alerta está activa. No hay celulares inscritos; usa el timbre.':`Envío solicitado a ${resultado.enviados} de ${resultado.dispositivos} celular(es). ${resultado.fallidos?`${resultado.fallidos} fallaron. `:''}Usa también el timbre.`);
    }catch(error){setError('No se pudo confirmar la activación: '+error.message+'. Comprueba la pantalla y usa el timbre.');await consultar()}
    setBusy(false);
  }
  async function finalizar(){
    if(busy||!alerta||!window.confirm('¿Confirmas que el profesor responsable autorizó finalizar la alerta?'))return;
    setBusy(true);setError('');
    const{data,error}=await supabase.rpc('finalizar_alerta_evacuacion',{alerta_id:alerta.id});
    if(error)setError('No se pudo finalizar: '+error.message);
    else if(data){setAlerta(null);setEnvio('')}
    else{setError('La alerta ya fue finalizada desde otra cuenta.');await consultar()}
    setBusy(false);
  }

  return <>
    {!alerta&&<ActivarNotificaciones/>}
    {profesor&&!alerta&&<div className="emergencyLauncher"><button type="button" onClick={()=>setPreparando(true)}>🚨 Activar evacuación</button></div>}
    {profesor&&preparando&&!alerta&&<div className="emergencyBackdrop" role="presentation"><section className="emergencyDialog" role="dialog" aria-modal="true" aria-labelledby="emergency-title"><h2 id="emergency-title">Activar evacuación</h2><p>La señal presencial es el timbre continuo durante 30 segundos. Claudina Clean muestra la instrucción a quienes tengan la aplicación abierta.</p><fieldset><legend>Tipo de alerta</legend><label><input type="radio" name="tipo-alerta" value="simulacro" checked={modo==='simulacro'} onChange={()=>setModo('simulacro')}/> Simulacro</label><label><input type="radio" name="tipo-alerta" value="real" checked={modo==='real'} onChange={()=>setModo('real')}/> Emergencia real</label></fieldset><div className="emergencyActions"><button type="button" onClick={()=>setPreparando(false)} disabled={busy}>Cancelar</button><button type="button" className="emergencyConfirm" onClick={activar} disabled={busy}>{busy?'Activando…':modo==='real'?'Activar ALERTA ROJA':'Iniciar simulacro'}</button></div>{error&&<p role="alert" className="error">{error}</p>}</section></div>}
    {alerta&&<div className={`emergencyOverlay ${alerta.modo==='simulacro'?'emergencyDrill':''}`} role="alert" aria-live="assertive"><div className="emergencyContent"><span className="emergencyKind">{alerta.modo==='simulacro'?'SIMULACRO DE EVACUACIÓN':'ALERTA ROJA · EVACUACIÓN'}</span><h2>{alerta.modo==='simulacro'?'Practica la evacuación':'Evacúa de inmediato'}</h2><p>Dirígete a la <strong>manga frente al colegio</strong>. Usa la <strong>salida principal</strong> o la <strong>salida de emergencia</strong> siguiendo las indicaciones del profesor.</p><p><strong>Ten precaución al cruzar la calle.</strong> Mantente con tu grupo.</p><p className="emergencyBell">🔔 El timbre continuo durante 30 segundos es la señal de evacuación.</p>{profesor&&<><p className="emergencySendStatus" role="status">{envio}</p><button type="button" className="emergencyFinish" onClick={finalizar} disabled={busy}>{busy?'Finalizando…':'Finalizar alerta'}</button></>}{error&&<p role="alert">{error}</p>}</div></div>}
    {profesor&&error&&!alerta&&!preparando&&<p className="emergencyError" role="alert">{error}</p>}
  </>;
}
