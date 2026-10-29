import {useEffect} from 'react';
import {registerSW} from 'virtual:pwa-register';
import {crearProteccionEdicion} from './protegerEdicion.js';

export default function ActualizarApp(){
 useEffect(()=>{
  let vigente=true,registro=null,ultimaConsulta=0,consultando=false;
  let pendiente=false,requiereRecarga=false,recargando=false,aplicando=false,ultimoIntento=0,temporizador=null;
  let aplicar=null;
  function programar(){
   if(!vigente)return;
   if(temporizador)clearTimeout(temporizador);
   temporizador=setTimeout(intentar,1500);
  }
  const edicion=crearProteccionEdicion(document,programar);
  async function intentar(){
   temporizador=null;
   if(!vigente||recargando||document.visibilityState==='hidden'||edicion.hayEdicion())return;
   if(requiereRecarga){recargando=true;window.location.reload();return}
   if(!pendiente||aplicando||!aplicar||navigator.onLine===false||Date.now()-ultimoIntento<10000)return;
   aplicando=true;ultimoIntento=Date.now();
   try{await aplicar(true)}catch{/* Reintentar sin avisos al recuperar conexión o volver a la app. */}
   finally{aplicando=false}
  }
  async function comprobar(){
   if(!registro||navigator.onLine===false||document.visibilityState==='hidden'||consultando||Date.now()-ultimaConsulta<10000)return;
   ultimaConsulta=Date.now();consultando=true;
   try{await registro.update()}catch{/* La versión actual sigue funcionando sin conexión. */}finally{consultando=false}
  }
  function volver(){comprobar();programar()}
  aplicar=registerSW({immediate:true,
   onNeedRefresh(){pendiente=true;programar()},
   // Sustituye la recarga incondicional de Workbox, también si otra pestaña actualiza.
   onNeedReload(){requiereRecarga=true;programar()},
   onRegisteredSW(_url,r){registro=r;comprobar()},
   onRegisterError(){/* No interrumpir el trabajo por una comprobación fallida. */}
  });
  // Otra pestaña puede activar el worker antes de que este cliente reciba waiting.
  let teniaControl=!!navigator.serviceWorker?.controller;
  function controlador(){if(teniaControl){requiereRecarga=true;programar()}teniaControl=true}
  navigator.serviceWorker?.addEventListener('controllerchange',controlador);
  const intervalo=setInterval(()=>{comprobar();intentar()},60000);
  window.addEventListener('focus',volver);window.addEventListener('online',volver);document.addEventListener('visibilitychange',volver);
  return()=>{vigente=false;clearInterval(intervalo);clearTimeout(temporizador);edicion.destruir();navigator.serviceWorker?.removeEventListener('controllerchange',controlador);window.removeEventListener('focus',volver);window.removeEventListener('online',volver);document.removeEventListener('visibilitychange',volver)};
 },[]);
 return null;
}
