import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {areasSteam,camposFeria,gradoFeria} from './feriaCiencia.js';
import './FeriaImpresion.css';
function Cabecera({continuacion=false}){return <header className="fairPaperHeader"><b>C.E.R. Claudina Múnera</b><h1>Feria de la Ciencia · STEAM</h1><p>{continuacion?'Continuación del proyecto':'Formato de inscripción de proyectos'}</p></header>}
function Campo({campo,proyecto,blanco}){return <section className={'fairPaperField '+(blanco?'isBlank':'')}><h2>{campo.titulo}</h2>{blanco?<><small>{campo.id==='integrantes'?'Escribe los nombres y grados de todos los integrantes del equipo.':campo.ayuda}</small><div className={'fairWritingLines fairLines-'+(campo.id==='bibliografia'?5:campo.id==='procedimiento'?5:4)}/></>:<p>{proyecto[campo.id]||'No indicado.'}</p>}</section>}
function Hoja({proyecto,asesor,blanco}){
 const principales=camposFeria.filter(c=>['titulo','integrantes','propuesta','procedimiento'].includes(c.id));
 const adicionales=camposFeria.filter(c=>!['titulo','integrantes','propuesta','procedimiento'].includes(c.id));
 const intro=<><div className="fairPaperMeta"><span>Grado: {blanco?'________________':gradoFeria(proyecto.grado)}</span><span>Fecha: __________________</span></div><section className="fairPaperAreas"><h2>Áreas STEAM</h2><small>Marca una o varias áreas relacionadas con el proyecto.</small><div>{areasSteam.map(a=><span key={a.id}><i className={proyecto?.areas?.includes(a.id)&&!blanco?'checked':''}/>{a.nombre} · {a.es}</span>)}</div></section><section className="fairPaperAdvisor"><h2>Profesor asesor</h2><p>{blanco?'________________________________________________________________':asesor||'Sin asignar'}</p></section></>;
 if(!blanco)return <article className="fairPaperCompleted"><Cabecera/>{intro}{camposFeria.map(c=><Campo key={c.id} campo={c} proyecto={proyecto} blanco={false}/>)}</article>;
 return <><article className="fairPaperPage"><Cabecera/>{intro}{principales.map(c=>c.id==='titulo'?<section className="fairPaperTitle" key={c.id}><h2>{c.titulo}</h2><div className="fairSingleLine"/></section>:<Campo key={c.id} campo={c} blanco/>) }<footer>Página 1 de 2 · Completa también el reverso o la segunda hoja.</footer></article><article className="fairPaperPage"><Cabecera continuacion/><div className="fairPaperRepeat">Nombre del proyecto: ___________________________________________________________</div>{adicionales.map(c=><Campo key={c.id} campo={c} blanco/>)}<footer>Página 2 de 2 · Entrega este formato al docente para acompañar y registrar el proyecto.</footer></article></>;
}
export default function BotonImprimirFeria({proyecto,asesor}){
 const[imprimir,setImprimir]=useState(false);
 useEffect(()=>{if(!imprimir)return;document.body.classList.add('fairPrinting');const terminar=()=>setImprimir(false);window.addEventListener('afterprint',terminar);const reloj=setTimeout(()=>window.print(),100);return()=>{clearTimeout(reloj);document.body.classList.remove('fairPrinting');window.removeEventListener('afterprint',terminar)}},[imprimir]);
 return <><button type="button" className="fairPrintButton" onClick={()=>setImprimir(true)}>{proyecto?'Imprimir proyecto':'Imprimir formato en blanco'}</button>{imprimir&&createPortal(<div className="fairPrintArea"><Hoja proyecto={proyecto} asesor={asesor} blanco={!proyecto}/></div>,document.body)}</>;
}
