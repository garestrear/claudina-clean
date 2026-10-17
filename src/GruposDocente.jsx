import React,{createContext,useContext,useState} from 'react';
import {supabase} from './lib/supabase';
import {coincideGrado,coincideGrupo} from './FiltroGrado';

export const gruposDisponibles=['0','1','2','3','4','5','6','7-8'];
export const normalizarGrupos=valor=>Array.isArray(valor)&&valor.length&&valor.every(g=>gruposDisponibles.includes(g))?[...new Set(valor)]:gruposDisponibles;
export const incluyeGrupo=(grupos,grado)=>grado==null||grado===''||grado==='todos'||grupos.some(g=>coincideGrupo(g,grado));
const Contexto=createContext(null);
export function useGruposDocente(){
 const contexto=useContext(Contexto);
 const grupos=contexto?.grupos||gruposDisponibles;
 return {...contexto,grupos,incluye:grado=>incluyeGrupo(grupos,grado),coincideGrado:(f,g)=>incluyeGrupo(grupos,g)&&coincideGrado(f,g),coincideGrupo:(f,g)=>incluyeGrupo(grupos,g)&&coincideGrupo(f,g)};
}
export function GruposDocenteProvider({inicial,children}){
 const[grupos,setGrupos]=useState(()=>normalizarGrupos(inicial));
 return <Contexto.Provider value={{grupos,setGrupos}}>{children}</Contexto.Provider>;
}
export function MisGrupos(){
 const{grupos,setGrupos}=useGruposDocente();
 const[borrador,setBorrador]=useState(grupos),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 async function guardar(e){e.preventDefault();if(!borrador.length||busy)return;setBusy(true);setMsg('');try{const{error}=await supabase.auth.updateUser({data:{grupos_interes:borrador}});if(error)throw error;setGrupos([...borrador]);setMsg('Tus grupos quedaron guardados. Se aplicarán también al ingresar desde otro dispositivo.')}catch{setMsg('No fue posible guardar tus grupos. Inténtalo de nuevo.')}finally{setBusy(false)}}
 return <form className="card" onSubmit={guardar}><h3>Mis grupos</h3><p>Marca los grupos en los que impartes clase. La app mostrará su información y los avisos generales de la institución.</p><div className="myGroups">{gruposDisponibles.map(g=><label key={g}><input type="checkbox" checked={borrador.includes(g)} disabled={busy} onChange={e=>setBorrador(actual=>e.target.checked?[...actual,g]:actual.filter(x=>x!==g))}/>{g==='0'?'0° · TS y JR':g==='7-8'?'7° y 8°':g+'°'}</label>)}</div><button type="button" disabled={busy} onClick={()=>setBorrador([...gruposDisponibles])}>Seleccionar todos</button><button className="save" disabled={busy||!borrador.length}>{busy?'Guardando…':'Guardar mis grupos'}</button>{!borrador.length&&<p>Selecciona al menos un grupo.</p>}{msg&&<p role="status">{msg}</p>}</form>;
}
