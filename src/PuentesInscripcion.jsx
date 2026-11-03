import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import SelectorFotos from './SelectorFotos';
import {guardarBorrador,leerBorrador,leerFotosBorrador,guardarFotosBorrador,borrarBorrador} from './borradorAseo';
import {gradoFeria} from './feriaCiencia.js';
import {categoriasPuentes,solicitudPuente,ordenarTurnosPuentes,intentosPuente,gradoTurnoPuente,sigueEnCompetencia} from './puentes.js';
import './FeriaPuentes.css';
const bucket='feria-puentes-fotos';
const activacion='Activa supabase/feria-puentes-inscripcion.sql en Supabase para habilitar las inscripciones independientes.';
const mensajeError=e=>/function|schema cache|does not exist/i.test(e.message||'')?activacion:e.message||'No se pudo completar la operación.';
export function FotoPuente({path,titulo='puente'}){
 const[url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{let vivo=true;setUrl('');setError(false);if(path)supabase.storage.from(bucket).createSignedUrl(path,300).then(({data,error})=>{if(vivo){if(error)setError(true);else setUrl(data.signedUrl)}}).catch(()=>{if(vivo)setError(true)});return()=>{vivo=false}},[path]);
 return !path?null:error?<p>No se pudo abrir la foto.</p>:url?<a href={url} target="_blank" rel="noreferrer"><img className="bridgePhoto" src={url} alt={'Foto de '+titulo} loading="lazy"/></a>:<p>Cargando foto…</p>;
}
function FormularioPuente({puente,contexto,clave,borrador,onVolver,onGuardado}){
 const base=borrador?.id===puente.id?borrador:null;
 const[datos,setDatos]=useState(()=>base?.datos||{titulo:puente.titulo||'',categoria:puente.categoria||'',integrantes_ids:puente.integrantes_ids||[],masa_g:puente.masa_g??'',foto_path:puente.foto_path||null});
 const[refs,setRefs]=useState(()=>base?.equipo||puente.equipo||[]),[grado,setGrado]=useState(''),[lista,setLista]=useState([]),[cargando,setCargando]=useState(false);
 const[fotos,setFotos]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[fotosListas,setFotosListas]=useState(false);
 const solicitud=useRef(base?.solicitud||null),subida=useRef(base?.subida||null),ocupado=useRef(false);
 const version=base?.version??puente.version??0;
 const personas=[contexto.ficha,...contexto.companeros,...refs,...lista].filter(Boolean);
 function persistir(d=datos,equipo=refs){guardarBorrador(clave,{id:puente.id,version,datos:d,equipo,solicitud:solicitud.current,subida:subida.current})}
 useEffect(()=>{let vivo=true;leerFotosBorrador(clave).then(f=>{if(vivo){setFotos(f||[]);setFotosListas(true)}}).catch(()=>{if(vivo)setFotosListas(true)});return()=>{vivo=false}},[clave]);
 useEffect(()=>{persistir()},[datos,refs]);
 useEffect(()=>{let vivo=true;setLista([]);setError('');if(grado===''){setCargando(false);return}setCargando(true);supabase.rpc('feria_puentes_estudiantes_grado',{grado_elegido:Number(grado)}).then(({data,error})=>{if(vivo){if(error)setError(mensajeError(error));else setLista(data||[]);setCargando(false)}}).catch(e=>{if(vivo){setError(mensajeError(e));setCargando(false)}});return()=>{vivo=false}},[grado]);
 function cambiar(k,v){solicitud.current=null;setDatos(d=>({...d,[k]:v}))}
 function agregar(id){const persona=personas.find(e=>e.id===id);if(persona&&!datos.integrantes_ids.includes(id)){setRefs(r=>[...r.filter(e=>e.id!==id),persona]);cambiar('integrantes_ids',[...datos.integrantes_ids,id])}}
 function seleccionarFotos(fs){solicitud.current=null;subida.current=null;setFotos(fs);guardarFotosBorrador(clave,fs).catch(()=>setError('No se pudo conservar la foto para una recarga.'));persistir()}
 async function guardar(e){
  e.preventDefault();if(ocupado.current)return;
  if(!contexto.docente&&!contexto.registro_para_otros&&!datos.integrantes_ids.includes(contexto.ficha?.id)){setError('Activa supabase/feria-puentes-registro-y-eliminacion.sql en Supabase para inscribir puentes sin incluir a quien registra.');return}
  if(!datos.integrantes_ids.length){setError('Escoge al menos un integrante.');return}
  if(fotos[0]&&(!['image/jpeg','image/png','image/webp'].includes(fotos[0].type)||fotos[0].size>8388608)){setError('Escoge una foto JPG, PNG o WebP de máximo 8 MB.');return}
  ocupado.current=true;setBusy(true);setError('');
  try{
   let foto=datos.foto_path;
   if(fotos[0]){
    if(!subida.current){const ruta=`${contexto.usuario}/${puente.id}/${solicitudPuente()}.${fotos[0].type.split('/')[1]}`;const{error}=await supabase.storage.from(bucket).upload(ruta,fotos[0]);if(error)throw error;subida.current=ruta;persistir()}
    foto=subida.current;
   }
   if(!solicitud.current)solicitud.current=solicitudPuente();persistir();
   const{data,error}=await supabase.rpc('feria_puentes_guardar',{puente:puente.id,datos:{...datos,titulo:datos.titulo.trim(),foto_path:foto},version_esperada:version,solicitud_id:solicitud.current});if(error)throw error;
   await borrarBorrador(clave).catch(()=>{});onGuardado(data);
  }catch(e){setError(mensajeError(e)+' Si no se confirmó el guardado, actualiza la lista antes de registrar otra vez.')}finally{ocupado.current=false;setBusy(false)}
 }
 return <form className="bridgeForm" onSubmit={guardar}><h3>{puente.version?'Editar puente':'Inscribir puente'}</h3><p>{contexto.docente?'Registra el puente de cualquier estudiante del colegio.':'Puedes inscribir un puente de otros estudiantes de cualquier grado. Selecciona solo a quienes lo hicieron; si tú también participas, agrégate al equipo.'}</p><fieldset disabled={busy}>
 <label>Nombre del puente<input required maxLength={150} value={datos.titulo} onChange={e=>cambiar('titulo',e.target.value)}/></label>
 <label>Categoría<select required value={datos.categoria} onChange={e=>cambiar('categoria',e.target.value)}><option value="">Escoge una categoría</option><option value="puentes_juvenil">Juvenil · palitos de paleta (60 × 10 cm)</option><option value="puentes_infantil">Infantil · palillos de dientes (20 × 5 cm)</option></select></label>
 <div className="bridgeTeam"><h4>Integrantes</h4>{!contexto.docente&&contexto.ficha&&!datos.integrantes_ids.includes(contexto.ficha.id)&&<button type="button" onClick={()=>agregar(contexto.ficha.id)}>Agregarme al equipo</button>}{!contexto.docente&&<label>Agregar un compañero de mi grupo<select value="" onChange={e=>agregar(e.target.value)}><option value="">Selecciona un compañero</option>{contexto.companeros.filter(e=>!datos.integrantes_ids.includes(e.id)).map(e=><option key={e.id} value={e.id}>{e.nombre} · {gradoFeria(e.grado)}</option>)}</select></label>}
 <details open={contexto.docente?true:undefined}><summary>{contexto.docente?'Escoger estudiantes del colegio':'Escoger estudiantes de cualquier grado'}</summary><label>Grupo<select value={grado} onChange={e=>setGrado(e.target.value)}><option value="">Selecciona el grupo</option>{Array.from({length:9},(_,g)=><option key={g} value={g}>{gradoFeria(g)}</option>)}</select></label>{grado!==''&&<label>Estudiante<select disabled={cargando} value="" onChange={e=>agregar(e.target.value)}><option value="">{cargando?'Consultando…':'Selecciona un estudiante'}</option>{lista.filter(e=>!datos.integrantes_ids.includes(e.id)).map(e=><option key={e.id} value={e.id}>{e.nombre}</option>)}</select></label>}</details>
 <ul className="bridgeMembers">{datos.integrantes_ids.map(id=>{const p=personas.find(e=>e.id===id);return <li key={id}><span>{p?`${p.nombre} · ${gradoFeria(p.grado)}`:'Integrante registrado'}</span><button type="button" aria-label={'Quitar a '+(p?.nombre||'integrante')} onClick={()=>cambiar('integrantes_ids',datos.integrantes_ids.filter(x=>x!==id))}>Quitar</button></li>})}</ul>{contexto.docente&&<p>Selecciona los integrantes del puente, aunque sean de distintos grupos.</p>}</div>
 <label>Peso del puente en gramos (opcional)<input type="number" min="0.001" max="9999999.999" step="0.001" value={datos.masa_g} onChange={e=>cambiar('masa_g',e.target.value)}/></label><p>Puedes dejarlo vacío y pesarlo en la mesa antes de la prueba.</p>
 <h4>Foto del puente (opcional)</h4>{datos.foto_path&&!fotos.length&&<><FotoPuente path={datos.foto_path} titulo={datos.titulo}/><button type="button" onClick={()=>cambiar('foto_path',null)}>Quitar foto actual</button></>}<SelectorFotos archivos={fotos} onSeleccionar={seleccionarFotos} disabled={busy||!fotosListas} onPreparar={()=>persistir()}/><small>JPG, PNG o WebP, máximo 8 MB.</small>
 </fieldset>{error&&<p className="bridgeError" role="alert">{error}</p>}<div className="bridgeActions"><button className="bridgePrimary" disabled={busy||!fotosListas}>{busy?'Guardando…':'Guardar inscripción'}</button><button type="button" disabled={busy} onClick={onVolver}>Volver a la lista</button></div></form>;
}
export default function PuentesInscripcion({onGuardar,rondas,puentesConcurso,soloCompetencia=false}){
 const[ctx,setCtx]=useState(null),[error,setError]=useState(''),[puente,setPuente]=useState(null),[mensaje,setMensaje]=useState(''),[cargando,setCargando]=useState(false),[revision,setRevision]=useState(0),[eliminando,setEliminando]=useState(false);
 const borrado=useRef(null),borrando=useRef(false);
 const puentesActuales=(ctx?.puentes||[]).map(p=>{const actual=puentesConcurso?.find(a=>a.id===p.id);return actual&&actual.version>=p.version?{...p,...actual,bloqueado:p.bloqueado||rondas?.some(r=>r.puente_id===p.id)}:p});
 const clave=ctx?`claudina:puente:${ctx.usuario}`:'',borrador=clave?leerBorrador(clave):null;
 async function cargar(){if(borrando.current)return;setCargando(true);setError('');try{const{data,error}=await supabase.rpc('feria_puentes_inscripcion_contexto');if(error)throw error;setCtx(data)}catch(e){setError(mensajeError(e))}finally{setCargando(false)}}
 useEffect(()=>{cargar()},[]);
 async function editar(p){if(borrando.current)return;await borrarBorrador(clave).catch(()=>{});setRevision(v=>v+1);setPuente(p);setMensaje('')}
 async function eliminar(p){
  if(borrando.current||cargando||!ctx?.docente)return;
  const aviso=p.bloqueado?' También se eliminarán sus intentos y resultados del tablero.':'';
  if(!window.confirm(`¿Eliminar el puente «${p.titulo}» registrado por error?${aviso} Esta acción no se puede deshacer desde la app.`))return;
  borrando.current=true;setEliminando(true);setError('');setMensaje('');
  const firma=JSON.stringify([p.id,p.version,!!p.bloqueado]);
  if(borrado.current?.firma!==firma)borrado.current={firma,solicitud:solicitudPuente()};
  try{
   const{data,error}=await supabase.rpc('feria_puentes_eliminar',{puente:p.id,version_esperada:p.version,solicitud_id:borrado.current.solicitud,confirmar_resultados:!!p.bloqueado});
   if(error)throw error;
   setCtx(data);borrado.current=null;
   if(borrador?.id===p.id){await borrarBorrador(clave).catch(()=>{});setRevision(v=>v+1)}
   setMensaje('Puente eliminado. Ya no aparece en las inscripciones ni en el tablero.');onGuardar?.();
  }catch(e){setError(/function|schema cache|does not exist/i.test(e.message||'')?'Activa supabase/feria-puentes-registro-y-eliminacion.sql en Supabase para habilitar la eliminación.':(e.message||'No se confirmó la eliminación.')+' Actualiza la lista antes de continuar.')}
  finally{borrando.current=false;setEliminando(false)}
 }
 async function descalificar(p){
  if(borrando.current||cargando||!ctx?.docente||p.estado==='descalificado')return;
  const motivo=window.prompt(`Descalificar «${p.titulo}» por no cumplir los requisitos. Indica el requisito incumplido:`);
  if(motivo===null)return;
  if(motivo.trim().length<5||motivo.trim().length>1000){setError('Indica el requisito incumplido (entre 5 y 1000 caracteres).');return}
  if(!window.confirm(`¿Descalificar «${p.titulo}»? Se conservarán sus registros, pero quedará fuera de los puestos del concurso. Motivo: ${motivo.trim()}`))return;
  borrando.current=true;setEliminando(true);setError('');setMensaje('');
  const firma=JSON.stringify(['descalificar',p.id,p.version,motivo.trim()]);
  if(borrado.current?.firma!==firma)borrado.current={firma,solicitud:solicitudPuente()};
  try{
   const{data,error}=await supabase.rpc('feria_puentes_descalificar',{puente:p.id,version_esperada:p.version,solicitud_id:borrado.current.solicitud,motivo:motivo.trim()});
   if(error)throw error;
   setCtx(data);borrado.current=null;
   if(borrador?.id===p.id){await borrarBorrador(clave).catch(()=>{});setRevision(v=>v+1)}
   setMensaje('Puente descalificado por no cumplir los requisitos. Sus registros se conservan y queda fuera de los puestos del concurso.');onGuardar?.();
  }catch(e){setError(/function|schema cache|does not exist/i.test(e.message||'')?'Activa supabase/feria-puentes-descalificacion.sql en Supabase para habilitar la descalificación.':(e.message||'No se confirmó la descalificación.')+' Actualiza la lista antes de continuar.')}
  finally{borrando.current=false;setEliminando(false)}
 }
 function continuar(){if(borrando.current)return;const actual=ctx.puentes.find(p=>p.id===borrador.id);if(actual?.bloqueado){setError('Este puente ya está en prueba y no permite editar.');return}setPuente(actual||{id:borrador.id});setRevision(v=>v+1)}
 return <section className="bridgeRegistrations" aria-label="Inscripciones de puentes"><div className="bridgeHeader"><div><h2>{ctx?.docente?'Puentes inscritos':'Mis inscripciones de puentes'}</h2><p>Concurso independiente de los proyectos STEAM.</p></div><div className="bridgeActions"><button type="button" disabled={!ctx||!!puente||eliminando} onClick={()=>editar({id:solicitudPuente()})}>＋ Inscribir puente</button><button type="button" disabled={cargando||!!puente||eliminando} onClick={cargar}>Actualizar lista</button></div></div>
 {error&&<p className="bridgeError" role="alert">{error}</p>}{mensaje&&<p role="status">{mensaje}</p>}{!ctx&&!error&&<p role="status">Consultando inscripciones…</p>}
 {ctx&&(puente?<FormularioPuente key={puente.id+':'+revision} puente={puente} contexto={ctx} clave={clave} borrador={borrador} onVolver={()=>setPuente(null)} onGuardado={data=>{setCtx(data);setPuente(null);setMensaje('¡Puente inscrito! El equipo y los docentes ya pueden consultarlo.');onGuardar?.()}}/>:<>{borrador?.id&&<div className="bridgeDraft"><p>Tienes una inscripción sin terminar en este dispositivo.</p><button type="button" onClick={continuar}>Continuar inscripción</button><button type="button" onClick={async()=>{await borrarBorrador(clave).catch(()=>{});setRevision(v=>v+1)}}>Descartar borrador</button></div>}<div className="bridgeCards">{ordenarTurnosPuentes(puentesActuales.filter(p=>!soloCompetencia||sigueEnCompetencia(p,rondas)),rondas).map(p=><article className="bridgeCard" key={p.id}><FotoPuente path={p.foto_path} titulo={p.titulo}/><span>{categoriasPuentes[p.categoria]}</span><h3>{p.titulo}</h3><p className="bridgeNames">{p.integrantes}</p><p>{intentosPuente(p,rondas)}/3 intentos · {Number.isFinite(gradoTurnoPuente(p))?gradoFeria(gradoTurnoPuente(p)):'Grado por registrar'}</p><p>{p.masa_g?`Peso: ${p.masa_g} g`:'Peso por registrar en la mesa'}</p>{p.estado==='descalificado'?<p role="status"><strong>Descalificado por no cumplir los requisitos</strong><br/>{p.motivo_fin}</p>:p.bloqueado?<p>La prueba ya comenzó; se conserva la ficha.</p>:<button type="button" disabled={eliminando||cargando} onClick={()=>editar(p)}>Editar inscripción</button>}{ctx.docente&&p.estado!=='descalificado'&&<button type="button" className="bridgeDanger" disabled={eliminando||cargando} onClick={()=>descalificar(p)} aria-label={'Descalificar puente '+p.titulo}>Descalificar</button>}{ctx.docente&&<button type="button" className="bridgeDanger" disabled={eliminando||cargando} onClick={()=>eliminar(p)} aria-label={'Eliminar puente '+p.titulo}>{eliminando?'Eliminando…':'Eliminar puente'}</button>}</article>)}</div>{soloCompetencia&&ctx.puentes.length>0&&!puentesActuales.some(p=>sigueEnCompetencia(p,rondas))&&<p role="status">No quedan puentes en competencia. Desmarca el filtro para consultar todos los registros.</p>}{!ctx.puentes.length&&<p>Todavía no hay puentes inscritos{ctx.docente?'': ' para tu equipo'}. Puedes registrar uno con su nombre, integrantes y categoría.</p>}</>)}
 </section>;
}


