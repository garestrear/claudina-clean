import {precacheAndRoute} from 'workbox-precaching';
import {clientsClaim} from 'workbox-core';
clientsClaim();
// La app activa las nuevas versiones automáticamente cuando no hay edición pendiente.
// No usar skipWaiting en install: protege los textos abiertos en otros clientes.
// El receptor activo sigue atendiendo push mientras se termina de editar.

precacheAndRoute(self.__WB_MANIFEST);
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});

self.addEventListener('push',event=>{
  let dato={};try{dato=event.data?.json()||{}}catch{return}
  if(dato.type==='feria-actualizada'){
    if(typeof dato.id!=='string'||!/^[0-9a-f-]{36}$/i.test(dato.id)||typeof dato.title!=='string'||!Number.isFinite(dato.sentAt)||Math.abs(Date.now()-dato.sentAt)>86400000)return;
    event.waitUntil(self.registration.showNotification(dato.title,{body:dato.body||'Consulta las sugerencias de tu proyecto.',tag:'feria-'+dato.id,data:{url:'/?proyectoFeria='+encodeURIComponent(dato.id)+(dato.familia?'&familia=1':'')+(dato.acudiente?'&ingreso=acudiente':'')}}));
    return;
  }
  if(dato.type==='evento-evaluacion'){
    if(typeof dato.id!=='string'||typeof dato.title!=='string'||!Number.isFinite(dato.sentAt)||Date.now()-dato.sentAt>86400000)return;
    event.waitUntil(self.registration.showNotification(dato.title,{body:dato.body||'Evalúa el evento',tag:'evento-'+dato.id,data:{url:'/?evaluacion='+encodeURIComponent(dato.id)}}));
    return;
  }
  if(dato.type==='aviso'){
    if(typeof dato.title!=='string'||typeof dato.body!=='string'||!Number.isFinite(dato.sentAt)||Date.now()-dato.sentAt>86400000)return;
    event.waitUntil(self.registration.showNotification(dato.title,{body:dato.body,tag:`aviso-${dato.id}`,data:{url:'/?aviso='+encodeURIComponent(dato.id)}}));
    return;
  }
  if(dato.type!=='evacuacion'||!['real','simulacro'].includes(dato.modo)||Date.now()-Number(dato.sentAt)>60000)return;
  const titulo=dato.modo==='real'?'ALERTA ROJA · EVACUAR':'SIMULACRO · EVACUACIÓN';
  const cuerpo='Sal a la manga frente al colegio por la salida indicada. Precaución al cruzar la calle.';
  event.waitUntil(self.registration.showNotification(titulo,{body:cuerpo,tag:`evacuacion-${dato.id}`,renotify:true,requireInteraction:true,data:{url:'/'}}));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const ventanas=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const actual=ventanas.find(v=>new URL(v.url).origin===self.location.origin);
    const destino=new URL(event.notification.data?.url||'/',self.location.origin);
    if(destino.origin!==self.location.origin)return;
    if(actual){if(destino.searchParams.has('aviso')||destino.searchParams.has('evaluacion')||destino.searchParams.has('proyectoFeria'))await actual.navigate(destino.href);return actual.focus()}
    return self.clients.openWindow(destino.href);
  })());
});
