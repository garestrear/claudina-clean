import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {descargarCartaJurado} from './cartaJurado.js';
import {feriaEvento} from './feriaEvento.js';
import './FeriaJurados.css';
const porPagina=30;
const fecha=v=>new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'medium'}).format(new Date(v));
export default function FeriaJurados(){
 const [lista,setLista]=useState([]),[total,setTotal]=useState(0),[pagina,setPagina]=useState(0),[cargando,setCargando]=useState(true),[error,setError]=useState(''),[descargando,setDescargando]=useState(null),[mensaje,setMensaje]=useState('');
 const peticion=useRef(0);
 async function cargar(){const actual=++peticion.current;setCargando(true);setError('');try{
  const {data,error,count}=await supabase.from('feria_jurados').select('id,nombre,institucion,profesion,correo,telefono,creado_en',{count:'exact'}).order('creado_en',{ascending:false}).order('id').range(pagina*porPagina,(pagina+1)*porPagina-1);
  if(actual!==peticion.current)return;if(error)throw error;setLista(data||[]);setTotal(count??data?.length??0);
 }catch{if(actual===peticion.current)setError('No se pudieron consultar las postulaciones de jurados. Revisa tu conexión e intenta de nuevo.')}finally{if(actual===peticion.current)setCargando(false)}}
 useEffect(()=>{cargar();return()=>{peticion.current++}},[pagina]);
 async function descargar(persona){if(descargando)return;setDescargando(persona.id);setError('');setMensaje('');try{await descargarCartaJurado(persona);setMensaje(`Carta de ${persona.nombre} lista para enviar.`)}catch(e){setError('No se pudo generar la carta. '+(e.message||'Intenta nuevamente.'))}finally{setDescargando(null)}}
 return <section className="fairSection fairJurados" aria-labelledby="jurados-titulo"><div className="fairListHeading"><div><h2 id="jurados-titulo">Jurados inscritos</h2><p>Personas que se han postulado para valorar los proyectos de la feria.</p></div><button type="button" disabled={cargando} onClick={cargar}>{cargando?'Consultando…':'Actualizar jurados'}</button></div>
 <p className="fairHint">La postulación no confirma la participación. Descarga la carta de cada persona para invitarla y coordinar su disponibilidad.</p>
 <p className="juryEvent"><strong>{feriaEvento.nombre}</strong> · {feriaEvento.fecha} · {feriaEvento.horario}<br/>{feriaEvento.lugar}</p>
 {error&&<p className="error" role="alert">{error}</p>}{mensaje&&<p className="fairMessage" role="status">{mensaje}</p>}
 {cargando?<p role="status">Cargando personas inscritas…</p>:error&&!lista.length?<button type="button" onClick={cargar}>Reintentar</button>:<><p className="juryCount"><strong>{total}</strong> {total===1?'persona inscrita':'personas inscritas'}</p>{lista.length?<div className="fairGrid">{lista.map(p=><article className="fairCard juryCard" key={p.id}><span className="fairStatus">Candidato a jurado</span><h3>{p.nombre}</h3><dl><dt>Institución</dt><dd>{p.institucion}</dd><dt>Profesión</dt><dd>{p.profesion}</dd><dt>Correo</dt><dd><a href={'mailto:'+p.correo}>{p.correo}</a></dd><dt>Teléfono</dt><dd>{p.telefono}</dd></dl><small>Inscripción: {fecha(p.creado_en)}</small><button type="button" className="fairPrimary" disabled={Boolean(descargando)} aria-label={`Descargar carta PDF para ${p.nombre}`} onClick={()=>descargar(p)}>{descargando===p.id?'Generando PDF…':'Descargar carta de invitación PDF'}</button></article>)}</div>:<p className="fairEmpty">Aún no hay personas inscritas como candidatas a jurado.</p>}
 {total>porPagina&&<nav className="juryPagination" aria-label="Páginas de jurados"><button type="button" disabled={pagina===0} onClick={()=>setPagina(p=>p-1)}>Anterior</button><span>Página {pagina+1} de {Math.ceil(total/porPagina)}</span><button type="button" disabled={(pagina+1)*porPagina>=total} onClick={()=>setPagina(p=>p+1)}>Siguiente</button></nav>}</>}
 </section>;
}
