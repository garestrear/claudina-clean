import React,{useEffect,useState} from 'react';
import {supabase} from './lib/supabase';

const bytesClave=clave=>Uint8Array.from(atob((clave.replace(/-/g,'+').replace(/_/g,'/')+'===').slice(0,Math.ceil(clave.length/4)*4)),c=>c.charCodeAt(0));

export default function ActivarNotificaciones(){
  const[estado,setEstado]=useState('comprobando'),[mensaje,setMensaje]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{let vigente=true;(async()=>{
    if(!('serviceWorker'in navigator)||!('PushManager'in window)||!('Notification'in window)){if(vigente)setEstado('incompatible');return}
    try{
      const respuesta=await fetch('/api/push-key');if(!respuesta.ok){if(vigente)setEstado('no_configurado');return}
      const registro=await navigator.serviceWorker.ready,subs=await registro.pushManager.getSubscription();
      const{data:{user}}=await supabase.auth.getUser();
      const{data:guardada}=subs&&user?await supabase.from('suscripciones_push').select('endpoint').eq('endpoint',subs.endpoint).eq('usuario_id',user.id).maybeSingle():{data:null};
      if(vigente)setEstado(guardada&&Notification.permission==='granted'?'activo':'disponible');
    }catch{if(vigente)setEstado('no_configurado')}
  })();return()=>{vigente=false}},[]);
  async function activar(){
    if(busy)return;setBusy(true);setMensaje('');
    try{
      const respuesta=await fetch('/api/push-key'),{publicKey}=await respuesta.json();
      if(!respuesta.ok||!publicKey)throw new Error('El envío de alertas todavía no está configurado.');
      const permiso=await Notification.requestPermission();
      if(permiso!=='granted'){setMensaje('Debes permitir las notificaciones en la configuración del celular.');setBusy(false);return}
      const registro=await navigator.serviceWorker.ready;
      let subs=await registro.pushManager.getSubscription();
      if(subs&&JSON.stringify(subs.options?.applicationServerKey?Array.from(new Uint8Array(subs.options.applicationServerKey)):[])!==JSON.stringify(Array.from(bytesClave(publicKey)))){await subs.unsubscribe();subs=null}
      subs??=await registro.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytesClave(publicKey)});
      const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Ingresa de nuevo a tu cuenta.');
      const dato=subs.toJSON();
      const{error}=await supabase.from('suscripciones_push').upsert({endpoint:dato.endpoint,usuario_id:user.id,p256dh:dato.keys.p256dh,auth:dato.keys.auth,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(error)throw error;
      setEstado('activo');setMensaje('✅ Este celular quedó inscrito para recibir alertas.');
    }catch(error){setMensaje('No se pudieron activar las alertas: '+error.message)}
    setBusy(false);
  }
  if(estado==='no_configurado'||estado==='comprobando')return null;
  return <aside className="pushEnrollment"><b>📱 Alertas de evacuación</b>{estado==='incompatible'?<p>Este navegador no admite avisos al celular. Sigue siempre el timbre y las indicaciones del profesor.</p>:<><p>{estado==='activo'?'Este celular tiene las notificaciones activadas.':'Activa los avisos de Claudina Clean en este celular. En iPhone, añade primero la app a la pantalla de inicio.'}</p><button type="button" disabled={busy} onClick={activar}>{busy?'Activando…':estado==='activo'?'Comprobar suscripción':'Activar avisos en este celular'}</button></>}{mensaje&&<p role="status">{mensaje}</p>}</aside>;
}
