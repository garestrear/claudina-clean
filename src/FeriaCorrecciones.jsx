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
 const base=origen==='invitados'?p.datos:p,familiar=origen==='claudina'&&esEmprendimiento(p);
 const campos=(familiar?camposEmprendimiento:camposFeria).filter(c=>c.id!=='integrantes'||origen==='invitados');
 const[datos,setDatos]=useState(()=>Object.fromEntries(campos.map(c=>[c.id,c.id==='titulo'&&familiar?tituloFeria(p):base[c.id]||''])));
 const[busy,setBusy]=useState(false),[error,setError]=useState('');const solicitud=useRef(null);
 function cambiar(c,v){setDatos(d=>({...d,[c]:v}));solicitud.current=null;setError('')}
 async function guardar(e){e.preventDefault();if(busy)return;if(datos.poster_url?.trim()&&!enlacePosterValido(datos.poster_url.trim())){setError('Revisa el enlace al póster: debe comenzar por http:// o https://.');return}setBusy(true);setError('');try{
  solicitud.current=solicitud.current||crypto.randomUUID();
  const datosGuardar={...datos,poster_url:(datos.poster_url||'').trim()};
  if(!datosGuardar.poster_url&&!base.poster_url)delete datosGuardar.poster_url;
  const r=await supabase.rpc('feria_corregir_proyecto',{origen,proyecto:p.id,datos:datosGuardar,version_esperada:p.version,solicitud:solicitud.current});
  if(r.error)throw r.error;
  const aviso=origen==='claudina'&&r.data?.proyecto?.version>p.version?await notificarCambioFeria({tipo:'correccion',solicitud:solicitud.current}):'';
  onGuardar(r.data,'Correcciones guardadas. El proyecto conserva su estado.'+aviso);
 }catch(e){setError(/function|schema cache|does not exist/i.test(e.message||'')?'Activa el SQL feria-correcciones-docentes.sql para habilitar las correcciones.':'No se guardaron las correcciones: '+e.message)}finally{setBusy(false)}}
 return <form className="fairForm" onSubmit={guardar}><h3>Corregir textos del proyecto</h3><p className="fairHint">Puedes hacer pequeñas correcciones de escritura. Se conservarán el estado <b>{estadosFeria[p.estado]}</b>, el equipo, el asesor y la categoría. Se registrarán tu nombre y los textos corregidos.</p><fieldset disabled={busy}>{campos.map(c=><label key={c.id}><span className="fairFieldTitle">{c.titulo}</span>{c.id==='poster_url'&&<small className="fairFieldHelp">Puedes dejar este campo vacío. No necesitas un póster para guardar las correcciones.</small>}{c.corto?<input aria-label={c.titulo} type={c.id==='poster_url'?'text':c.tipo||'text'} inputMode={c.id==='poster_url'?'url':undefined} required={c.id==='titulo'} minLength={c.id==='titulo'?3:undefined} maxLength={c.max} value={datos[c.id]} onChange={e=>cambiar(c.id,e.target.value)}/>:<textarea aria-label={c.titulo} rows={4} maxLength={c.max} value={datos[c.id]} onChange={e=>cambiar(c.id,e.target.value)}/>}</label>)}</fieldset>{error&&<p className="error" role="alert">{error}</p>}<div className="fairSaveBar"><button className="fairPrimary" disabled={busy}>{busy?'Guardando…':'Guardar correcciones'}</button><button type="button" disabled={busy} onClick={onVolver}>Volver sin guardar</button></div></form>
}
