import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {notificarCambioFeria} from './notificacionFeria.js';
import {camposFeria,enlacePosterValido,estadosFeria} from './feriaCiencia.js';
import {camposEmprendimiento,esEmprendimiento,tituloFeria} from './feriaFamilias.js';
export function HistorialCorrecciones({proyecto,origen='claudina'}){
 const[historial,setHistorial]=useState([]);
 useEffect(()=>{let activo=true;supabase.rpc('feria_correcciones_contexto',{origen,proyecto:proyecto.id}).then(r=>{if(activo)setHistorial(r.error?[]:r.data||[])}).catch(()=>{if(activo)setHistorial([])});return()=>{activo=false}},[origen,proyecto.id,proyecto.version]);
 if(!historial.length)return null;
 return <section className="fairHistory"><h3>Correcciones de los profesores</h3>{historial.map(c=><details key={c.id}><summary>{c.nombre_docente} · {new Date(c.creado_en).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</summary>{Object.entries(c.despues).map(([campo,texto])=><section key={campo}><h4>{camposFeria.find(f=>f.id===campo)?.titulo||campo}</h4><p><b>Antes:</b> {c.antes[campo]||'Sin texto'}</p><p><b>Corrección:</b> {texto||'Sin texto'}</p></section>)}</details>)}</section>
}
export default function CorreccionProyecto({proyecto:p,origen='claudina',onGuardar,onVolver}){
 const externo=origen==='invitados',familiar=!externo&&esEmprendimiento(p);
 const campos=(familiar?camposEmprendimiento:camposFeria).filter(c=>c.id!=='integrantes'||externo);
 const textos=proyecto=>{const b=externo?proyecto.datos:proyecto;return Object.fromEntries(campos.map(c=>[c.id,c.id==='titulo'&&familiar?tituloFeria(proyecto):b[c.id]||'']))};
 const[datos,setDatos]=useState(()=>textos(p));
 const[decision,setDecision]=useState(''),[comentario,setComentario]=useState('');
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 const actual=useRef(p),contexto=useRef(null),solicitud=useRef(null),solicitudRevision=useRef(null);
 function cambiar(c,v){setDatos(d=>({...d,[c]:v}));solicitud.current=null;setError('')}
 async function guardar(e){
  e.preventDefault();if(busy)return;
  if(datos.poster_url?.trim()&&!enlacePosterValido(datos.poster_url.trim())){setError('Revisa el enlace al póster: debe comenzar por http:// o https://.');return}
  if(['ajustes','rechazado'].includes(decision)&&!comentario.trim()){setError('Escribe las observaciones para explicar esta decisión.');return}
  if(decision==='rechazado'&&!window.confirm('¿Rechazar este proyecto? Sus participantes podrán consultar el motivo.'))return;
  setBusy(true);setError('');let correccion=null,revision=null;
  try{
   const anteriores=textos(actual.current);
   const cambios=Object.fromEntries(Object.entries(datos).map(([k,v])=>[k,v.trim()]).filter(([k,v])=>v!==anteriores[k]));
   if(Object.keys(cambios).length){
    solicitud.current??=crypto.randomUUID();
    const r=await supabase.rpc('feria_corregir_proyecto',{origen,proyecto:p.id,datos:cambios,version_esperada:actual.current.version,solicitud:solicitud.current});
    if(r.error)throw r.error;
    actual.current=r.data.proyecto;contexto.current=r.data;correccion=solicitud.current;
    solicitud.current=null;
   }
   if(decision||comentario.trim()){
    solicitudRevision.current??=crypto.randomUUID();
    const r=await supabase.rpc(externo?'feria_externa_revisar':'feria_revisar',{proyecto:p.id,version_esperada:actual.current.version,decision:decision||actual.current.estado,comentario,solicitud:solicitudRevision.current});
    if(r.error)throw r.error;
    actual.current=r.data.proyecto;contexto.current=r.data;revision=solicitudRevision.current;
   }
   if(!contexto.current){setError('No hay cambios por guardar. Puedes corregir los textos, agregar observaciones o elegir una decisión.');return}
   const aviso=!externo&&(revision||correccion)?await notificarCambioFeria({tipo:revision?'revision':'correccion',solicitud:revision||correccion}):'';
   onGuardar(contexto.current,'Revisión guardada. Los textos y las observaciones están disponibles para sus participantes.'+aviso);
  }catch(e){
   const parcial=actual.current.version!==p.version;
   if(!externo&&correccion)await notificarCambioFeria({tipo:'correccion',solicitud:correccion});
   setError(parcial?'Los textos ya quedaron guardados, pero falta guardar la decisión o las observaciones. Puedes volver a pulsar Guardar revisión. '+e.message:/function|schema cache|does not exist/i.test(e.message||'')?'Activa el SQL feria-correcciones-docentes.sql para habilitar la edición de textos.':'No se guardó la revisión: '+e.message);
  }finally{setBusy(false)}
 }
 return <form className="fairForm fairUnifiedReview" lang="es-CO" onSubmit={guardar}>
  <h3>Revisar proyecto</h3><p className="fairHint">Corrige los textos directamente y añade tus observaciones en esta misma pantalla. Se conservarán el equipo, el asesor y la categoría. El estado solo cambiará si eliges una decisión. Las correcciones quedarán registradas con tu nombre.</p>
  <p className="fairSpellingHint">Revisión ortográfica en español activada. El navegador puede subrayar palabras y ofrecer sugerencias según su diccionario. Los cambios se guardan al pulsar Guardar revisión.</p>
  <fieldset disabled={busy}><legend>Textos del proyecto</legend>{campos.map(c=><label key={c.id}><span className="fairFieldTitle">{c.titulo}</span>{c.id==='poster_url'&&<><small className="fairFieldHelp">Este campo es opcional. Puedes guardarlo vacío.</small>{enlacePosterValido(datos.poster_url)&&<a href={datos.poster_url.trim()} target="_blank" rel="noopener noreferrer">Abrir póster para imprimir ↗</a>}</>}{c.corto?<input lang="es-CO" spellCheck={c.id!=='poster_url'} aria-label={c.titulo} type={c.id==='poster_url'?'text':c.tipo||'text'} inputMode={c.id==='poster_url'?'url':undefined} required={c.id==='titulo'} minLength={c.id==='titulo'?3:undefined} maxLength={c.max} value={datos[c.id]} onChange={e=>cambiar(c.id,e.target.value)}/>:<textarea lang="es-CO" spellCheck={true} aria-label={c.titulo} rows={4} maxLength={c.max} value={datos[c.id]} onChange={e=>cambiar(c.id,e.target.value)}/>}</label>)}</fieldset>
  <fieldset className="fairReviewDecision" disabled={busy}><legend>Decisión y observaciones</legend><label>Decisión<select aria-label={externo?'Decisión':'Decisión de revisión'} value={decision} onChange={e=>{setDecision(e.target.value);solicitudRevision.current=null;setError('')}}><option value="">Conservar estado actual: {estadosFeria[actual.current.estado]}</option>{Object.entries(estadosFeria).map(([id,nombre])=><option value={id} key={id}>{id==='aprobado'?'Aprobar proyecto':id==='rechazado'?'Rechazar proyecto':nombre}</option>)}</select></label><label>Observaciones<textarea aria-label="Observaciones" lang="es-CO" spellCheck={true} value={comentario} required={decision==='ajustes'||decision==='rechazado'} maxLength={4000} rows={4} onChange={e=>{setComentario(e.target.value);solicitudRevision.current=null;setError('')}} placeholder="Destaca lo que va bien y explica cómo pueden mejorar el proyecto."/></label></fieldset>
  {error&&<p className="error" role="alert">{error}</p>}<div className="fairSaveBar"><button className="fairPrimary" disabled={busy}>{busy?'Guardando revisión…':'Guardar revisión'}</button><button type="button" disabled={busy} onClick={onVolver}>Volver a proyectos</button></div>
 </form>;
}
