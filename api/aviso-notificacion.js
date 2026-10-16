import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';

import {endpointConocido} from '../lib/push.js';

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pub=process.env.VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY;
  const subject=process.env.VAPID_SUBJECT;
  if(!url||!secret||!pub||!priv||!subject)return res.status(503).json({error:'El envío de notificaciones no está configurado'});

  const token=req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
  if(!token)return res.status(401).json({error:'Sesión requerida'});
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const{data:{user},error:authError}=await db.auth.getUser(token);
  if(authError||!user)return res.status(401).json({error:'Sesión inválida'});
  const{data:perfil,error:perfilError}=await db.from('perfiles').select('rol').eq('id',user.id).single();
  if(perfilError||perfil?.rol!=='profesor')return res.status(403).json({error:'Solo un profesor puede enviar avisos'});

  const avisoId=req.body?.avisoId;
  if(typeof avisoId!=='string'||!/^[0-9a-f-]{36}$/i.test(avisoId))return res.status(400).json({error:'Aviso inválido'});
  try{webpush.setVapidDetails(subject,pub,priv)}catch{return res.status(503).json({error:'Claves de notificaciones inválidas'})}
  const{data:aviso,error:avisoError}=await db.from('avisos').select('id,titulo,contenido,publicado,grado').eq('id',avisoId).single();
  if(avisoError||!aviso?.publicado||aviso.grado!==null)return res.status(400).json({error:'Selecciona un aviso publicado para todos los grados'});
  const suscripciones=[];
  for(let desde=0;;desde+=500){
    const{data,error}=await db.from('suscripciones_push').select('endpoint,p256dh,auth').range(desde,desde+499);
    if(error)return res.status(503).json({error:'No se pudieron consultar los dispositivos'});
    suscripciones.push(...data);if(data.length<500)break;
  }
  const mensaje=JSON.stringify({type:'aviso',id:aviso.id,title:aviso.titulo.slice(0,120),body:aviso.contenido.slice(0,500),sentAt:Date.now()});
  let enviados=0,fallidos=0;
  for(let i=0;i<suscripciones.length;i+=10){
    await Promise.all(suscripciones.slice(i,i+10).map(async s=>{
      if(!endpointConocido(s.endpoint)){fallidos++;return}
      try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},mensaje,{TTL:86400,urgency:'normal'});enviados++}
      catch(error){fallidos++;if([404,410].includes(error.statusCode))await db.from('suscripciones_push').delete().eq('endpoint',s.endpoint)}
    }));
  }
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({avisoId:aviso.id,dispositivos:suscripciones.length,enviados,fallidos});
}
