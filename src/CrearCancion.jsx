import React,{useEffect,useRef,useState} from 'react';
import {supabase} from './lib/supabase';
import {palabrasLetra,seleccionarPalabras,marcarLetra} from './crearCancion.js';
const LIMITE=25*1024*1024;
export default function CrearCancion({perfil,onCreada}){
 const[abierta,setAbierta]=useState(false);
 const[comentario,setComentario]=useState('');
 const[titulo,setTitulo]=useState(''),[artista,setArtista]=useState(''),[letra,setLetra]=useState(''),[lista,setLista]=useState(''),[elegidas,setElegidas]=useState([]),[grados,setGrados]=useState([6,7,8]),[archivo,setArchivo]=useState(null),[url,setUrl]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[error,setError]=useState(false);
 const detalles=useRef(null),entrada=useRef(null),id=useRef(crypto.randomUUID()),subido=useRef(null),bloqueo=useRef(false);
 useEffect(()=>{if(!archivo){setUrl('');return}const local=URL.createObjectURL(archivo);setUrl(local);return()=>URL.revokeObjectURL(local)},[archivo]);
 const tokens=palabrasLetra(letra),marcada=marcarLetra(letra,elegidas);
 function avisar(texto,fallo=false){setMsg(texto);setError(fallo)}
 function aplicar(){const r=seleccionarPalabras(letra,lista);setElegidas(r.indices);avisar(r.faltantes.length?'No encontré: '+r.faltantes.join(', '):`Se marcaron ${r.indices.length} espacios.`,r.faltantes.length>0)}
 function alternar(i){setElegidas(actual=>actual.includes(i)?actual.filter(n=>n!==i):[...actual,i])}
 async function publicar(e){e.preventDefault();if(bloqueo.current)return;
  if(!archivo||archivo.size===0||archivo.size>LIMITE||!archivo.name.toLowerCase().endsWith('.mp3'))return avisar('Selecciona un MP3 de hasta 25 MB.',true);
  if(!elegidas.length||elegidas.length>100||!grados.length||/\[\[|\]\]|_{3,}/.test(letra))return avisar('Elige entre 1 y 100 espacios y al menos un grado. Retira los corchetes dobles y las líneas de guiones bajos de la letra.',true);
  bloqueo.current=true;setBusy(true);avisar('Cargando el audio…');
  const ruta=`${perfil.id}/${id.current}.mp3`;
  try{
   if(!subido.current){const{error}=await supabase.storage.from('ingles-audios').upload(ruta,archivo,{contentType:'audio/mpeg',upsert:false});if(error&&String(error.statusCode)!=='409')throw error;subido.current=ruta}
   avisar('Publicando la actividad…');
   const{error}=await supabase.rpc('ingles_crear_actividad_con_comentario',{identificador:id.current,titulo_cancion:titulo.trim()+' · '+artista.trim(),letra_marcada:marcada,ruta_audio:ruta,grados_destino:grados,comentario_cancion:comentario.trim()});if(error)throw error;
   setTitulo('');setArtista('');setComentario('');setLetra('');setLista('');setElegidas([]);setArchivo(null);if(entrada.current)entrada.current.value='';subido.current=null;id.current=crypto.randomUUID();
   avisar('¡Canción publicada! Ya está disponible para los grados elegidos.');
   await onCreada?.();
  }catch(e){avisar('No se pudo completar la publicación: '+e.message+'. Puedes volver a pulsar Publicar. Si es la primera vez, el administrador debe ejecutar ingles-crear-canciones.sql e ingles-comentarios-canciones.sql.',true)}finally{bloqueo.current=false;setBusy(false)}
 }
 let cursor=0;
 return <details className="musicCreate" ref={detalles} onToggle={e=>setAbierta(e.currentTarget.open)}><summary>＋ Agregar canción</summary>{abierta&&<form onSubmit={publicar}><fieldset disabled={busy}><legend>Crea una actividad de escucha</legend>
 <label>Nombre de la canción<input required maxLength={140} value={titulo} onChange={e=>setTitulo(e.target.value)}/></label>
 <label>Artista<input required maxLength={100} value={artista} onChange={e=>setArtista(e.target.value)}/></label>
 <label>Comentario para despertar curiosidad (opcional)<textarea rows={3} maxLength={600} value={comentario} placeholder="Cuenta algo interesante de la canción o invita a descubrir su historia…" onChange={e=>setComentario(e.target.value)}/></label><small>{comentario.length}/600 · Aparecerá en la tarjeta de la canción.</small>
 <label>Audio MP3 · máximo 25 MB<input ref={entrada} required type="file" accept=".mp3,audio/mpeg" disabled={!!subido.current} onChange={e=>{setArchivo(e.target.files?.[0]||null);avisar('')}}/></label>
 {url&&<audio src={url} controls preload="metadata" onError={()=>avisar('El navegador no pudo reproducir este audio. Comprueba el archivo.',true)}/>}
 <label>Letra de la canción<textarea required maxLength={20000} rows={10} value={letra} onChange={e=>{setLetra(e.target.value);setElegidas([])}}/></label>
 <label>Palabras que se deben completar<textarea rows={2} value={lista} placeholder="head, child, silence" onChange={e=>setLista(e.target.value)}/></label>
 <p>Sepáralas con comas o saltos de línea. Se marcarán todas sus apariciones. Después puedes pulsar cada palabra para elegir cuáles ocultar.</p><button type="button" onClick={aplicar}>Marcar palabras</button>
 <div className="musicCreateGrades" role="group" aria-label="Grados de la actividad">{[6,7,8].map(g=><label key={g}><input type="checkbox" checked={grados.includes(g)} onChange={e=>setGrados(actual=>e.target.checked?[...actual,g]:actual.filter(n=>n!==g))}/>{g}°</label>)}</div>
 {letra&&<><h4>Selecciona los espacios · {elegidas.length} marcados</h4><div className="musicSelectLyrics" lang="en">{tokens.map((t,i)=>{const antes=letra.slice(cursor,t.inicio);cursor=t.fin;return <React.Fragment key={i}>{antes}<button type="button" aria-pressed={elegidas.includes(i)} onClick={()=>alternar(i)}>{t.texto}</button></React.Fragment>})}{letra.slice(cursor)}</div><h4>Vista del estudiante</h4><p>El banco de palabras aparecerá mezclado al iniciar la actividad.</p><div className="musicPreviewBank">{[...new Set(elegidas.map(i=>tokens[i]?.texto.toLowerCase()).filter(Boolean))].sort().map(p=><span key={p}>{p}</span>)}</div><div className="musicSelectLyrics" lang="en">{marcada.replace(/\[\[[^\]]+\]\]/g,'_____')}</div></>}
 <button type="submit" className="save" disabled={!elegidas.length||!grados.length}>{busy?'Publicando…':'Publicar canción'}</button>
 </fieldset><p role="status" aria-live="polite" className={error?'error':'notice'}>{msg}</p></form>}</details>;
}
