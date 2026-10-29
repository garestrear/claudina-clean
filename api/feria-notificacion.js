import {createClient} from '@supabase/supabase-js';
import webpush from 'web-push';
import {endpointConocido} from '../lib/push.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function crearHandlerFeriaNotificacion(factory=createClient,push=webpush,env=process.env){return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const token=req.headers?.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)return res.status(401).json({error:'Sesión requerida'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.VAPID_SUBJECT)return res.status(503).json({error:'Notificaciones no configuradas'});
 const {tipo,solicitud}=req.body||{};
 if(!['correccion','revision'].includes(tipo)||typeof solicitud!=='string'||!uuid.test(solicitud))return res.status(400).json({error:'Cambio inválido'});
 const db=factory(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const{data:identidad,error:authError}=await db.auth.getUser(token);
  if(authError||!identidad?.user)return res.status(401).json({error:'Sesión inválida'});
  const usuario=identidad.user.id;
  const{data:perfil,error:perfilError}=await db.from('perfiles').select('rol').eq('id',usuario).maybeSingle();
  if(perfilError||perfil?.rol!=='profesor')return res.status(403).json({error:'Solo docentes'});
  // El servidor deriva el proyecto y los destinatarios del cambio YA guardado.
  // No se aceptan listas de usuarios, contenido o proyectos aportados por el cliente.
  let q=db.from(tipo==='correccion'?'feria_correcciones_docentes':'feria_revisiones').select('id,proyecto_id,creado_en').eq('solicitud',solicitud).eq(tipo==='correccion'?'docente_id':'revisor',usuario);
  if(tipo==='correccion')q=q.eq('origen','claudina');
  const{data:cambio,error:ce}=await q.maybeSingle();
  if(ce)return res.status(503).json({error:'No se pudo comprobar el cambio guardado'});
  if(!cambio)return res.status(404).json({error:'No hay un cambio propio para notificar'});
  const antiguedad=Date.now()-Date.parse(cambio.creado_en);
  if(!Number.isFinite(antiguedad)||antiguedad>3600000||antiguedad< -60000)return res.status(400).json({error:'El cambio ya no es reciente'});
  const{data:proyecto,error:pe}=await db.from('feria_proyectos').select('id,estudiante_id,integrantes_ids,titulo').eq('id',cambio.proyecto_id).maybeSingle();
  if(pe||!proyecto)return res.status(404).json({error:'Proyecto no disponible'});
  const equipo=[...new Set([proyecto.estudiante_id,...(proyecto.integrantes_ids||[])].filter(Boolean))];
  const{data:alumnos,error:ae}=await db.from('estudiantes').select('id,auth_user_id').in('id',equipo).eq('activo',true);
  if(ae)throw ae;
  const activos=(alumnos||[]).map(e=>e.id),acudientes=new Set(),destinatarios=new Set((alumnos||[]).map(e=>e.auth_user_id).filter(Boolean));
  if(activos.length){
   const{data:familias,error:fe}=await db.from('acudientes').select('auth_user_id').in('estudiante_id',activos);
   if(fe)throw fe;(familias||[]).forEach(a=>{if(a.auth_user_id){destinatarios.add(a.auth_user_id);acudientes.add(a.auth_user_id)}});
  }
  destinatarios.delete(usuario);
  if(!destinatarios.size)return res.status(200).json({dispositivos:0,enviados:0,fallidos:0});
  const subs=[];
  for(let desde=0;;desde+=500){
   const{data,error}=await db.from('suscripciones_push').select('usuario_id,endpoint,p256dh,auth').in('usuario_id',[...destinatarios]).range(desde,desde+499);
   if(error)throw error;subs.push(...data);if(data.length<500)break;
  }
  if(!subs.length)return res.status(200).json({dispositivos:0,enviados:0,fallidos:0});
  push.setVapidDetails(env.VAPID_SUBJECT,env.VAPID_PUBLIC_KEY,env.VAPID_PRIVATE_KEY);
  // Una misma revisión/corrección solo dispara un lote, incluso ante doble clic.
  const{error:claim}=await db.from('feria_notificaciones_push').insert({tipo,solicitud,docente_id:usuario});
  if(claim?.code==='23505')return res.status(200).json({duplicada:true,enviados:0,fallidos:0});
  if(claim)return res.status(503).json({error:'Activa mejoras-feria-accesos.sql en Supabase para habilitar los avisos individuales'});
  const mensaje={type:'feria-actualizada',id:proyecto.id,familia:proyecto.titulo.startsWith('[Emprendimiento familiar] '),title:tipo==='correccion'?'Feria STEAM · Textos actualizados':'Feria STEAM · Nueva revisión',body:'Tu profesor actualizó el proyecto. Entra a Claudina App para consultar los cambios y sugerencias.',sentAt:Date.now()};
  let enviados=0,fallidos=0;
  for(let i=0;i<subs.length;i+=10)await Promise.all(subs.slice(i,i+10).map(async s=>{
   if(!endpointConocido(s.endpoint)){fallidos++;return}
   try{await push.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({...mensaje,acudiente:acudientes.has(s.usuario_id)}),{TTL:86400,urgency:'normal',timeout:8000});enviados++}
   catch(e){fallidos++;if([404,410].includes(e.statusCode))await db.from('suscripciones_push').delete().eq('endpoint',s.endpoint)}
  }));
  return res.status(200).json({dispositivos:subs.length,enviados,fallidos});
 }catch{return res.status(503).json({error:'No se pudo enviar el aviso. El cambio sigue guardado en la app.'})}
}}
export default crearHandlerFeriaNotificacion();
