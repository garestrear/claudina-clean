import FeriaEquipoDocente from './FeriaEquipoDocente.jsx';
import FeriaAulaRevision from './FeriaAulaRevision.jsx';
import {textoUbicacion} from './ubicacionFeria.js';
import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {notificarCambioFeria} from './notificacionFeria.js';
import {camposFeria,enlacePosterValido,estadosFeria,areasSteam} from './feriaCiencia.js';
import {camposEmprendimiento,esEmprendimiento,tituloFeria} from './feriaFamilias.js';
export function HistorialCorrecciones({proyecto,origen='claudina'}){
 const[historial,setHistorial]=useState([]);
 useEffect(()=>{let activo=true;supabase.rpc('feria_correcciones_contexto',{origen,proyecto:proyecto.id}).then(r=>{if(activo)setHistorial(r.error?[]:r.data||[])}).catch(()=>{if(activo)setHistorial([])});return()=>{activo=false}},[origen,proyecto.id,proyecto.version]);
 if(!historial.length)return null;
 return <section className="fairHistory"><h3>Correcciones de los profesores</h3>{historial.map(c=><details key={c.id}><summary>{c.nombre_docente} · {new Date(c.creado_en).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</summary>{Object.entries(c.despues).map(([campo,texto])=><section key={campo}><h4>{campo==='tipo_participacion'?'Tipo de participación':campo==='areas'?'Áreas STEAM':camposFeria.find(f=>f.id===campo)?.titulo||campo}</h4><p><b>Antes:</b> {Array.isArray(c.antes[campo])?c.antes[campo].map(v=>areasSteam.find(a=>a.id===v)?.es||v).join(', '):c.antes[campo]==='familiar'?'Emprendimiento familiar':c.antes[campo]==='estudiantil'?'Proyecto estudiantil':c.antes[campo]||'Sin texto'}</p><p><b>Corrección:</b> {Array.isArray(texto)?texto.map(v=>areasSteam.find(a=>a.id===v)?.es||v).join(', '):texto==='familiar'?'Emprendimiento familiar':texto==='estudiantil'?'Proyecto estudiantil':texto||'Sin texto'}</p></section>)}</details>)}</section>
}
export default function CorreccionProyecto({proyecto:p,origen='claudina',onGuardar,onVolver,integrantes=[]}){
 const externo=origen==='invitados';
 const[equipo,setEquipo]=useState([...(p.integrantes_ids||[])]);
 const solicitudEquipo=useRef(null);
 const[tipo,setTipo]=useState(esEmprendimiento(p)?'familiar':'estudiantil');
 const[areas,setAreas]=useState([...(p.areas||[])]);
 const familiar=!externo&&tipo==='familiar';
 const campos=(familiar?camposEmprendimiento:camposFeria).filter(c=>c.id!=='integrantes'||externo);
 const textos=proyecto=>{const b=externo?proyecto.datos:proyecto;const todos=[...new Map([...camposFeria,...camposEmprendimiento].map(c=>[c.id,c])).values()].filter(c=>c.id!=='integrantes'||externo);return Object.fromEntries(todos.map(c=>[c.id,c.id==='titulo'&&!externo?tituloFeria(proyecto):b[c.id]||'']))};
 const[datos,setDatos]=useState(()=>textos(p));
 const[decision,setDecision]=useState(''),[comentario,setComentario]=useState('');
 const[aula,setAula]=useState(null),[consultaAulas,setConsultaAulas]=useState(0);
 const[busy,setBusy]=useState(false),[error,setError]=useState('');
 const actual=useRef(p),contexto=useRef(null),solicitud=useRef(null),solicitudRevision=useRef(null),solicitudTipo=useRef(null);
 function cambiar(c,v){setDatos(d=>({...d,[c]:v}));solicitud.current=null;setError('')}
 async function guardar(e){
  e.preventDefault();if(busy)return;
  if(datos.poster_url?.trim()&&!enlacePosterValido(datos.poster_url.trim())){setError('Revisa el enlace al póster: debe comenzar por http:// o https://.');return}
  if(['ajustes','rechazado'].includes(decision)&&!comentario.trim()){setError('Escribe las observaciones para explicar esta decisión.');return}
  if(decision==='rechazado'&&!window.confirm('¿Rechazar este proyecto? Sus participantes podrán consultar el motivo.'))return;
  setBusy(true);setError('');let correccion=null,revision=null;
  try{
   if(!externo&&JSON.stringify([...equipo].sort())!==JSON.stringify([...(actual.current.integrantes_ids||[])].sort())){
    if(!equipo.length)throw new Error('Debe quedar al menos un integrante en el proyecto.');
    solicitudEquipo.current??=crypto.randomUUID();
    const r=await supabase.rpc('feria_docente_integrantes',{proyecto:p.id,equipo,version_esperada:actual.current.version,solicitud:solicitudEquipo.current});
    if(r.error&&/function|schema cache|does not exist/i.test(r.error.message||''))throw new Error('Activa supabase/feria-integrantes-docentes.sql en Supabase para editar integrantes.');
    if(r.error)throw r.error;
    actual.current=r.data.proyecto;contexto.current=r.data;correccion=solicitudEquipo.current;solicitudEquipo.current=null;
   }
   const tipoActual=esEmprendimiento(actual.current)?'familiar':'estudiantil';
   if(!externo&&(tipo!==tipoActual||JSON.stringify(areas)!==JSON.stringify(actual.current.areas||[]))){
    if(!areas.length)throw new Error('Selecciona al menos un área STEAM.');
    solicitudTipo.current??=crypto.randomUUID();
    const r=await supabase.rpc('feria_cambiar_tipo',{proyecto:p.id,tipo,areas,version_esperada:actual.current.version,solicitud:solicitudTipo.current});
    if(r.error&&/function|schema cache|does not exist/i.test(r.error.message||''))throw new Error('Ejecuta supabase/feria-cambiar-tipo.sql en Supabase para habilitar el cambio de tipo y áreas.');
    if(r.error)throw r.error;
    actual.current=r.data.proyecto;contexto.current=r.data;correccion=solicitudTipo.current;solicitudTipo.current=null;
   }
   const anteriores=textos(actual.current);
   const cambios=Object.fromEntries(Object.entries(datos).map(([k,v])=>[k,v.trim()]).filter(([k,v])=>v!==anteriores[k]));
   if(Object.keys(cambios).length){
    solicitud.current??=crypto.randomUUID();
    const r=await supabase.rpc('feria_corregir_proyecto',{origen,proyecto:p.id,datos:cambios,version_esperada:actual.current.version,solicitud:solicitud.current});
    if(r.error)throw r.error;
    actual.current=r.data.proyecto;contexto.current=r.data;correccion=solicitud.current;
    solicitud.current=null;
   }
   if(decision||comentario.trim()||aula){
    solicitudRevision.current??=crypto.randomUUID();
    const r=await supabase.rpc(aula?'feria_revision_con_aula':externo?'feria_externa_revisar':'feria_revisar',{proyecto:p.id,version_esperada:actual.current.version,decision:aula?(decision||null):decision||actual.current.estado,comentario,solicitud:solicitudRevision.current,...(aula?{origen,...aula}:{})});
    if(r.error&&aula&&/function|schema cache|does not exist/i.test(r.error.message||''))throw new Error('Activa feria-revision-aula.sql en Supabase para guardar el aula seleccionada.');
    if(r.error)throw r.error;
    actual.current=r.data.proyecto;contexto.current=r.data;revision=decision||comentario.trim()?solicitudRevision.current:null;
   }
   if(!contexto.current){setError('No hay cambios por guardar. Puedes corregir los textos, agregar observaciones o elegir una decisión.');return}
   const aviso=!externo&&(revision||correccion)?await notificarCambioFeria({tipo:revision?'revision':'correccion',solicitud:revision||correccion}):'';
   let ubicacion='';
   if(actual.current.estado==='aprobado'){
    try{const r=await supabase.rpc('feria_asegurar_ubicacion_proyecto',{fuente:origen,proyecto:p.id});if(r.error)throw r.error;ubicacion=' '+(r.data.asignado?textoUbicacion(r.data)+'.':r.data.mensaje)}catch(e){ubicacion=' La revisión quedó guardada, pero no se pudo confirmar el aula. '+(/function|schema cache|does not exist/i.test(e.message||'')?'Activa feria-ubicacion-credenciales.sql en Supabase.':e.message)}
   }
   setAula(null);setConsultaAulas(n=>n+1);
   onGuardar(contexto.current,'Revisión guardada. Los textos y las observaciones están disponibles para sus participantes.'+ubicacion+aviso);
  }catch(e){
   const parcial=actual.current.version!==p.version;
   if(!externo&&correccion)await notificarCambioFeria({tipo:'correccion',solicitud:correccion});
   setError(parcial?'Algunos cambios ya quedaron guardados, pero falta completar la revisión. Puedes volver a pulsar Guardar revisión. '+e.message:/function|schema cache|does not exist/i.test(e.message||'')?'Activa el SQL feria-correcciones-docentes.sql para habilitar la edición de textos.':'No se guardó la revisión: '+e.message);
  }finally{setBusy(false)}
 }
 return <form className="fairForm fairUnifiedReview" lang="es-CO" onSubmit={guardar}>
  <h3>Revisar proyecto</h3><p className="fairHint">Corrige los textos directamente y añade tus observaciones en esta misma pantalla. Puedes corregir el tipo de participación y las áreas STEAM. Puedes agregar o quitar integrantes del equipo. Se conservará el asesor. El estado solo cambiará si eliges una decisión. Las correcciones quedarán registradas con tu nombre.</p>
  <p className="fairSpellingHint">Revisión ortográfica en español activada. El navegador puede subrayar palabras y ofrecer sugerencias según su diccionario. Los cambios se guardan al pulsar Guardar revisión.</p>
  {!externo&&<fieldset disabled={busy}><legend>Tipo de participación y áreas</legend><label>Tipo de participación<select aria-label="Tipo de participación" value={tipo} onChange={e=>{setTipo(e.target.value);solicitudTipo.current=null;solicitud.current=null;setError('')}}><option value="estudiantil">Proyecto estudiantil</option><option value="familiar">Emprendimiento familiar</option></select></label><p className="fairHint">Elige el tipo correcto y sus áreas. La placa y la clasificación usarán la nueva categoría; si ya imprimiste documentos, vuelve a generarlos después de guardar.</p><div className="fairAreas">{areasSteam.map(a=><button type="button" key={a.id} aria-pressed={areas.includes(a.id)} onClick={()=>{setAreas(v=>v.includes(a.id)?v.filter(x=>x!==a.id):[...v,a.id]);solicitudTipo.current=null;setError('')}}>{areas.includes(a.id)?'✓ ':''}{a.nombre} · {a.es}</button>)}</div></fieldset>}
  {!externo&&<FeriaEquipoDocente value={equipo} integrantes={integrantes} disabled={busy} onChange={v=>{setEquipo(v);solicitudEquipo.current=null;setError('')}}/>}
  <fieldset disabled={busy}><legend>Textos del proyecto</legend>{campos.map(c=><label key={c.id}><span className="fairFieldTitle">{c.titulo}</span>{c.id==='poster_url'&&<><small className="fairFieldHelp">Este campo es opcional. Puedes guardarlo vacío.</small>{enlacePosterValido(datos.poster_url)&&<a href={datos.poster_url.trim()} target="_blank" rel="noopener noreferrer">Abrir póster para imprimir ↗</a>}</>}{c.corto?<input lang="es-CO" spellCheck={c.id!=='poster_url'} aria-label={c.titulo} type={c.id==='poster_url'?'text':c.tipo||'text'} inputMode={c.id==='poster_url'?'url':undefined} required={c.id==='titulo'} minLength={c.id==='titulo'?3:undefined} maxLength={c.max} value={datos[c.id]} onChange={e=>cambiar(c.id,e.target.value)}/>:<textarea lang="es-CO" spellCheck={true} aria-label={c.titulo} rows={4} maxLength={c.max} value={datos[c.id]} onChange={e=>cambiar(c.id,e.target.value)}/>}</label>)}</fieldset>
  <fieldset className="fairReviewDecision" disabled={busy}><legend>Decisión y observaciones</legend><label>Decisión<select aria-label={externo?'Decisión':'Decisión de revisión'} value={decision} onChange={e=>{setDecision(e.target.value);setAula(null);solicitudRevision.current=null;setError('')}}><option value="">Conservar estado actual: {estadosFeria[actual.current.estado]}</option>{Object.entries(estadosFeria).map(([id,nombre])=><option value={id} key={id}>{id==='aprobado'?'Aprobar proyecto':id==='rechazado'?'Rechazar proyecto':nombre}</option>)}</select></label><label>Observaciones<textarea aria-label="Observaciones" lang="es-CO" spellCheck={true} value={comentario} required={decision==='ajustes'||decision==='rechazado'} maxLength={4000} rows={4} onChange={e=>{setComentario(e.target.value);solicitudRevision.current=null;setError('')}} placeholder="Destaca lo que va bien y explica cómo pueden mejorar el proyecto."/></label></fieldset>
  {(decision||actual.current.estado)==='aprobado'&&<FeriaAulaRevision key={p.id+':'+origen+':'+consultaAulas} proyecto={p.id} origen={origen} value={aula} disabled={busy} onChange={valor=>{setAula(valor);solicitudRevision.current=null;setError('')}}/>}
  {error&&<p className="error" role="alert">{error}</p>}<div className="fairSaveBar"><button className="fairPrimary" disabled={busy}>{busy?'Guardando revisión…':'Guardar revisión'}</button><button type="button" disabled={busy} onClick={onVolver}>Volver a proyectos</button></div>
 </form>;
}
