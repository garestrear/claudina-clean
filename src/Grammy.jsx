import React,{useEffect,useState,useCallback} from 'react';
import {supabase} from './lib/supabase';
import './Grammy.css';
import GrammyImprimir from './GrammyImprimir';
import {repartirPremios} from './grammyResultados';

export default function Grammy({profesor=false}){
 const[datos,setDatos]=useState(null),[votos,setVotos]=useState({}),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[error,setError]=useState(''),[editando,setEditando]=useState(null);
 const[imprimir,setImprimir]=useState(false);
 const cerrarImpresion=useCallback(()=>setImprimir(false),[]);
 async function cargar(){
  setLoading(true);const{data,error}=await supabase.rpc('grammy_contexto');
  if(error){setError('No se pudo cargar la votación: '+error.message);setLoading(false);return}
  setDatos(data);setVotos(data.mis_votos||{});setError('');setLoading(false);
 }
 useEffect(()=>{cargar()},[]);
 async function guardar(e){
  e.preventDefault();if(busy)return;setBusy(true);setMsg('');
  const elecciones=Object.fromEntries(datos.categorias.filter(c=>c.habilitada).map(c=>[String(c.id),votos[c.id]||'']));
  const{error}=await supabase.rpc('grammy_guardar_votos',{elecciones});
  if(error)setMsg('No se pudieron guardar: '+error.message);else{setMsg('✅ Tus votos quedaron guardados. Puedes cambiarlos hasta que cierre la votación.');await cargar()}setBusy(false);
 }
 async function administrar(accion){
  if(busy)return;setBusy(true);setMsg('');
  const{error}=await supabase.rpc('grammy_administrar',{accion});
  if(error)setMsg(error.message);else{setMsg(accion==='abrir'?'✅ Votación abierta.':accion==='cerrar'?'✅ Votación cerrada.':accion==='publicar'?'✅ Ganadores publicados para los estudiantes.':'Resultados ocultos.');await cargar()}setBusy(false);
 }
 async function editar(e){
  e.preventDefault();if(busy)return;setBusy(true);
  const{error}=await supabase.rpc('grammy_editar_categoria',{categoria:editando.id,nuevo_titulo:editando.titulo,nueva_descripcion:editando.descripcion,activa:editando.habilitada});
  if(error)setMsg(error.message);else{setEditando(null);setMsg('Categoría actualizada.');await cargar()}setBusy(false);
 }
 if(loading&&!datos)return <section><h2>🏆 Grammy de la Juventud</h2><p role="status">Cargando votación…</p></section>;
 if(error)return <section><h2>🏆 Grammy de la Juventud</h2><p className="error">{error}</p><p>Si el módulo aún no está habilitado, el profesor debe ejecutar grammy-juventud.sql en Supabase.</p><button onClick={cargar}>Reintentar</button></section>;
 const categorias=datos.categorias.filter(c=>c.habilitada),abierto=datos.config.abierto,publicados=datos.config.resultados_publicados;
 const elegidos=categorias.filter(c=>votos[c.id]).length;
 const administrarProfesor=profesor&&datos.profesor;
 const resultados=repartirPremios(categorias,datos.conteo||[]);
 return <section className="grammySection"><div className="hero"><span>👑 PREMIOS CLAUDINA</span><h2>Grammy de la Juventud</h2><p>Votación directa · Estudiantes activos de 6°, 7° y 8°</p></div>
 <p className="notice">Votación {abierto?'abierta':'cerrada'}{publicados?' · Ganadores publicados':''}</p>
 {msg&&<p role="status" className="notice">{msg}</p>}
 {administrarProfesor?<><article className="card"><h3>Administrar votación</h3><p>{datos.candidatos.length} candidatos activos · {datos.votantes||0} estudiantes han guardado al menos un voto.</p><p>Revisa los títulos con el grupo antes de abrir. Puedes editar o desactivar categorías con la votación cerrada y los resultados ocultos. Cada estudiante puede ganar un solo premio, en la categoría con más votos. Los empates con 4 votos o más comparten premio.</p><div className="chips"><button disabled={busy||loading||abierto} onClick={()=>administrar('abrir')}>Abrir votación</button><button disabled={busy||loading||!abierto} onClick={()=>administrar('cerrar')}>Cerrar votación</button><button disabled={busy||loading||abierto||publicados} onClick={()=>administrar('publicar')}>Publicar ganadores</button><button disabled={busy||loading||!publicados} onClick={()=>administrar('ocultar')}>Ocultar resultados</button><button disabled={busy||loading} onClick={cargar}>Actualizar conteo</button></div><small>Los votos de cada estudiante no se muestran a sus compañeros. El conteo permanece reservado a profesores hasta publicar los ganadores.</small></article>
 {editando&&<form className="card avisoForm" onSubmit={editar}><h3>Editar categoría</h3><label>Título<input required maxLength={150} value={editando.titulo} onChange={e=>setEditando(c=>({...c,titulo:e.target.value}))}/></label><label>Descripción<textarea maxLength={500} value={editando.descripcion} onChange={e=>setEditando(c=>({...c,descripcion:e.target.value}))}/></label><label><input type="checkbox" checked={editando.habilitada} onChange={e=>setEditando(c=>({...c,habilitada:e.target.checked}))}/> Habilitada</label><button className="save" disabled={busy}>Guardar categoría</button><button type="button" disabled={busy} onClick={()=>setEditando(null)}>Cancelar</button></form>}
 <h3>Categorías y conteo</h3>{datos.categorias.map(c=>{const filas=(datos.conteo||[]).filter(v=>v.categoria_id===c.id);return <article className="card" key={c.id}><h3>{c.orden}. {c.titulo}</h3>{c.descripcion&&<p>{c.descripcion}</p>}{!c.habilitada&&<p>Desactivada</p>}<button disabled={busy||abierto||publicados} onClick={()=>setEditando({...c})}>Editar categoría</button>{filas.length?<div className="gradesTableWrap"><table className="gradesTable"><thead><tr><th>Candidato</th><th>Grado</th><th>Votos</th></tr></thead><tbody>{filas.map(v=><tr key={v.candidato_id}><td>{v.nombre}</td><td>{v.grado}°</td><td>{v.votos}</td></tr>)}</tbody></table></div>:<p>Sin votos contabilizados.</p>}</article>})}</>:<>
 {abierto?<form onSubmit={guardar}><article className="card"><h3>Elige tus favoritos</h3><p>Un voto por categoría. Puedes dejar premios sin responder y modificar tus elecciones hasta el cierre. No se guardan hasta pulsar el botón.</p><p><b>{elegidos} de {categorias.length}</b> categorías seleccionadas.</p></article>{categorias.map(c=><article className="card" key={c.id}><label><b>{c.orden}. {c.titulo}</b>{c.descripcion&&<p>{c.descripcion}</p>}<select disabled={busy||loading} value={votos[c.id]||''} onChange={e=>setVotos(v=>({...v,[c.id]:e.target.value}))}><option value="">Sin voto en esta categoría</option>{votos[c.id]&&!datos.candidatos.some(s=>s.id===votos[c.id])&&<option value={votos[c.id]}>Candidato ya no disponible: cambia o elimina este voto</option>}{datos.candidatos.map(s=><option key={s.id} value={s.id}>{s.nombre} · {s.grado}°</option>)}</select></label></article>)}<button className="save" disabled={busy||loading}>{busy?'Guardando…':'💾 Guardar mis votos'}</button></form>:<article className="card"><h3>{publicados?'¡Llegó la premiación!':'La votación está cerrada'}</h3><p>{publicados?'Conoce a los ganadores más abajo.':'El profesor anunciará la apertura o la publicación de resultados.'}</p>{elegidos>0&&<p>Tienes votos guardados en {elegidos} categorías.</p>}<h4>Preguntas y mis respuestas</h4><ol>{categorias.map(c=><li key={c.id}><b>{c.titulo}</b><p>{votos[c.id]?(datos.candidatos.find(s=>s.id===votos[c.id])?.nombre||'Estudiante ya no disponible'):'Sin respuesta'}</p></li>)}</ol><button disabled={loading} onClick={cargar}>Actualizar estado</button></article>}</>}
 {(publicados||administrarProfesor)&&<article className="card"><h3>🏆 {publicados?'Nominados y ganadores':'Nominados y ganadores · vista previa'}</h3>{administrarProfesor&&<><button disabled={abierto||busy||loading||!datos.conteo||!resultados.length} onClick={()=>setImprimir(true)}>🖨️ Exportar resultados para sobres</button><p><small>Dos tarjetas por hoja tamaño carta, con nominados y ganador. Puedes imprimir o guardar como PDF. Los premios pendientes se identifican en la tarjeta.</small></p></>}<p>Un premio por estudiante. Se asignan primero los votos más altos. Solo los ganadores salen de las otras categorías; los demás nominados siguen participando. Si una persona empata entre premios, se prioriza el orden de categorías. Empates con 4 votos o más comparten premio.</p>{!datos.conteo?<p className="notice">Para mostrar los nominados a estudiantes, el profesor debe ejecutar la actualización grammy-resultados.sql en Supabase.</p>:resultados.map(({categoria:c,ganadores,nominados,pendiente,empatados})=><div className="grammyWinner" key={c.id}><h4>{c.orden}. {c.titulo}</h4>{nominados.length?<><ol className="grammyNominees">{nominados.map(v=>{const gana=ganadores.some(g=>g.candidato_id===v.candidato_id);return <li key={v.candidato_id} className={gana?'grammyChosen':''}><span>{gana?'🏆 ':''}{v.nombre} · {v.grado}°</span><b>{v.votos} votos</b>{gana&&<small>{abierto?'Ganaría':'Ganador/a'}{ganadores.length>1?' · Premio compartido':''}</small>}</li>})}</ol>{ganadores.length>3&&<p>También comparten el premio: {ganadores.slice(3).map(g=>g.nombre).join(', ')}.</p>}{pendiente&&<p className="notice">Pendiente de desempate o revisión: {empatados.map(v=>v.nombre).join(' / ')}. Todavía no se asigna este premio.</p>}</>:<p>No quedan candidatos con votos disponibles para este premio.</p>}</div>)}</article>}
 {imprimir&&<GrammyImprimir resultados={resultados} onCerrar={cerrarImpresion}/>}
 </section>;
}
