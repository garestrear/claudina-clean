import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {consultarMaster,ErrorMaster} from '../lib/master2000/consulta.js';
const opciones={auth:{persistSession:false,autoRefreshToken:false}};
export function crearHandlerMaster(factory=createClient,consulta=consultarMaster,env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Pragma','no-cache');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return res.status(503).json({error:'La consulta de Master no está configurada.'});
 const token=/^Bearer (\S+)$/i.exec(req.headers?.authorization||'')?.[1];
 if(!token)return res.status(401).json({error:'Ingresa con tu cuenta de estudiante.'});
 const periodo=Number(req.body?.periodo),materia=req.body?.materia;
 if(!Number.isInteger(periodo)||periodo<1||periodo>4||(materia!==undefined&&(typeof materia!=='string'||!/^[A-Za-z0-9_-]{1,30}$/.test(materia))))return res.status(400).json({error:'Período o materia inválidos.'});
 // Never accept a document, student ID or destination supplied by the browser.
 if(['documento','estudiante','estudiante_id','url','nombre'].some(k=>Object.hasOwn(req.body||{},k)))return res.status(400).json({error:'Solo puedes consultar tu propia ficha.'});
 let password=req.body?.password;
 if(password!==undefined&&(typeof password!=='string'||!password||password.length>128))return res.status(400).json({error:'Contraseña inválida.'});
 let streaming=false;
 const emitir=evento=>res.write(JSON.stringify(evento)+'\n');
 const admin=factory(url,secret,opciones);
 try{
  const{data:identidad,error:authError}=await admin.auth.getUser(token),user=identidad?.user;
  if(authError||!user)return res.status(401).json({error:'Tu sesión venció. Ingresa de nuevo.'});
  const{data:perfil,error:perfilError}=await admin.from('perfiles').select('rol').eq('id',user.id).maybeSingle();
  if(perfilError||perfil?.rol!=='estudiante')return res.status(403).json({error:'Esta consulta está disponible en la cuenta del estudiante.'});
  const{data:ficha,error:fichaError}=await admin.from('estudiantes').select('id,nombre,documento,activo').eq('auth_user_id',user.id).eq('activo',true).maybeSingle();
  if(fichaError||!ficha?.activo||!/^\d{3,30}$/.test(ficha.documento||''))return res.status(403).json({error:'Tu ficha activa necesita un documento válido. Solicita revisión al docente.'});
  if(req.body?.apellido!==undefined&&(typeof req.body.apellido!=='string'||req.body.apellido.length>60))return res.status(400).json({error:'Apellido inválido.'});
  const apellido=String(req.body?.apellido||user.user_metadata?.master2000_apellido||'').trim();
  if(!password){
   if(!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ '-]{0,59}$/.test(apellido))return res.status(400).json({codigo:'APELLIDO',error:'Confirma tu primer apellido o ingresa tu contraseña actual de Master.'});
   password=ficha.documento+apellido.normalize('NFD').replace(/[\u0300-\u036f]/g,'').charAt(0).toUpperCase();
  }
  const clave=createHmac('sha256',secret).update('master2000:'+user.id).digest('hex');
  const{data:permiso,error:limite}=await admin.rpc('acudiente_registrar_intento',{clave});
  if(limite)return res.status(503).json({error:'No fue posible comprobar el límite de consultas.'});
  if(!permiso)return res.status(429).json({error:'Alcanzaste el límite de consultas. Espera diez minutos antes de volver a consultar.'});
  const onProgress=req.headers?.accept==='application/x-ndjson'?paso=>emitir({tipo:'progreso',...paso}):undefined;
  if(onProgress){streaming=true;res.status(200);res.setHeader('Content-Type','application/x-ndjson; charset=utf-8');res.setHeader('X-Accel-Buffering','no');res.flushHeaders?.();emitir({tipo:'progreso',codigo:'FICHA',mensaje:'Cuenta y ficha verificadas; iniciando la consulta'})}
  const datos=await consulta({documento:ficha.documento,password,nombre:ficha.nombre,periodo,materia,...(onProgress?{onProgress}:{})});
  // Surname is a profile preference. Passwords and Master sessions are never persisted.
  if(apellido&&apellido!==user.user_metadata?.master2000_apellido)await admin.auth.admin.updateUserById(user.id,{user_metadata:{...user.user_metadata,master2000_apellido:apellido}});
  if(streaming){emitir({tipo:'resultado',datos});return res.end()}
  return res.status(200).json(datos);
 }catch(e){if(streaming){emitir({tipo:'error',codigo:e instanceof ErrorMaster?e.codigo:'NO_DISPONIBLE',error:e instanceof ErrorMaster?e.message:'No fue posible consultar Master. Inténtalo más tarde.'});return res.end()}return res.status(e instanceof ErrorMaster?e.status:503).json({codigo:e instanceof ErrorMaster?e.codigo:'NO_DISPONIBLE',error:e instanceof ErrorMaster?e.message:'No fue posible consultar Master. Inténtalo más tarde.'})}finally{password=undefined}
}}
export default crearHandlerMaster();
