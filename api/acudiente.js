import {createClient} from '@supabase/supabase-js';
import {createHmac,randomUUID} from 'node:crypto';
const opciones={auth:{persistSession:false,autoRefreshToken:false}};
const denegado='Documento o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.';
export function crearHandlerAcudiente(factory=createClient,env=process.env){return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY,key=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY;
 if(!url||!secret||!key)return res.status(503).json({error:'El acceso de acudientes aún no está configurado en el servidor.'});
 if(req.body?.accion==='restablecer'){
  const admin=factory(url,secret,opciones),token=(req.headers?.authorization||'').replace(/^Bearer /i,'');
  try{
   const{data:identidad,error:identidadError}=await admin.auth.getUser(token);
   if(identidadError||!identidad.user)return res.status(401).json({error:'Ingresa con tu cuenta de profesor.'});
   const{data:perfil,error:perfilError}=await admin.from('perfiles').select('rol').eq('id',identidad.user.id).maybeSingle();
   if(perfilError||perfil?.rol!=='profesor')return res.status(403).json({error:'Solo un profesor puede restablecer el acceso.'});
   const{data:hijo,error:hijoError}=await admin.from('estudiantes').select('id,documento,activo').eq('id',req.body.estudiante).eq('activo',true).maybeSingle();
   if(hijoError||!hijo?.documento)return res.status(400).json({error:'Registra el documento del estudiante activo antes de restablecer su acceso.'});
   const{data:cuenta,error:cuentaError}=await admin.from('acudientes').select('auth_user_id').eq('estudiante_id',hijo.id).maybeSingle();
   if(cuentaError)return res.status(503).json({error:'Ejecuta acudientes.sql en Supabase.'});
   if(cuenta){const{error}=await admin.auth.admin.updateUserById(cuenta.auth_user_id,{password:hijo.documento});if(error)throw error}
   return res.status(200).json({mensaje:'El acudiente puede ingresar con el documento del estudiante como usuario y contraseña.'});
  }catch{return res.status(503).json({error:'No fue posible restablecer el acceso. Inténtalo de nuevo.'})}
 }
 const documento=String(req.body?.documento??'').trim().toUpperCase(),password=req.body?.password;
 if(!/^[A-Z0-9-]{3,30}$/.test(documento)||typeof password!=='string'||!password||password.length>128)return res.status(401).json({error:denegado});
 const admin=factory(url,secret,opciones),auth=factory(url,key,opciones);
 try{
  const clave=createHmac('sha256',secret).update(documento).digest('hex');
  const{data:permitido,error:limite}=await admin.rpc('acudiente_registrar_intento',{clave});
  if(limite)return res.status(503).json({error:'Ejecuta la actualización acudientes.sql en Supabase para habilitar este acceso.'});
  if(!permitido)return res.status(429).json({error:'Se alcanzó el límite de intentos. Espera diez minutos antes de volver a intentar.'});
  const{data:hijo,error}=await admin.from('estudiantes').select('id,nombre,documento,activo').eq('documento',documento).eq('activo',true).maybeSingle();
  if(error)return res.status(503).json({error:'No fue posible comprobar el acceso. Inténtalo de nuevo.'});
  if(!hijo)return res.status(401).json({error:denegado});
  let{data:cuenta,error:consulta}=await admin.from('acudientes').select('auth_user_id').eq('estudiante_id',hijo.id).maybeSingle();
  if(consulta)return res.status(503).json({error:'Ejecuta la actualización acudientes.sql en Supabase para habilitar este acceso.'});
  if(!cuenta){
   if(password!==hijo.documento)return res.status(401).json({error:denegado});
   const email=`${randomUUID()}@acudientes.claudina.invalid`;
   const{data:nueva,error:crear}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{tipo_cuenta:'acudiente'}});
   if(crear||!nueva.user)return res.status(503).json({error:'No se pudo preparar la cuenta de acudiente. Inténtalo de nuevo.'});
   const{data:vinculada,error:vincular}=await admin.rpc('vincular_cuenta_acudiente',{cuenta:nueva.user.id,estudiante:hijo.id});
   if(vincular||!vinculada){await admin.auth.admin.deleteUser(nueva.user.id);return res.status(503).json({error:'No se pudo vincular la cuenta. Inténtalo de nuevo.'})}
   if(vinculada!==nueva.user.id)await admin.auth.admin.deleteUser(nueva.user.id);
   cuenta={auth_user_id:vinculada};
  }
  const{data:usuario,error:buscar}=await admin.auth.admin.getUserById(cuenta.auth_user_id);
  if(buscar||!usuario.user?.email)return res.status(503).json({error:'La cuenta requiere revisión por un profesor.'});
  const{data:sesion,error:entrar}=await auth.auth.signInWithPassword({email:usuario.user.email,password});
  if(entrar||!sesion.session)return res.status(401).json({error:denegado});
  return res.status(200).json({access_token:sesion.session.access_token,refresh_token:sesion.session.refresh_token});
 }catch{return res.status(503).json({error:'No fue posible ingresar. Inténtalo de nuevo.'})}
}}
export default crearHandlerAcudiente();
