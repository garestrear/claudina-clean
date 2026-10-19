import React,{useEffect,useState} from 'react';
import {supabase} from './lib/supabase';
import {IndicadorNovedades} from './Novedades';
import {seccionesDocente,herramientasDocente,paginasAdministrativas,seccionDe,novedadesSeccion} from './navegacionProfesor';
import './ProfesorPanel.css';
export function useAdministracionDocente(){
 const[acceso,setAcceso]=useState({administrador:false,docentes:[],cargando:true,error:''});
 async function cargar(){try{const{data,error}=await supabase.rpc('docente_administracion');if(error)throw error;setAcceso({...data,cargando:false,error:''})}catch{setAcceso({administrador:false,docentes:[],cargando:false,error:'No se pudieron comprobar los permisos administrativos. Actualiza la app o solicita activar la actualización SQL.'})}}
 useEffect(()=>{cargar();window.addEventListener('focus',cargar);return()=>window.removeEventListener('focus',cargar)},[]);
 return{...acceso,recargar:cargar};
}
export function PermisoDocente({profesor,administrador,recargar}){
 const[ocupado,setOcupado]=useState(false),[mensaje,setMensaje]=useState('');
 async function cambiar(){setOcupado(true);setMensaje('');try{const{error}=await supabase.rpc('docente_cambiar_administracion',{docente:profesor.id,permitir:!administrador});if(error)throw error;await recargar()}catch(e){setMensaje(e.message)}finally{setOcupado(false)}}
 return <div className="teacherPermission"><span>{administrador?'Administrador':'Docente'}</span><button type="button" disabled={ocupado} onClick={cambiar}>{ocupado?'Guardando…':administrador?'Quitar administración':'Dar administración'}</button>{mensaje&&<p role="alert">{mensaje}</p>}</div>;
}
export default function ProfesorPanel({tab,setTab,novedades,administrador,cargando,error,children,inicio,tareasPendientes,resumenTareas}){
 const seccion=seccionDe(tab),menu=seccionesDocente.some(s=>s.id===tab)||tab==='administracion';
 const permitidas=seccionesDocente.find(s=>s.id===tab)?.paginas||[];
 const tarjetas=tab==='administracion'?(administrador?['estudiantes','profesores','asignacion']:[]):tab==='mas'?['reportes','misgrupos',...(administrador?['administracion']:[])]:permitidas;
 const indicadores={...novedades,tareas:{cantidad:tareasPendientes||0}};
 const agregado=ids=>novedadesSeccion(indicadores,ids.filter(id=>administrador||!paginasAdministrativas.includes(id)));
 function tarjeta(id){const[icono,titulo,detalle]=herramientasDocente[id];return <button className="teacherTool" key={id} type="button" onClick={()=>setTab(id)}><span className="teacherToolIcon" aria-hidden="true">{icono}</span><span><strong>{titulo}<IndicadorNovedades dato={id==='administracion'?agregado(['estudiantes','profesores','asignacion']):indicadores[id]}/></strong><small>{detalle}</small></span><span aria-hidden="true">›</span></button>}
 return <><nav className="teacherMainNav" aria-label="Secciones del docente">{seccionesDocente.map(s=><button key={s.id} type="button" className={seccion===s.id?'active':''} aria-current={seccion===s.id?'page':undefined} onClick={()=>setTab(s.id)}><span aria-hidden="true">{s.icono}</span><span>{s.nombre}</span><IndicadorNovedades dato={agregado(s.id==='aseo'?['hoy']:s.paginas)}/></button>)}</nav>
 {menu?<section className="teacherHub"><div className="teacherHubTitle"><h2>{tab==='administracion'?'Administración':seccionesDocente.find(s=>s.id===tab)?.nombre}</h2>{tab==='administracion'&&<button type="button" onClick={()=>setTab('mas')}>← Más</button>}</div>{tab==='inicio'?<><p>Tu día en Claudina, a un paso.</p>{resumenTareas}<div className="teacherTools">{['hoy','avisos','eventos'].map(tarjeta)}</div>{inicio}</>:<><p>{tab==='mas'?'Consultas, preferencias y herramientas de uso ocasional.':'Elige qué necesitas hacer.'}</p><div className="teacherTools">{tarjetas.map(tarjeta)}</div></>}{tab==='mas'&&cargando&&<p role="status">Comprobando acceso administrativo…</p>}{tab==='mas'&&error&&<p role="status">{error}</p>}</section>:<><div className="teacherBreadcrumb"><button type="button" onClick={()=>setTab(seccion)}>← {seccionesDocente.find(s=>s.id===seccion)?.nombre}</button><span>{herramientasDocente[tab]?.[1]}</span></div>{children}</>}</>;
}
