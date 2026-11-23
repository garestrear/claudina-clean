import React,{useEffect,useState} from 'react';
import {claveProyecto} from './evaluacionJurados.js';
import {supabase} from './lib/supabase';
import {nombreFeria} from './estiloTextoFeria.js';
import {clasificacionPremiacion,estudiantesPremiacion} from './premiacionJurados.js';
const puestos=['','Primer puesto','Segundo puesto','Tercer puesto','Cuarto puesto','Quinto puesto'];
const puntaje=n=>n.toLocaleString('es-CO',{minimumFractionDigits:2,maximumFractionDigits:2});
function ListaEstudiantesPremiacion({resultados}){
 const [participantes,setParticipantes]=useState(null);
 const [error,setError]=useState(false);
 const [intento,reintentar]=useState(0);
 const [cantidad,setCantidad]=useState("30");
 useEffect(()=>{
  let vigente=true;
  async function cargar(){
   try{
    const {data,error}=await supabase.rpc('feria_participantes_contexto');
    if(error||!data?.docente||!Array.isArray(data.participantes))throw new Error('Participantes no disponibles');
    if(vigente)setParticipantes(data.participantes);
   }catch{
    if(vigente)setError(true);
   }
  }
  cargar();
  return ()=>{vigente=false};
 },[intento]);
 const limite=Number(cantidad);
 const cantidadValida=Number.isSafeInteger(limite)&&limite>0;
 const lista=participantes&&cantidadValida?estudiantesPremiacion(resultados,participantes,limite):null;
 return <details className="juryAwardCategory">
  <summary>Estudiantes para la entrega de premios</summary>
  <div className="juryActions"><label>Cantidad de premios<input type="number" min="1" step="1" value={cantidad} onChange={e=>setCantidad(e.target.value)}/></label></div>
  <p>Lista general por promedio del proyecto. Cada estudiante aparece una vez, con su mejor resultado. A igual nota, se ordena por título del proyecto y luego por nombre del estudiante.</p>
  {error?<p role="alert">No se pudieron cargar los participantes. <button type="button" onClick={()=>{setError(false);reintentar(n=>n+1)}}>Reintentar</button></p>
   :!cantidadValida?<p role="status">Ingresa una cantidad entera mayor que cero.</p>
   :!lista?<p role="status">Cargando participantes…</p>
   :<>
    <p>{lista.estudiantes.length} de {limite} estudiantes.</p>
    {lista.empateCorte&&<p role="status">Hay empate de promedio en el corte de {limite}. Revisa el orden antes de la entrega.</p>}
    {!!lista.sinEquipo.length&&<p role="status">Revisa los proyectos calificados sin expositores vinculados: {lista.sinEquipo.join('; ')}.</p>}
    <ol>{lista.estudiantes.map(({persona,proyecto})=><li key={persona.estudiante_id}><strong>{nombreFeria(persona.nombre)}</strong>{persona.grado?' · '+persona.grado:''} · {proyecto.titulo} · {puntaje(proyecto.promedio)} / 100</li>)}</ol>
   </>}
 </details>;
}
export default function PremiacionJurados({resultados}){
 const [categoria,setCategoria]=useState('todas'),[inverso,setInverso]=useState(false);
 const grupos=clasificacionPremiacion(resultados),visibles=grupos.filter(c=>categoria==='todas'||c.categoria===categoria);
 return <section className="juryAwards" aria-label="Resultados para la premiación"><h2>Premiación por categoría</h2><ListaEstudiantesPremiacion resultados={resultados}/><p>Los cinco primeros puestos según el promedio actual sobre 100. Incluye notas enviadas, evaluaciones en papel y borradores con nota. Los promedios parciales pueden cambiar al completar las evaluaciones.</p><div className="juryActions"><label>Categoría de premiación<select value={categoria} onChange={e=>setCategoria(e.target.value)}><option value="todas">Todas las categorías</option>{grupos.map(c=><option key={c.categoria} value={c.categoria}>{c.nombre}</option>)}</select></label><button type="button" aria-pressed={inverso} onClick={()=>setInverso(v=>!v)}>{inverso?'Mostrar del primero al quinto':'Leer del quinto al primero'}</button></div>{!grupos.length&&<p>Aún no hay proyectos para la premiación.</p>}{visibles.map(c=><section className="juryAwardCategory" key={c.categoria}><h3>{c.nombre}</h3>{!c.clasificados.length?<p>Aún no hay calificaciones en esta categoría.</p>:<>{c.clasificados.some(p=>p.empate)&&<p>Los proyectos con igual promedio comparten puesto. Se incluyen todos los empatados dentro de los primeros cinco puestos.</p>}<ol className="juryAwardList">{(inverso?[...c.clasificados].reverse():c.clasificados).map(p=><li value={p.puesto} key={claveProyecto(p)}><article className="juryAwardCard"><div className="juryAwardPlace">{puestos[p.puesto]}{p.empate?' · Empate':''}</div><h4>{p.titulo}</h4><p className="juryAwardTeam"><strong>Integrantes:</strong> {p.integrantes||'Integrantes por confirmar'}</p><p className="juryAwardScore">{puntaje(p.promedio)} <span>/ 100 puntos</span></p><p className="juryAwardStatus">{p.evaluadas} {p.evaluadas===1?'nota incluida':'notas incluidas'} · {p.evaluadas<3||p.borradores?'Promedio parcial':'Promedio completo'}{p.borradores?` · ${p.borradores} ${p.borradores===1?'borrador con nota':'borradores con nota'}`:''}{p.codigo?` · ${p.codigo}`:''}</p></article></li>)}</ol></>}{c.sinNota>0&&<p>{c.sinNota} {c.sinNota===1?'proyecto sin nota, pendiente de clasificación.':'proyectos sin nota, pendientes de clasificación.'}</p>}{['puentes_juvenil','puentes_infantil'].includes(c.categoria)&&<p>Estos puestos corresponden a la evaluación del proyecto por jurados. La clasificación por carga soportada se consulta en el concurso de puentes.</p>}</section>)}</section>;
}
