import {createClient} from '@supabase/supabase-js';
import {gruposValidos,normalizarGrupos} from '../lib/gruposDocente.js';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function crearHandlerGrupos(factory=createClient,env=process.env){return async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Método no permitido'});
 const token=req.headers?.authorization?.match(/^Bearer (.+)$/i)?.[1];
 if(!token)return res.status(401).json({error:'Inicia sesión nuevamente'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return res.status(503).json({error:'La administración de grupos no está configurada'});
 try{
  const db=factory(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identidad,error:authError}=await db.auth.getUser(token);
  if(authError||!identidad?.user)return res.status(401).json({error:'Sesión inválida'});
  const {data:perfil,error:perfilError}=await db.from('perfiles').select('rol').eq('id',identidad.user.id).maybeSingle();
  if(perfilError||perfil?.rol!=='profesor')return res.status(403).json({error:'Solo profesores administradores pueden asignar grupos'});
  const {data:permiso,error:permisoError}=await db.from('administradores_docentes').select('id').eq('id',identidad.user.id).maybeSingle();
  if(permisoError)return res.status(503).json({error:'Activa la actualización SQL de permisos docentes.'});
  if(!permiso)return res.status(403).json({error:'Solo administradores pueden asignar grupos a otros docentes'});
  const {profesorId,accion,grupos}=req.body||{};
  if(!uuid.test(profesorId||'')||!['consultar','guardar'].includes(accion))return res.status(400).json({error:'Selecciona un profesor válido'});
  if(accion==='guardar'&&!gruposValidos(grupos))return res.status(400).json({error:'Selecciona uno o más grupos válidos, sin repetir'});
  const {data:destino,error:destinoError}=await db.from('perfiles').select('id,rol').eq('id',profesorId).maybeSingle();
  if(destinoError)return res.status(503).json({error:'No se pudo comprobar el profesor'});
  if(destino?.rol!=='profesor')return res.status(404).json({error:'La cuenta seleccionada no es de un profesor'});
  const {data:cuenta,error:cuentaError}=await db.auth.admin.getUserById(profesorId);
  if(cuentaError||!cuenta?.user)return res.status(503).json({error:'No se pudieron consultar los grupos del profesor'});
  if(accion==='consultar')return res.status(200).json({profesorId,grupos:normalizarGrupos(cuenta.user.user_metadata?.grupos_interes)});
  const {error}=await db.auth.admin.updateUserById(profesorId,{user_metadata:{...cuenta.user.user_metadata,grupos_interes:[...grupos]}});
  if(error)return res.status(503).json({error:'No se guardaron los grupos. Intenta de nuevo'});
  return res.status(200).json({profesorId,grupos:[...grupos]});
 }catch{return res.status(503).json({error:'No se pudo completar la asignación de grupos'})}
}}
export default crearHandlerGrupos();
