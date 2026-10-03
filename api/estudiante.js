import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
const opciones={auth:{persistSession:false,autoRefreshToken:false}};
export function crearHandlerEstudiante(factory=createClient,env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,key=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key||!secret)return res.status(503).json({error:'El acceso estudiantil no está configurado en el servidor.'});
 const email=String(req.body?.email??'').trim().toLowerCase(),password=req.body?.password;
 const denegar=()=>res.status(401).json({error:'Correo o documento incorrectos. Verifica que el profesor haya registrado ambos datos.'});
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>254||typeof password!=='string'||!password||password.length>128)return denegar();
 const admin=factory(url,secret,opciones),auth=factory(url,key,opciones);
 try{
  const{data:permitido,error:limite}=await admin.rpc('acudiente_registrar_intento',{clave:createHmac('sha256',secret).update('estudiante:'+email).digest('hex')});
  if(limite)return res.status(503).json({error:'Ejecuta acceso-estudiantes-documento.sql en Supabase.'});
  if(!permitido)return res.status(429).json({error:'Espera diez minutos antes de volver a intentar.'});
  const args={correo:email,documento_ingresado:password};
  let{data:cuenta,error}=await admin.rpc('preparar_acceso_estudiante',args);
  if(error)return res.status(503).json({error:'Ejecuta acceso-estudiantes-documento.sql en Supabase.'});
  if(!cuenta)return denegar();
  if(cuenta.crear){
   // El correo ya fue autorizado por el profesor; no se requiere un registro manual.
   await admin.auth.admin.createUser({email,password,email_confirm:true});
   // También resuelve el caso de dos ingresos simultáneos al mismo correo.
   const resultado=await admin.rpc('preparar_acceso_estudiante',args);cuenta=resultado.data;
   if(resultado.error||!cuenta?.id)return res.status(503).json({error:'No fue posible preparar la cuenta. Solicita ayuda al profesor.'});
  }
  const{error:actualizar}=await admin.auth.admin.updateUserById(cuenta.id,{password,email_confirm:true});
  if(actualizar)return res.status(503).json({error:'No fue posible habilitar el acceso. Solicita ayuda al profesor.'});
  const{data:sesion,error:ingresar}=await auth.auth.signInWithPassword({email:cuenta.email,password});
  if(ingresar||!sesion.session)return denegar();
  return res.status(200).json({access_token:sesion.session.access_token,refresh_token:sesion.session.refresh_token});
 }catch{return res.status(503).json({error:'No fue posible ingresar. Inténtalo de nuevo.'})}
}}
export default crearHandlerEstudiante();
