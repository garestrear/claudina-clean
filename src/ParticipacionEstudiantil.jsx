import React,{useEffect,useState} from 'react';
import {supabase} from './lib/supabase';

const grupoDe=grado=>grado===6?'6':'7-8';
const fechaLocal=()=>new Date().toLocaleDateString('en-CA');
const imagenValida=f=>!f||(['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<=10*1024*1024);

export function ParticipacionEstudiantil({ficha}){
  const[registro,setRegistro]=useState(null),[valoracion,setValoracion]=useState(null),[reportes,setReportes]=useState([]);
  const[valor,setValor]=useState(0),[comentario,setComentario]=useState(''),[tipo,setTipo]=useState('aseo_incompleto');
  const[descripcion,setDescripcion]=useState(''),[foto,setFoto]=useState(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  async function cargar(){const{data:{user}}=await supabase.auth.getUser();if(!user)return;
    const [{data:r,error:re},{data:rs,error:rse}]=await Promise.all([
      supabase.from('registros_aseo').select('id,fecha').eq('fecha',fechaLocal()).eq('grupo',grupoDe(ficha.grado)).maybeSingle(),
      supabase.from('reportes').select('id,tipo,descripcion,estado,created_at').eq('autor',user.id).order('created_at',{ascending:false}).limit(20)]);
    if(re||rse){setMsg('No se pudieron cargar los registros. '+(re||rse).message);return}
    setRegistro(r);setReportes(rs||[]);
    if(r){const{data:v}=await supabase.from('valoraciones').select('valor,comentario').eq('registro_id',r.id).eq('autor',user.id).maybeSingle();setValoracion(v);setValor(v?.valor||0);setComentario(v?.comentario||'')}else{setValoracion(null);setValor(0);setComentario('')}
  }
  useEffect(()=>{cargar()},[ficha.id,ficha.grado]);
  async function valorar(e){e.preventDefault();if(!registro||!valor)return;setBusy(true);setMsg('');const{data:{user}}=await supabase.auth.getUser();
    const{error}=await supabase.from('valoraciones').upsert({registro_id:registro.id,autor:user.id,valor,comentario:comentario.trim()||null},{onConflict:'registro_id,autor'});
    setMsg(error?'No se pudo guardar la valoración: '+error.message:'✅ Tu valoración quedó guardada. No cambia la calificación del profesor.');if(!error)await cargar();setBusy(false)}
  async function reportar(e){e.preventDefault();if(!descripcion.trim())return;if(!imagenValida(foto)){setMsg('La foto debe ser JPG, PNG o WebP y pesar hasta 10 MB.');return}setBusy(true);setMsg('');const{data:{user}}=await supabase.auth.getUser();
    const{data:r,error}=await supabase.from('reportes').insert({registro_id:registro?.id||null,autor:user.id,tipo,descripcion:descripcion.trim(),estado:'pendiente'}).select('id').single();
    if(error){setMsg('No se pudo enviar el reporte: '+error.message);setBusy(false);return}
    let aviso='✅ Reporte enviado al profesor.';
    if(foto){const ext=foto.type==='image/png'?'png':foto.type==='image/webp'?'webp':'jpg';const path=`${user.id}/reportes/${r.id}/${crypto.randomUUID()}.${ext}`;
      const{error:upErr}=await supabase.storage.from('evidencias').upload(path,foto,{contentType:foto.type});
      if(upErr)aviso='El reporte se envió, pero la foto no pudo subirse: '+upErr.message;
      else{const{error:dbErr}=await supabase.from('evidencias').insert({reporte_id:r.id,path,subido_por:user.id});if(dbErr){await supabase.storage.from('evidencias').remove([path]);aviso='El reporte se envió, pero la foto no pudo guardarse: '+dbErr.message}}
    }
    setMsg(aviso);setDescripcion('');setFoto(null);e.target.reset();await cargar();setBusy(false)}
  return <><article className="card"><h3>⭐ Valora el aseo de hoy</h3>{registro?<form onSubmit={valorar}><p>¿Cómo quedó el salón? Tu opinión es independiente de la nota que pone el profesor.</p><div className="ratingChoices">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} de 5`} aria-pressed={valor===n} className={valor===n?'active':''} onClick={()=>setValor(n)}>{n} ⭐</button>)}</div><label>Comentario opcional<textarea maxLength="500" value={comentario} onChange={e=>setComentario(e.target.value)} placeholder="¿Qué estuvo bien o qué se puede mejorar?"/></label><button className="save" disabled={busy||!valor}>{valoracion?'Actualizar valoración':'Enviar valoración'}</button></form>:<p>Cuando el profesor guarde el registro de aseo de hoy, podrás valorarlo aquí.</p>}</article>
    <article className="card"><h3>🚨 Reportar un problema</h3><p>Cuéntale al profesor qué ocurrió. Puedes adjuntar una foto del salón o elegirla de la galería.</p><form onSubmit={reportar} className="reportForm"><label>Tipo de problema<select value={tipo} onChange={e=>setTipo(e.target.value)}><option value="aseo_incompleto">Aseo incompleto</option><option value="residuos">Basura o residuos</option><option value="danos">Daños en el salón</option><option value="otro">Otro</option></select></label><label>¿Qué sucedió?<textarea required maxLength="1000" value={descripcion} onChange={e=>setDescripcion(e.target.value)} placeholder="Describe el problema con respeto"/></label><label>Foto opcional<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFoto(e.target.files?.[0]||null)}/></label><button className="save" disabled={busy||!descripcion.trim()}>{busy?'Enviando…':'Enviar reporte'}</button></form></article>
    {msg&&<p role="status" className="notice">{msg}</p>}
    <article className="card"><h3>📋 Mis reportes</h3>{reportes.length?reportes.map(r=><div className="studentReport" key={r.id}><b>{r.tipo.replaceAll('_',' ')}</b> · {new Date(r.created_at).toLocaleDateString('es-CO')}<p>{r.descripcion}</p><small>Estado: {r.estado}</small></div>):<p>Aún no has enviado reportes.</p>}</article></>;
}

export function ReportesProfesor(){const[reportes,setReportes]=useState([]),[fotos,setFotos]=useState({}),[valoraciones,setValoraciones]=useState([]),[msg,setMsg]=useState(''),[busy,setBusy]=useState(null);
  async function cargar(){const{data,error}=await supabase.from('reportes').select('id,autor,tipo,descripcion,estado,created_at,registro_id').order('created_at',{ascending:false}).limit(100);if(error){setMsg(error.message);return}setReportes(data||[]);
    const ids=[...new Set((data||[]).map(x=>x.autor))];let autores={};if(ids.length){const{data:p}=await supabase.from('perfiles').select('id,nombre').in('id',ids);autores=Object.fromEntries((p||[]).map(x=>[x.id,x.nombre]))}
    const rids=(data||[]).map(x=>x.id);let imgs={};if(rids.length){const{data:e}=await supabase.from('evidencias').select('reporte_id,path').in('reporte_id',rids);for(const x of e||[]){const{data:u}=await supabase.storage.from('evidencias').createSignedUrl(x.path,3600);if(u?.signedUrl)(imgs[x.reporte_id]??=[]).push(u.signedUrl)}}setFotos(imgs);setReportes((data||[]).map(x=>({...x,autor_nombre:autores[x.autor]||'Estudiante'})));const{data:v}=await supabase.from('valoraciones').select('registro_id,valor,comentario,created_at').order('created_at',{ascending:false}).limit(100);const vids=[...new Set((v||[]).map(x=>x.registro_id))];let registros={};if(vids.length){const{data:rr}=await supabase.from('registros_aseo').select('id,fecha,grupo').in('id',vids);registros=Object.fromEntries((rr||[]).map(x=>[x.id,x]))}setValoraciones((v||[]).map(x=>({...x,registro:registros[x.registro_id]})))}
  useEffect(()=>{cargar()},[]);
  async function estado(id,valor){setBusy(id);const{error}=await supabase.from('reportes').update({estado:valor}).eq('id',id);if(error)setMsg(error.message);else{setMsg('Estado actualizado');await cargar()}setBusy(null)}
  return <section><h2>🚨 Reportes estudiantiles</h2><p>Revisa lo que enviaron los estudiantes y marca el estado de atención.</p>{msg&&<p role="status" className="notice">{msg}</p>}{reportes.length?reportes.map(r=><article className="card" key={r.id}><h3>{r.tipo.replaceAll('_',' ')} <small>· {r.estado}</small></h3><small>{r.autor_nombre} · {new Date(r.created_at).toLocaleString('es-CO')}</small><p>{r.descripcion}</p>{fotos[r.id]?.length>0&&<div className="evidenceGrid">{fotos[r.id].map(url=><a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Foto del reporte"/></a>)}</div>}<div className="reportActions"><button disabled={busy===r.id} onClick={()=>estado(r.id,'revisado')}>✓ Revisado</button><button disabled={busy===r.id} onClick={()=>estado(r.id,'descartado')}>Descartado</button><button disabled={busy===r.id} onClick={()=>estado(r.id,'pendiente')}>Pendiente</button></div></article>):<div className="placeholder">Todavía no hay reportes estudiantiles.</div>}<article className="card"><h3>⭐ Valoraciones del aseo</h3>{valoraciones.length?valoraciones.map((v,i)=><div className="studentReport" key={`${v.registro_id}-${i}`}><b>{v.valor}/5</b> · {v.registro?.fecha||'Registro'} · Grupo {v.registro?.grupo||'—'}{v.comentario&&<p>{v.comentario}</p>}</div>):<p>Todavía no hay valoraciones.</p>}</article></section>
}
