import React,{useEffect,useState} from 'react';
import {supabase} from './lib/supabase';
import {disponibilidadEspacio,horaCorta} from './programacionFeria.js';
export default function FeriaAulaRevision({proyecto,origen,value,onChange,disabled}){
 const[datos,setDatos]=useState(null),[error,setError]=useState(''),[cargando,setCargando]=useState(true),[intento,setIntento]=useState(0);
 useEffect(()=>{let activo=true;setCargando(true);setError('');supabase.rpc('feria_revision_aulas_contexto').then(r=>{if(r.error)throw r.error;if(activo)setDatos(r.data)}).catch(e=>{if(activo)setError(/function|schema cache|does not exist/i.test(e.message||'')?'Activa feria-revision-aula.sql en Supabase para escoger el aula desde la revisión.':e.message)}).finally(()=>{if(activo)setCargando(false)});return()=>{activo=false}},[proyecto,origen,intento]);
 const reserva=datos?.programacion.filter(r=>r.activo&&r.origen===origen&&r.proyecto_id===proyecto&&r.fecha===datos.tramo.fecha).sort((a,b)=>a.inicio.localeCompare(b.inicio)||a.id.localeCompare(b.id))[0];
 return <fieldset disabled={disabled}><legend>Aula o lugar de exposición</legend>
 <p className="fairFieldHelp">Al aprobar se asigna automáticamente un espacio con cupo. Puedes escoger otro aquí; se guardará junto con la revisión.</p>
 {cargando?<p role="status">Consultando aulas…</p>:error?<><p role="alert">{error}</p><button type="button" onClick={()=>setIntento(n=>n+1)}>Reintentar aulas</button></>:<>
 <p>{reserva?`Ubicación actual: ${reserva.espacio_nombre}.`:'El proyecto todavía no tiene un aula asignada.'} Horario de exposiciones: {datos.tramo.fecha}, {horaCorta(datos.tramo.inicio)}–{horaCorta(datos.tramo.fin)}.</p>
 <label>Aula, salón o lugar<select aria-label="Aula, salón o lugar" value={value?.aula||''} onChange={e=>onChange(e.target.value?{aula:e.target.value,reserva:reserva?.id||null,version_reserva:reserva?.version||null}:null)}>
 <option value="">{reserva?'Conservar ubicación actual':'Asignar automáticamente al aprobar'}</option>
 {datos.espacios.filter(e=>e.activo&&e.cupos>1).map(e=>{const d=disponibilidadEspacio(e,datos.programacion,reserva||datos.tramo,reserva?.id);return <option key={e.id} value={e.id} disabled={['lleno','exclusivo','inactivo'].includes(d.estado)}>{e.nombre} · {d.texto}</option>})}
 </select></label><button type="button" onClick={()=>{onChange(null);setIntento(n=>n+1)}}>Actualizar aulas</button>
 </>}
 </fieldset>;
}
