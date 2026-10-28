import React from 'react';
import {IndicadorNovedades} from './Novedades';
import './EstudiantePanel.css';
export const gruposEstudiante=[
 {id:'inicio',icono:'🏠',titulo:'Inicio',paginas:['inicio']},
 {id:'feria',icono:'🔬',titulo:'Feria STEAM',paginas:['feria']},
 {id:'aprender',icono:'📚',titulo:'Aprender',paginas:['ingles']},
 {id:'colegio',icono:'🤝',titulo:'Mi colegio',paginas:['calificaciones','evidencias','reportes','valoraciones','convivencia']},
 {id:'mas',icono:'☰',titulo:'Más',paginas:['horario','encuestas','eventos']}
];
const accesos={
 aprender:[['ingles','🎧','Aprende inglés','Canciones y actividades para practicar.']],
 colegio:[['valoraciones','⭐','Valorar aseo','Participa en el cuidado del salón.'],['evidencias','📸','Evidencias y reportes','Consulta tus actividades y registros.'],['calificaciones','📈','Calificaciones de aseo','Revisa tus valoraciones e historial.'],['convivencia','🤝','Convivencia','Acuerdos y seguimiento del grupo.']],
 mas:[['horario','🕒','Horario','Consulta tus clases.'],['encuestas','📋','Encuestas','Comparte tu opinión y participa.'],['eventos','⭐','Evaluar eventos','Cuéntanos cómo viviste cada jornada.']]
};
export function grupoEstudiante(tab){return gruposEstudiante.find(g=>g.id===tab||g.paginas.includes(tab))?.id||'inicio'}
export function novedadesGrupo(novedades,grupo){return grupo.paginas.reduce((total,id)=>({cantidad:total.cantidad+(novedades[id]?.cantidad||0),cambio:total.cambio||!!novedades[id]?.cambio}),{cantidad:0,cambio:false})}
export function TarjetaFeriaEstudiante({onAbrir,novedad}){return <article className="studentFairShortcut"><div><span className="studentFairLabel">NOS ENCONTRAMOS EL 6 DE NOVIEMBRE</span><h3>🔬 Feria STEAM</h3><p>Completa tu proyecto y comparte el póster.</p></div><button type="button" onClick={onAbrir}>Ver mis proyectos <span aria-hidden="true">→</span><IndicadorNovedades dato={novedad}/></button></article>}
export default function EstudiantePanel({tab,setTab,grado,novedades={},children}){
 const grupo=grupoEstudiante(tab),categoria=gruposEstudiante.find(g=>g.id===grupo);
 const esMenu=Object.hasOwn(accesos,tab);
 const opciones=(accesos[tab]||[]).filter(([id])=>id!=='ingles'||[6,7,8].includes(grado));
 function ir(id){setTab(id);window.scrollTo?.({top:0,behavior:'auto'})}
 return <div className="studentShell">
  <nav className="studentNav studentCompactNav" aria-label="Secciones del estudiante">{gruposEstudiante.map(g=><button key={g.id} type="button" className={(grupo===g.id?'active ':'')+(g.id==='feria'?'studentFairNav':'')} aria-current={grupo===g.id?'page':undefined} onClick={()=>ir(g.id)}><span className="studentNavIcon" aria-hidden="true">{g.icono}</span><span className="studentNavLabel">{g.titulo}</span><IndicadorNovedades dato={novedadesGrupo(novedades,g)}/></button>)}</nav>
  <div className="studentPanelContent">
   {esMenu?<div className="studentMenu"><h2>{categoria.icono} {categoria.titulo}</h2><p>Elige lo que quieres consultar.</p><div className="studentMenuGrid">{opciones.map(([id,icono,titulo,ayuda])=><button key={id} type="button" onClick={()=>ir(id)}><span className="studentMenuIcon" aria-hidden="true">{icono}</span><span><strong>{titulo}<IndicadorNovedades dato={novedades[id]}/></strong><small>{ayuda}</small></span><span aria-hidden="true">→</span></button>)}</div>{!opciones.length&&<div className="card"><p>Encuentra tus tareas y actividades pendientes en Inicio.</p><button type="button" onClick={()=>ir('inicio')}>Ver mis tareas →</button></div>}</div>:<>{!['inicio','feria'].includes(tab)&&<button className="studentBackToMenu" type="button" onClick={()=>ir(grupo)}>← {categoria.titulo}</button>}{children}</>}
  </div>
 </div>
}
