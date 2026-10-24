import React,{useEffect,useRef,useState} from 'react';
import './InstalarApp.css';
const clave='claudina:instalacion:oculta';
const enApp=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
const esIOS=()=>/iPhone|iPad|iPod/.test(window.navigator.userAgent)||(window.navigator.platform==='MacIntel'&&window.navigator.maxTouchPoints>1);
const ocultada=()=>{try{return localStorage.getItem(clave)==='1'}catch{return false}};
export default function InstalarApp(){
 const[oculto,setOculto]=useState(()=>enApp()||ocultada());
 const[disponible,setDisponible]=useState(esIOS);
 const[ayuda,setAyuda]=useState('');
 const pendiente=useRef(null),cerrar=useRef(null);
 function ocultar(){setOculto(true);try{localStorage.setItem(clave,'1')}catch{}}
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');
  const solicitar=e=>{e.preventDefault();pendiente.current=e;setDisponible(true)};
  const instalada=()=>{pendiente.current=null;ocultar();setAyuda('')};
  const cambiar=()=>{if(enApp())instalada()};
  if(enApp())instalada();
  window.addEventListener('beforeinstallprompt',solicitar);window.addEventListener('appinstalled',instalada);media.addEventListener('change',cambiar);
  return()=>{window.removeEventListener('beforeinstallprompt',solicitar);window.removeEventListener('appinstalled',instalada);media.removeEventListener('change',cambiar)};
 },[]);
 useEffect(()=>{if(!ayuda)return;const anterior=document.activeElement;cerrar.current?.focus();const escape=e=>{if(e.key==='Escape')setAyuda('')};window.addEventListener('keydown',escape);return()=>{window.removeEventListener('keydown',escape);anterior?.isConnected&&anterior.focus?.()}},[ayuda]);
 async function instalar(){
  ocultar(); // Se oculta al primer toque, aunque se cancele la instalación.
  const evento=pendiente.current;pendiente.current=null;
  if(evento){try{await evento.prompt();await evento.userChoice;return}catch{/* Ofrecer la ruta del navegador. */}}
  setAyuda(esIOS()?'En Safari, toca Compartir y luego “Añadir a pantalla de inicio”. Activa “Abrir como app” si aparece y confirma con Añadir.':'En el menú de Chrome o Edge (⋮ o ⋯), elige “Instalar aplicación” o “Añadir a pantalla de inicio”.');
 }
 return <>{!oculto&&disponible&&<button type="button" className="installAppPill" onClick={instalar}>📲 Instalar Claudina App</button>}{ayuda&&<aside className="installAppHelp" role="dialog" aria-labelledby="install-app-title"><b id="install-app-title">Instala Claudina App</b><p>{ayuda}</p><button type="button" ref={cerrar} onClick={()=>setAyuda('')}>Entendido</button></aside>}</>;
}
