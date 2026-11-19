import React,{useEffect,useMemo,useState} from 'react';
import {useGruposDocente} from './GruposDocente';
import {supabase} from './lib/supabase';
import {cargarLimiteNotasAseo,cargarParticipacionesAseo,notasConRecuperaciones} from './recuperacionesAseo';
import {formatoPromedioAseo,resumirNotasAseo} from './promedioAseo';
import FiltroGrado from './FiltroGrado';
import {nombreGrupo} from '../lib/gruposDocente.js';
import {descargarConsolidadoAseo} from './exportarAseo';

const etiqueta={cumplio:'Cumplió',no_cumplio:'No cumplió',ausente:'Ausente'};

async function todasParticipaciones(){
  return notasConRecuperaciones(await cargarParticipacionesAseo()).filter(p=>p.notaEfectiva!=null);
}

function DetalleNotas({filas,elegidas}){
  return <div className="gradesTableWrap"><table className="gradesTable">
    <thead><tr><th>Fecha</th><th>Resultado</th><th>Calificación</th><th>En el promedio</th></tr></thead>
    <tbody>{[...filas].sort((a,b)=>b.registros_aseo.fecha.localeCompare(a.registros_aseo.fecha)).map(p=>
      <tr key={p.id}><td>{p.registros_aseo.fecha}</td><td>{etiqueta[p.estado]||'Sin estado'}
        {p.recuperacion&&<small> · Recuperado el {p.recuperacion.registros_aseo.fecha} (antes: 2/10)</small>}
      </td><td>{p.notaEfectiva}/10</td><td>{elegidas.has(p)?'Sí':'No'}</td></tr>
    )}</tbody>
  </table></div>;
}

export function CalificacionesEstudiante({ficha}){
  const [estado,setEstado]=useState({});
  useEffect(()=>{
    let activo=true;
    setEstado({});
    Promise.all([todasParticipaciones(),cargarLimiteNotasAseo()])
      .then(([filas,limite])=>{
        if(activo)setEstado({filas:filas.filter(p=>p.estudiante_id===ficha.id),limite});
      })
      .catch(error=>{if(activo)setEstado({error:error.message})});
    return ()=>{activo=false};
  },[ficha.id]);
  const {filas,limite,error}=estado;
  const resumen=resumirNotasAseo(filas||[],limite);
  return <article className="card"><h3>📈 Mis calificaciones de aseo</h3>
    {error?<p className="error">No se pudieron cargar las calificaciones: {error}</p>
      :!filas?<p>Cargando notas…</p>
      :filas.length?<><p><b>Promedio: {formatoPromedioAseo(resumen.promedio)}/10</b> · {resumen.usadas} de {resumen.total} notas</p>
        <DetalleNotas filas={filas} elegidas={resumen.elegidas}/></>
      :<p>Aún no tienes aseos calificados.</p>}
  </article>;
}

