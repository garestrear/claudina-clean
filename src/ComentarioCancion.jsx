import React,{useEffect,useState} from 'react';
export default function ComentarioCancion({cancion:c,profesor,onGuardar}){
 const[editando,setEditando]=useState(false),[texto,setTexto]=useState(c.comentario||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!editando)setTexto(c.comentario||'')},[c.comentario,editando]);
 async function guardar(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await onGuardar(c,texto.trim());setEditando(false)}catch(e){setError('No se pudo guardar el comentario: '+e.message)}finally{setBusy(false)}}
 if(profesor&&editando)return <form className="musicCommentEdit" onSubmit={guardar}><label>Comentario para despertar curiosidad<textarea autoFocus rows={3} maxLength={600} value={texto} onChange={e=>setTexto(e.target.value)} disabled={busy}/></label><small>{texto.length}/600</small><div><button type="submit" disabled={busy}>{busy?'Guardando…':'Guardar comentario'}</button><button type="button" disabled={busy} onClick={()=>{setEditando(false);setError('')}}>Cancelar</button></div>{error&&<p role="alert" className="error">{error}</p>}</form>;
 return <div className="musicSongComment"><p>{c.comentario||(c.actividades.length===1?'Una actividad para entrenar tu oído.':c.actividades.length+' actividades para practicar.')}</p>{profesor&&<button type="button" onClick={()=>setEditando(true)}>{c.comentario?'Editar':'Agregar'} comentario</button>}</div>;
}
