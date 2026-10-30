import {useState} from 'react';

// Conserva solo la navegación; nunca guarda los textos de los formularios.
export function useVistaFeria(nombre,permitidas,inicial){
 const clave='claudina-clean:feria:'+nombre;
 const [vista,setVista]=useState(()=>{
  try{const guardada=window.localStorage.getItem(clave);return permitidas.includes(guardada)?guardada:inicial}catch{return inicial}
 });
 function seleccionar(nueva){
  if(!permitidas.includes(nueva))return;
  setVista(nueva);
  try{window.localStorage.setItem(clave,nueva)}catch{}
 }
 return [vista,seleccionar];
}
