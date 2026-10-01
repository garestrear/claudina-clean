import React,{useEffect,useRef,useState} from 'react';
import {registerSW} from 'virtual:pwa-register';

export default function ActualizarApp(){
 const[disponible,setDisponible]=useState(false),[actualizando,setActualizando]=useState(false),[error,setError]=useState('');
 const aplicar=useRef(null);
 useEffect(()=>{
  let vigente=true,registro=null,ultimaConsulta=0,consultando=false;
  async function comprobar(){
   if(!registro||!navigator.onLine||document.visibilityState==='hidden'||consultando||Date.now()-ultimaConsulta<10000)return;
   ultimaConsulta=Date.now();consultando=true;
   try{await registro.update()}catch{/* Se vuelve a comprobar al recuperar la conexión. */}finally{consultando=false}
  }
  aplicar.current=registerSW({immediate:true,
   onNeedRefresh(){if(vigente)setDisponible(true)},
   onRegisteredSW(_url,r){registro=r;comprobar()},
   onRegisterError(){if(vigente)setError('')}
  });
  const intervalo=setInterval(comprobar,60000);
  window.addEventListener('focus',comprobar);window.addEventListener('online',comprobar);document.addEventListener('visibilitychange',comprobar);
  return()=>{vigente=false;clearInterval(intervalo);window.removeEventListener('focus',comprobar);window.removeEventListener('online',comprobar);document.removeEventListener('visibilitychange',comprobar)};
 },[]);
 async function actualizar(){if(actualizando)return;setActualizando(true);setError('');try{await aplicar.current?.(true)}catch{setError('No se pudo actualizar. Comprueba tu conexión e inténtalo de nuevo.');setActualizando(false)}}
 if(!disponible)return null;
 return <aside role="status" className="appUpdateNotice"><div><b>✨ Hay una nueva versión de Claudina App</b><p>Guarda cualquier registro pendiente y luego actualiza. Tu cuenta y tus registros guardados se conservan.</p>{error&&<p>{error}</p>}</div><button type="button" disabled={actualizando} onClick={actualizar}>{actualizando?'Actualizando…':'Actualizar app'}</button></aside>;
}
