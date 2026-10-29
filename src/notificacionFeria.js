import {supabase} from './lib/supabase';
// El guardado ya terminó: una falla push nunca revierte ni aparenta perder el trabajo.
export async function notificarCambioFeria({tipo,solicitud}){
 try{
  const{data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token)throw new Error('Sesión no disponible');
  const res=await fetch('/api/feria-notificacion',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({tipo,solicitud}),signal:AbortSignal.timeout(20000)});
  const datos=await res.json();
  if(!res.ok)throw new Error(datos.error||'No fue posible enviar el aviso');
  if(datos.fallidos)return ' Algunos dispositivos no pudieron recibir el aviso; los cambios ya están disponibles en la app.';
  return datos.enviados?' Aviso enviado a los dispositivos activados del equipo y sus acudientes.':datos.duplicada?'':' El equipo y sus acudientes podrán consultarlo en la app; no hay dispositivos con notificaciones activadas.';
 }catch{return ' Los cambios quedaron guardados, pero no se pudo enviar la notificación. El equipo y sus acudientes pueden consultarlos en la app.'}
}
