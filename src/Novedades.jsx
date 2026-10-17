import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {cargarNovedades} from './fuentesNovedades';
import {huella,instantanea,diferencias,claveNovedades,leerVisto} from './estadoNovedades.js';
import './Novedades.css';
const memoria=new Map();
export function useNovedades(perfil,tab,{ficha,grupos=[]}={}){
 const scope=huella({rol:perfil.rol,ficha:ficha?.id,grado:ficha?.grado,grupos:[...grupos].sort()});
 const identidad=perfil.id+':'+scope;
 const[estado,setEstado]=useState({});
 const activo=useRef(tab),pendiente=useRef(true);
 useEffect(()=>{activo.current=tab;pendiente.current=true;window.dispatchEvent(new Event('claudina:revisar-novedades'))},[tab]);
 useEffect(()=>{
  let vigente=true,ocupado=false;pendiente.current=true;setEstado({});
  async function revisar(){
   if(ocupado||document.visibilityState==='hidden')return;
   ocupado=true;const entrada=activo.current;
   try{
    const datos=await cargarNovedades(supabase,{rol:perfil.rol,id:perfil.id,ficha,grupos});
    if(!vigente)return;
    const indicadores={};
    for(const[seccion,{filas,silencioso}]of Object.entries(datos)){
     const actual=instantanea(filas),clave=claveNovedades(perfil.id,scope,seccion);
     let visto=memoria.get(clave);if(!visto){try{visto=leerVisto(localStorage,clave)}catch{}}
     const guardar=()=>{memoria.set(clave,actual);try{localStorage.setItem(clave,JSON.stringify(actual))}catch{}};
     if((pendiente.current&&seccion===entrada&&activo.current===entrada)||(!visto&&silencioso)){guardar();indicadores[seccion]={cantidad:0,cambio:false};if(seccion===entrada)pendiente.current=false}
     else indicadores[seccion]=diferencias(actual,visto);
    }
    setEstado(anterior=>({...anterior,...indicadores}));
   }finally{ocupado=false;if(vigente&&activo.current!==entrada)queueMicrotask(refrescar)}
  }
  const refrescar=()=>{revisar().catch(()=>{})};
  refrescar();const reloj=setInterval(refrescar,60000);
  window.addEventListener('focus',refrescar);window.addEventListener('claudina:revisar-novedades',refrescar);document.addEventListener('visibilitychange',refrescar);
  return()=>{vigente=false;clearInterval(reloj);window.removeEventListener('focus',refrescar);window.removeEventListener('claudina:revisar-novedades',refrescar);document.removeEventListener('visibilitychange',refrescar)};
 },[identidad]);
 return estado;
}
export function IndicadorNovedades({dato}){
 if(!dato?.cantidad&&!dato?.cambio)return null;
 const texto=dato.cantidad?`${dato.cantidad} ${dato.cantidad===1?'novedad pendiente':'novedades pendientes'} por revisar`:'Cambios por revisar';
 return <span className={'sectionBadge'+(dato.cantidad?'':' sectionBadgeDot')} role="img" aria-label={texto} title={texto}>{dato.cantidad?dato.cantidad>99?'99+':dato.cantidad:null}</span>;
}
