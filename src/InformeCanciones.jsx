import React,{useState} from 'react';
import {supabase} from './lib/supabase';
import {coincideGrado} from './FiltroGrado';
import {nombreGrupo} from '../lib/gruposDocente.js';

export default function InformeCanciones({canciones,grupos,soloUnaCancion=false}){
  const [seleccion,setSeleccion]=useState('todos');
  const [descargando,setDescargando]=useState(false);
  const [mensaje,setMensaje]=useState('');
  const grados=[6,7,8].filter(grado=>grupos.some(grupo=>coincideGrado(grupo,grado)));
  const opciones=grupos.includes('7-8')?[...grados,'7-8']:grados;
  const elegidos=grados.filter(grado=>coincideGrado(seleccion,grado));
  const actividades=canciones.flatMap(cancion=>cancion.actividades
    .filter(actividad=>actividad.grados.some(grado=>elegidos.includes(grado)))
    .map(actividad=>({...actividad,cancion:cancion.titulo})));

  async function descargar(){
    if(descargando||!actividades.length)return;
    setDescargando(true);
    setMensaje('');
    try{
      const {data:estudiantes,error}=await supabase.from('estudiantes')
        .select('id,nombre,grado').eq('activo',true).in('grado',elegidos).order('nombre').order('id');
      if(error)throw error;
      const aplicables=actividades.filter(actividad=>estudiantes.some(estudiante=>actividad.grados.includes(estudiante.grado)));
      if(!aplicables.length){
        setMensaje('No hay estudiantes activos con actividades para la selección.');
        return;
      }

      const resultados=new Map();
      for(const actividad of aplicables){
        const {data,error}=await supabase.rpc('ingles_resultados',{actividad:actividad.id});
        if(error)throw new Error(actividad.titulo+': '+error.message);
        resultados.set(actividad.id,data||[]);
      }

      const {descargarInformeCanciones}=await import('./exportarInformeCanciones.js');
      await descargarInformeCanciones({estudiantes,actividades:aplicables,resultados,grupo:seleccion,
        cancion:soloUnaCancion?canciones[0].titulo:null});
      setMensaje('Informe de canciones descargado.');
    }catch(error){
      setMensaje('No se pudo descargar el informe: '+error.message);
    }finally{
      setDescargando(false);
    }
  }

  return <section className="card" aria-label="Informe de canciones">
    <h3>{soloUnaCancion?'Informe de esta canción':'Informe de todas las canciones'}</h3>
    <p>Incluye una fila por estudiante y actividad, con el estado, los intentos y los puntajes. El Excel trae una hoja por grado.</p>
    <div className="chips">
      <label>Grupo del informe
        <select value={seleccion} onChange={e=>{setSeleccion(e.target.value);setMensaje('')}} disabled={descargando}>
          <option value="todos">Mis grupos</option>
          {opciones.map(grupo=><option key={grupo} value={grupo}>{nombreGrupo(String(grupo))}</option>)}
        </select>
      </label>
      <button type="button" onClick={descargar} disabled={descargando||!actividades.length}>
        {descargando?'Generando Excel…':'Descargar informe en Excel'}
      </button>
    </div>
    {!actividades.length&&<p>No hay actividades para el grupo seleccionado.</p>}
    {mensaje&&<p role="status">{mensaje}</p>}
  </section>;
}
