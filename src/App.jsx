import React,{useState}from'react';

const tareas=['🧹 Barrer','🪣 Trapear','🗑️ Basura','🪑 Puestos','🧽 Tablero','📺 TV','⭐ Aporte especial'];
const demo={sexto:['Isabella','Maximiliano','Samantha'],juntos:['Estudiante 7°','Estudiante 8°']};

function Caritas(){
 const [n,setN]=useState(null);
 const face=n==null?'—':n<=2?'😞':n<=4?'🙁':n<=6?'😐':n<=8?'🙂':'😁';
 return <div className="rating"><b>{face} {n??'Sin calificar'}</b><div className="nums">{[1,2,3,4,5,6,7,8,9,10].map(x=><button key={x} className={n===x?'on':''} onClick={()=>setN(x)}>{x}</button>)}</div></div>
}

export default function App(){
 const [tab,setTab]=useState('hoy'); const [grupo,setGrupo]=useState('sexto');
 const alumnos=demo[grupo];
 return <main>
  <header><div className="brand">✨</div><div><h1>Claudina Clean</h1><p>Convivimos, cuidamos y transformamos</p></div></header>
  <nav>{[['hoy','🏠 Hoy'],['asignacion','📅 Asignación'],['reportes','🚨 Reportes'],['historial','📋 Historial']].map(([k,t])=><button onClick={()=>setTab(k)} className={tab===k?'active':''}>{t}</button>)}</nav>
  {tab==='hoy'&&<section>
   <div className="hero"><span>ASEO DE HOY</span><h2>Martes · 22 de septiembre</h2></div>
   <div className="switch"><button className={grupo==='sexto'?'active':''} onClick={()=>setGrupo('sexto')}>6°</button><button className={grupo==='juntos'?'active':''} onClick={()=>setGrupo('juntos')}>7° y 8°</button></div>
   <h3>Estudiantes asignados</h3>
   {alumnos.map(a=><article className="card"><h3>{a}</h3><div className="chips">{tareas.map(t=><button>{t}</button>)}</div><Caritas/><div className="status"><button>✅ Cumplió</button><button>❌ No cumplió</button><button>🚫 Ausente</button></div></article>)}
   <article className="card"><h3>📸 Evidencias</h3><p>Toma una foto o selecciónala desde la galería.</p><input type="file" accept="image/*" multiple/></article>
   <article className="card"><h3>📝 Observaciones</h3><textarea placeholder="¿Hay algo importante sobre el aseo de hoy?"/></article>
   <button className="save">Guardar aseo</button>
  </section>}
  {tab==='asignacion'&&<section><h2>Asignación de aseo</h2><p>Selecciona el grupo y marca los días correspondientes. Los estudiantes retirados se conservarán en el historial.</p><div className="switch"><button>6°</button><button>7° y 8°</button></div><div className="placeholder">➕ Agregar estudiante<br/><small>La tabla editable se conectará a Supabase en el siguiente paso.</small></div></section>}
  {tab==='reportes'&&<section><h2>Reportes</h2><div className="placeholder">🚨 Los estudiantes podrán reportar piso sucio, basura, puestos, tablero, TV u otro problema y adjuntar evidencia. El profesor revisará cada reporte.</div></section>}
  {tab==='historial'&&<section><h2>Historial y estadísticas</h2><div className="placeholder">📊 Turnos, cumplimiento, promedio oficial y ⭐ aportes especiales.</div></section>}
  <footer>Claudina Clean · C.E.R. Claudina Múnera</footer>
 </main>
}