export function ConsolidadoAseo(){
  const {coincideGrado}=useGruposDocente();
  const [estudiantes,setEstudiantes]=useState([]),[filas,setFilas]=useState([]);
  const [grado,setGrado]=useState('todos'),[desde,setDesde]=useState(''),[hasta,setHasta]=useState('');
  const [seleccion,setSeleccion]=useState(null),[error,setError]=useState(''),[cargando,setCargando]=useState(true);
  const [limite,setLimite]=useState(null),[cantidad,setCantidad]=useState(''),[guardando,setGuardando]=useState(false);
  const [mensaje,setMensaje]=useState(''),[exportando,setExportando]=useState(false),[errorExcel,setErrorExcel]=useState('');

  useEffect(()=>{
    let activo=true;
    Promise.all([
      supabase.from('estudiantes').select('id,nombre,grado,activo').order('nombre'),
      todasParticipaciones(),cargarLimiteNotasAseo(),
    ]).then(([{data,error},datos,limiteGuardado])=>{
      if(error)throw error;
      if(activo){
        setEstudiantes(data||[]);
        setFilas(datos);
        setLimite(limiteGuardado);
        setCantidad(limiteGuardado==null?'':String(limiteGuardado));
      }
    }).catch(e=>{if(activo)setError(e.message)})
      .finally(()=>{if(activo)setCargando(false)});
    return ()=>{activo=false};
  },[]);

  const porEstudiante=useMemo(()=>{
    const grupos=new Map();
    for(const p of filas){
      const fecha=p.registros_aseo.fecha;
      if((desde&&fecha<desde)||(hasta&&fecha>hasta))continue;
      if(!grupos.has(p.estudiante_id))grupos.set(p.estudiante_id,[]);
      grupos.get(p.estudiante_id).push(p);
    }
    return grupos;
  },[filas,desde,hasta]);

  const resultados=estudiantes.filter(s=>coincideGrado(grado,s.grado)).map(estudiante=>{
    const notas=porEstudiante.get(estudiante.id)||[];
    return {estudiante,notas,...resumirNotasAseo(notas,limite),
      cumplio:notas.filter(p=>p.estado==='cumplio').length,
      noCumplio:notas.filter(p=>p.estado==='no_cumplio').length,
      ausente:notas.filter(p=>p.estado==='ausente').length};
  });
  const detalle=resultados.find(r=>r.estudiante.id===seleccion);
  const fechasValidas=!desde||!hasta||desde<=hasta;

  async function guardar(e){
    e.preventDefault();
    if(guardando)return;
    setMensaje('');
    setGuardando(true);
    try{
      const {data,error}=await supabase.rpc('aseo_guardar_mejores_notas',{cantidad:cantidad===''?null:Number(cantidad)});
      if(error)throw error;
      setLimite(data);
      setCantidad(data==null?'':String(data));
      setMensaje('Criterio de cálculo guardado.');
    }catch(e){
      setMensaje(e.code==='PGRST202'
        ?'Para guardar el criterio, primero aplica aseo-mejores-notas.sql en Supabase.'
        :'No se pudo guardar el criterio: '+e.message);
    }finally{setGuardando(false)}
  }

  async function descargar(){
    setErrorExcel('');
    setExportando(true);
    try{await descargarConsolidadoAseo(resultados,grado,desde,hasta,limite)}
    catch(e){setErrorExcel('No se pudo generar el Excel: '+e.message)}
    finally{setExportando(false)}
  }

  return <section><h2>📈 Consolidado de calificaciones</h2>
    <p>Una recuperación reemplaza la nota original. Cada ausencia o incumplimiento pendiente cuenta como 2/10.</p>
    {error?<p className="error">No se pudo cargar el consolidado: {error}</p>
      :cargando?<p role="status">Cargando calificaciones…</p>:<>
      <form className="card" onSubmit={guardar}>
        <h3>Configuración del promedio de aseo</h3>
        <label>Cuántas de las mejores notas usar
          <input type="number" min="1" max="2147483647" step="1" value={cantidad}
            disabled={guardando} onChange={e=>setCantidad(e.target.value)}/>
        </label>
        <p>Déjalo vacío para usar todas las notas. Si hay menos notas que la cantidad indicada, se usan las disponibles. El criterio se aplica a todos los grupos.</p>
        <button type="submit" disabled={guardando||exportando||cantidad===(limite==null?'':String(limite))}>
          {guardando?'Guardando…':'Guardar criterio'}
        </button>
        {mensaje&&<p role="status">{mensaje}</p>}
      </form>
      <p><b>Criterio actual:</b> {limite==null?'Todas las notas':`Las mejores ${limite} notas`}</p>
      <FiltroGrado valor={grado} cambiar={setGrado}/>
      <div className="gradesFilters">
        <label>Desde<input type="date" value={desde} onChange={e=>setDesde(e.target.value)}/></label>
        <label>Hasta<input type="date" value={hasta} onChange={e=>setHasta(e.target.value)}/></label>
      </div>
      <button type="button" disabled={!resultados.length||!fechasValidas||exportando||guardando} onClick={descargar}>
        {exportando?'Generando Excel…':'Descargar resultados en Excel'}
      </button>
      {errorExcel&&<p role="alert">{errorExcel}</p>}
      {!fechasValidas?<p role="alert">La fecha inicial debe ser anterior o igual a la final.</p>
        :!resultados.length?<p>No hay estudiantes en el grupo seleccionado.</p>:<>
        <div className="gradesTableWrap"><table className="gradesTable">
          <thead><tr><th>Estudiante</th><th>Grado</th><th>Aseos</th><th>Notas usadas</th>
            <th>Cumplió</th><th>No cumplió</th><th>Ausente</th><th>Promedio</th></tr></thead>
          <tbody>{resultados.map(({estudiante:s,total,usadas,cumplio,noCumplio,ausente,promedio})=>
            <tr key={s.id}><td><button type="button" onClick={()=>setSeleccion(s.id)}>{s.nombre}</button>
              {!s.activo?' (retirado)':''}</td><td>{nombreGrupo(String(s.grado))}</td>
              <td>{total}</td><td>{usadas}</td><td>{cumplio}</td><td>{noCumplio}</td><td>{ausente}</td>
              <td><b>{formatoPromedioAseo(promedio)}</b></td></tr>
          )}</tbody>
        </table></div>
        {detalle&&<article className="card"><h3>Detalle: {detalle.estudiante.nombre}</h3>
          {detalle.total?<DetalleNotas filas={detalle.notas} elegidas={detalle.elegidas}/>
            :<p>No hay aseos calificados en este período.</p>}
        </article>}
      </>}
    </>}
  </section>;
}
