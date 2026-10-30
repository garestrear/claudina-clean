import {createClient} from '@supabase/supabase-js';
import {createHmac,randomUUID} from 'node:crypto';
const opciones={auth:{persistSession:false,autoRefreshToken:false}};
const usuarioValido=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9._-]{2,39}$/.test(v);
const passwordValida=v=>typeof v==='string'&&v.length>=10&&v.length<=128;
const denegado='Usuario o contraseña incorrectos, o cuenta de jurado no habilitada.';
export function crearHandlerJurado(factory=createClient,env=process.env){return async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY,key=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY;
 if(!url||!secret||!key)return res.status(503).json({error:'Falta configurar el acceso de jurados en el servidor.'});
 const admin=factory(url,secret,opciones),auth=factory(url,key,opciones),accion=req.body?.accion;
 try{
  if(accion==='ingresar'){
   const usuario=String(req.body.usuario||'').trim().toLowerCase(),password=req.body.password;
   if(!usuarioValido(usuario)||typeof password!=='string'||!password||password.length>128)return res.status(401).json({error:denegado});
   const clave=createHmac('sha256',secret).update('jurado:'+usuario).digest('hex');
   const {data:permitido,error:limite}=await admin.rpc('feria_jurado_intento',{clave});
   if(limite)return res.status(503).json({error:'Activa feria-jurados-cuentas.sql en Supabase.'});
   if(!permitido)return res.status(429).json({error:'Demasiados intentos. Espera diez minutos antes de volver a ingresar.'});
   const {data:sesion,error}=await auth.auth.signInWithPassword({email:usuario+'@jurados.claudina.invalid',password});
   if(error||!sesion.session)return res.status(401).json({error:denegado});
   const {data:jurado,error:consulta}=await admin.from('feria_jurados').select('id,habilitado').eq('cuenta_id',sesion.user.id).eq('usuario',usuario).maybeSingle();
   if(consulta||!jurado?.habilitado)return res.status(401).json({error:denegado});
   return res.status(200).json({access_token:sesion.session.access_token,refresh_token:sesion.session.refresh_token});
  }
  const token=(req.headers?.authorization||'').replace(/^Bearer /i,'');
  if(!token)return res.status(401).json({error:'Ingresa de nuevo a tu cuenta.'});
  const {data:identidad,error:identidadError}=await admin.auth.getUser(token);
  if(identidadError||!identidad.user)return res.status(401).json({error:'La sesión no es válida. Ingresa de nuevo.'});
  if(accion==='cambiar-password'){
   const nueva=req.body.password,actual=req.body.actual;
   if(!passwordValida(nueva)||typeof actual!=='string'||!actual||actual.length>128||nueva===actual)return res.status(400).json({error:'La nueva contraseña debe ser diferente y tener entre 10 y 128 caracteres.'});
   const {data:j,error}=await admin.from('feria_jurados').select('id,habilitado,usuario,cuenta_id').eq('cuenta_id',identidad.user.id).maybeSingle();
   if(error||!j?.habilitado||identidad.user.email!==j.usuario+'@jurados.claudina.invalid')return res.status(403).json({error:'Esta cuenta no dispone de acceso manual de jurado.'});
   const {error:verificar}=await auth.auth.signInWithPassword({email:identidad.user.email,password:actual});
   if(verificar)return res.status(401).json({error:'La contraseña actual no es correcta.'});
   const {error:cambio}=await admin.auth.admin.updateUserById(identidad.user.id,{password:nueva});if(cambio)throw cambio;
   const {error:marcar}=await admin.rpc('feria_jurado_password_cambiada',{cuenta:identidad.user.id});
   if(marcar)return res.status(503).json({error:'La contraseña cambió, pero falta habilitar la evaluación. Ingresa con la nueva contraseña y vuelve a cambiarla.'});
   return res.status(200).json({mensaje:'Contraseña actualizada. Ya puedes evaluar tus proyectos.'});
  }
  if(!['crear','restablecer'].includes(accion))return res.status(400).json({error:'Acción no válida'});
  const {data:perfil,error:perfilError}=await admin.from('perfiles').select('rol').eq('id',identidad.user.id).maybeSingle();
  if(perfilError||perfil?.rol!=='profesor')return res.status(403).json({error:'Solo docentes pueden crear o restablecer cuentas de jurados.'});
  const persona=req.body.persona,password=req.body.password;
  if(typeof persona!=='string'||!/^[a-f0-9-]{36}$/i.test(persona)||!passwordValida(password))return res.status(400).json({error:'Selecciona el jurado y una contraseña inicial de 10 a 128 caracteres.'});
  const {data:j,error:consulta}=await admin.from('feria_jurados').select('id,nombre,correo,habilitado,cuenta_id,usuario').eq('id',persona).maybeSingle();
  if(consulta)return res.status(503).json({error:'Activa feria-jurados-cuentas.sql en Supabase.'});
  if(!j?.habilitado)return res.status(400).json({error:'Primero habilita al jurado en el panel de evaluación.'});
  if(accion==='restablecer'){
   if(!j.cuenta_id)return res.status(400).json({error:'Este jurado todavía no tiene una cuenta manual.'});
   const {data:cuenta,error:buscar}=await admin.auth.admin.getUserById(j.cuenta_id);
   if(buscar||cuenta.user?.email!==j.usuario+'@jurados.claudina.invalid')return res.status(409).json({error:'La cuenta requiere revisión; no se modificó ninguna contraseña.'});
   // Bloquea la evaluación antes de cambiar la contraseña inicial.
   const {error:bloquear}=await admin.rpc('feria_jurado_password_requerida',{cuenta:j.cuenta_id});if(bloquear)throw bloquear;
   const {error}=await admin.auth.admin.updateUserById(j.cuenta_id,{password});if(error)throw error;
   return res.status(200).json({usuario:j.usuario,mensaje:'Nueva contraseña inicial establecida. Las evaluaciones se conservan.'});
  }
  if(j.cuenta_id)return res.status(409).json({error:'La cuenta ya existe. Usa Restablecer contraseña si es necesario.'});
  const usuario=String(req.body.usuario||'').trim().toLowerCase();
  if(!usuarioValido(usuario))return res.status(400).json({error:'El usuario debe tener entre 3 y 40 caracteres: letras minúsculas, números, punto, guion o guion bajo.'});
  // El correo interno es exclusivo del rol; jamás se restablece una cuenta docente.
  const {data:nueva,error:crear}=await admin.auth.admin.createUser({email:usuario+'@jurados.claudina.invalid',password,email_confirm:true,user_metadata:{tipo_cuenta:'jurado',nombre:j.nombre,referencia:randomUUID()}});
  if(crear||!nueva.user)return res.status(409).json({error:'No se pudo crear la cuenta. Elige otro nombre de usuario o revisa la configuración de autenticación.'});
  const {error:vincular}=await admin.rpc('feria_jurado_cuenta_vincular',{persona:j.id,cuenta:nueva.user.id,usuario_nuevo:usuario});
  if(vincular){await admin.auth.admin.deleteUser(nueva.user.id);return res.status(409).json({error:'No se pudo vincular la cuenta; actualiza el panel antes de reintentar.'})}
  return res.status(200).json({usuario,mensaje:'Cuenta creada sin enviar correos. Entrega el usuario y la contraseña inicial a este jurado.'});
 }catch{return res.status(503).json({error:'No se pudo completar la operación. Revisa la conexión e intenta de nuevo.'})}
}}
export default crearHandlerJurado();
