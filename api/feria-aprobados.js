import {createClient} from '@supabase/supabase-js';

async function aprobados(db,tabla,campos){
 const lista=[];
 for(let desde=0;;desde+=500){
  const {data,error}=await db.from(tabla).select(campos).eq('estado','aprobado').order('id').range(desde,desde+499);
  if(error)throw error;
  lista.push(...data);
  if(data.length<500)return lista;
 }
}
export function crearHandlerFeriaAprobados(factory=createClient,env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','private, no-store');
 if(req.method!=='GET')return res.status(405).json({error:'Método no permitido.'});
 const token=/^Bearer (\S+)$/i.exec(req.headers?.authorization||'')?.[1];
 if(!token)return res.status(401).json({error:'Ingresa con tu cuenta de estudiante.'});
 const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL,secret=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!secret)return res.status(503).json({error:'La consulta de proyectos no está disponible.'});
 try{
  const db=factory(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identidad,error:authError}=await db.auth.getUser(token);
  if(authError||!identidad?.user)return res.status(401).json({error:'Tu sesión venció. Ingresa de nuevo.'});
  const {data:perfil,error:perfilError}=await db.from('perfiles').select('rol').eq('id',identidad.user.id).maybeSingle();
  if(perfilError||perfil?.rol!=='estudiante')return res.status(403).json({error:'Esta consulta está disponible para estudiantes.'});
  const {data:ficha,error:fichaError}=await db.from('estudiantes').select('id').eq('auth_user_id',identidad.user.id).eq('activo',true).maybeSingle();
  if(fichaError||!ficha)return res.status(403).json({error:'Solicita al docente que revise tu ficha activa.'});
  const resultados=await Promise.all([
   aprobados(db,'feria_proyectos','titulo,integrantes,materiales,grado'),
   aprobados(db,'feria_proyectos_externos','datos->titulo,datos->integrantes,datos->institucion'),
   db.from('feria_proyectos').select('id',{count:'exact',head:true}).neq('estado','borrador'),
   db.from('feria_proyectos_externos').select('id',{count:'exact',head:true}).neq('estado','borrador')
  ]);
  const [internos,externos,conteoInternos,conteoExternos]=resultados;
  if(conteoInternos.error||conteoExternos.error)throw new Error('No se pudieron contar los proyectos');
  // Only the approved exhibition roster leaves the server, never contact details or drafts.
  const proyectos=[...internos.map(p=>{
   const familiar=p.titulo.startsWith('[Emprendimiento familiar] ');
   return {titulo:familiar?p.titulo.slice(26):p.titulo,integrantes:familiar&&p.materiales?.trim()?p.materiales:p.integrantes,grado:p.grado,institucion:'C.E.R. Claudina Múnera'};
  }),...externos.map(p=>({titulo:p.titulo,integrantes:p.integrantes,institucion:p.institucion}))];
  proyectos.sort((a,b)=>(a.titulo||'').localeCompare(b.titulo||'','es'));
  return res.status(200).json({proyectos,presentados:conteoInternos.count+conteoExternos.count,aprobados:proyectos.length});
 }catch{return res.status(503).json({error:'No pudimos consultar los proyectos aprobados. Intenta de nuevo.'})}
};}
export default crearHandlerFeriaAprobados();
