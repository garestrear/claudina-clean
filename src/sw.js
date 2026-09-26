import {precacheAndRoute} from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST);
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});

self.addEventListener('push',event=>{
  let dato={};try{dato=event.data?.json()||{}}catch{return}
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
    if(actual)return actual.focus();
    return self.clients.openWindow('/');
  })());
});
