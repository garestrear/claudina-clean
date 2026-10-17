import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {endpointConocido} from '../lib/push.js';

export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL,secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const pub=process.env.VAPID_PUBLIC_KEY,priv=process.env.VAPID_PRIVATE_KEY,subject=process.env.VAPID_SUBJECT;
 if(!url||!secret||!pub||!priv||!subject)return res.status(503).json({error:'Notificaciones no configuradas'});
 const token=req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)return res.status(401).json({error:'Sesión requerida'});
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await db.auth.getUser(token);
 if(authError||!user)return res.status(401).json({error:'Sesión inválida'});
 const {data:perfil}=await db.from('perfiles').select('rol').eq('id',user.id).maybeSingle();
 if(perfil?.rol!=='profesor')return res.status(403).json({error:'Solo docentes'});
 const id=req.body?.eventoId;
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return res.status(400).json({error:'Evento inválido'});
 const {data:evento,error:ee}=await db.from('eventos_evaluables').select('id,titulo,estado,grados,roles').eq('id',id).maybeSingle();
 if(ee||evento?.estado!=='abierto')return res.status(400).json({error:'La evaluación debe estar abierta'});
 if(req.body?.modo==='diagnostico'){
  const {count,error}=await db.from('suscripciones_push').select('endpoint',{count:'exact',head:true}).eq('usuario_id',user.id);
  if(error)return res.status(503).json({error:'No se pudieron consultar los dispositivos de tu cuenta'});
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({diagnostico:true,docentesIncluidos:evento.roles.includes('profesor'),dispositivosCuenta:count});
 }
 try{webpush.setVapidDetails(subject,pub,priv)}catch{return res.status(503).json({error:'Claves VAPID inválidas'})}
 try{
  const destinatarios=new Set();
  async function agregar(tabla,campo,filtrarGrado=false){
   for(let desde=0;;desde+=500){
    let q=db.from(tabla).select(filtrarGrado?'auth_user_id,grado,activo':campo).range(desde,desde+499);
    if(filtrarGrado)q=q.in('grado',evento.grados).eq('activo',true);
    const {data,error}=await q;
    if(error)throw error;
    for(const item of data)if(item[campo])destinatarios.add(item[campo]);
    if(data.length<500)break;
   }
  }
  if(evento.roles.includes('estudiante'))await agregar('estudiantes','auth_user_id',true);
  if(evento.roles.includes('profesor')){
   for(let desde=0;;desde+=500){
    const {data,error}=await db.from('perfiles').select('id').eq('rol','profesor').range(desde,desde+499);
    if(error)throw error;
    data.forEach(p=>destinatarios.add(p.id));if(data.length<500)break;
   }
  }
  if(evento.roles.includes('acudiente')){
   for(let desde=0;;desde+=500){
    const {data,error}=await db.from('acudientes').select('auth_user_id,estudiante_id,estudiantes!inner(grado,activo)').in('estudiantes.grado',evento.grados).eq('estudiantes.activo',true).range(desde,desde+499);
    if(error)throw error;
    data.forEach(p=>destinatarios.add(p.auth_user_id));if(data.length<500)break;
   }
  }
  const ids=[...destinatarios],suscripciones=[];
  for(let i=0;i<ids.length;i+=100){
   const {data,error}=await db.from('suscripciones_push').select('endpoint,p256dh,auth,usuario_id').in('usuario_id',ids.slice(i,i+100));
   if(error)throw error;suscripciones.push(...data);
  }
  const payload=JSON.stringify({type:'evento-evaluacion',id:evento.id,title:'⭐ Evalúa: '+evento.titulo.slice(0,95),body:'Califica del 1 al 10 y comparte tu opinión de forma anónima.',sentAt:Date.now()});
  let enviados=0,fallidos=0;const errores={};const miCuenta={incluida:destinatarios.has(user.id),dispositivos:suscripciones.filter(s=>s.usuario_id===user.id).length,enviados:0,fallidos:0};
  for(let i=0;i<suscripciones.length;i+=10)await Promise.all(suscripciones.slice(i,i+10).map(async s=>{
   if(!endpointConocido(s.endpoint)){fallidos++;if(s.usuario_id===user.id)miCuenta.fallidos++;errores.destino_no_admitido=(errores.destino_no_admitido||0)+1;return}
   try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload,{TTL:86400,urgency:'normal',timeout:10000});enviados++;if(s.usuario_id===user.id)miCuenta.enviados++}
   catch(e){fallidos++;if(s.usuario_id===user.id)miCuenta.fallidos++;const code=Number(e.statusCode)||'conexion';errores[code]=(errores[code]||0)+1;if([404,410].includes(e.statusCode))await db.from('suscripciones_push').delete().eq('endpoint',s.endpoint)}
  }));
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({dispositivos:suscripciones.length,enviados,fallidos,errores,miCuenta});
 }catch(e){console.error('evento_push_error',e.message);return res.status(503).json({error:'No se pudieron consultar o notificar los destinatarios'})}
}
