import React,{useEffect,useMemo,useRef,useState} from 'react';
import {informePuentes} from './informePuentes.js';
import {generarArchivoInformePuentes,descargarArchivoInforme} from './informePuentesPdf.js';
export default function InformePuentes({datos,onCerrar}){
 const[categoria,setCategoria]=useState(''),[mensaje,setMensaje]=useState(''),[busy,setBusy]=useState(false);
 const area=useRef(null),panel=useRef(null),cerrar=useRef(onCerrar);cerrar.current=onCerrar;
 const texto=useMemo(()=>informePuentes(datos,{categoria}),[datos,categoria]);
 useEffect(()=>{
  const anterior=document.activeElement;panel.current?.querySelector('button')?.focus();
  function tecla(e){if(e.key==='Escape'){e.preventDefault();cerrar.current();return}if(e.key==='Tab'){const elementos=[...panel.current.querySelectorAll('button:not(:disabled),select,textarea,a[href]')];const primero=elementos[0],ultimo=elementos.at(-1);if(e.shiftKey&&document.activeElement===primero){e.preventDefault();ultimo?.focus()}else if(!e.shiftKey&&document.activeElement===ultimo){e.preventDefault();primero?.focus()}}}
  document.addEventListener('keydown',tecla);return()=>{document.removeEventListener('keydown',tecla);anterior?.focus?.()};
 },[]);
 async function copiar(){
  try{await navigator.clipboard.writeText(texto);setMensaje('Informe copiado. Pégalo en el chat o grupo de WhatsApp que elijas.');return true}
  catch{area.current?.focus();area.current?.select();setMensaje('Selecciona y copia el texto del informe para pegarlo en WhatsApp.');return false}
 }
 async function pdf(compartir=false){
  if(busy)return;setBusy(true);setMensaje('Preparando el PDF y las fotografías…');
  try{
   const archivo=await generarArchivoInformePuentes(datos,{categoria});
   if(compartir&&navigator.share&&navigator.canShare?.({files:[archivo]})){
    try{await navigator.share({title:'Concurso de puentes · Claudina Múnera',files:[archivo]});setMensaje('Menú de compartir abierto. Elige WhatsApp y el destinatario.');}catch(e){if(e.name==='AbortError')throw e;descargarArchivoInforme(archivo);setMensaje('PDF descargado. Adjunta el archivo como documento en WhatsApp.');}
   }else{descargarArchivoInforme(archivo);setMensaje('PDF descargado. Adjunta el archivo como documento en el chat o grupo de WhatsApp.');}
  }catch(e){setMensaje(e.name==='AbortError'?'Envío cancelado. Puedes descargar el PDF.':'No se pudo generar o compartir el PDF. Intenta descargarlo de nuevo.');}
  finally{setBusy(false)}
 }
 return <div className="bridgeReportBackdrop"><section ref={panel} className="bridgeReport" role="dialog" aria-modal="true" aria-labelledby="bridgeReportTitle">
 <header><div><h2 id="bridgeReportTitle">Informe PDF para WhatsApp</h2><p>PDF ordenado por grado, con clasificaciones compactas por categoría, ficha de cada puente, fotografías disponibles y detalle de las pruebas. Incluye los puentes ocultos por los filtros de la mesa.</p></div><button type="button" onClick={onCerrar} aria-label="Cerrar informe">✕</button></header>
 <label>Categorías del informe<select disabled={busy} value={categoria} onChange={e=>{setCategoria(e.target.value);setMensaje('')}}><option value="">Infantil y Juvenil</option><option value="puentes_infantil">Solo Infantil</option><option value="puentes_juvenil">Solo Juvenil</option></select></label>
 <textarea ref={area} aria-label="Texto del informe para WhatsApp" readOnly value={texto}/>
 <div className="bridgeActions"><button className="bridgePrimary" disabled={busy} onClick={()=>pdf(true)}>{busy?'Preparando PDF…':'Compartir PDF por WhatsApp'}</button><button className="bridgePrimary" disabled={busy} onClick={()=>pdf()}>Descargar PDF</button><button disabled={busy} onClick={copiar}>Copiar informe</button><button disabled={busy} onClick={()=>{const u=URL.createObjectURL(new Blob([texto],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='Informe-concurso-puentes.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}}>Descargar texto</button></div>
 <p role="status">{mensaje||'Revisa el informe antes de compartirlo. Tú eliges el chat o grupo y confirmas el envío en WhatsApp.'}</p>
 </section></div>;
}
