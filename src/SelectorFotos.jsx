import React,{useEffect,useRef,useState} from 'react';

export default function SelectorFotos({archivos=[],onSeleccionar,multiple=false,disabled=false}){
  const camara=useRef(null),galeria=useRef(null),[vistas,setVistas]=useState([]);
  useEffect(()=>{
    const urls=archivos.map(f=>({nombre:f.name,url:URL.createObjectURL(f)}));
    setVistas(urls);
    return()=>urls.forEach(f=>URL.revokeObjectURL(f.url));
  },[archivos]);
  function seleccionar(e){
    const nuevas=Array.from(e.target.files||[]);
    e.target.value='';
    if(!nuevas.length||disabled)return;
    onSeleccionar(multiple?[...archivos,...nuevas]:nuevas.slice(0,1));
  }
  return <div>
    <div className="chips">
      <button type="button" disabled={disabled} onClick={()=>camara.current?.click()}>📷 Tomar foto</button>
      <button type="button" disabled={disabled} onClick={()=>galeria.current?.click()}>🖼️ Elegir de la galería</button>
    </div>
    <input ref={camara} hidden type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={disabled} onChange={seleccionar}/>
    <input ref={galeria} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} disabled={disabled} onChange={seleccionar}/>
    {vistas.length>0&&<><small>{vistas.length} foto(s) seleccionada(s)</small><div className="evidenceGrid">{vistas.map((f,i)=><div key={f.url}><img src={f.url} alt={'Foto seleccionada: '+f.nombre}/><button type="button" disabled={disabled} aria-label={'Quitar foto '+(i+1)} onClick={()=>onSeleccionar(archivos.filter((_,n)=>n!==i))}>Quitar foto</button></div>)}</div></>}
  </div>;
}
