import React,{useEffect} from 'react';
import {createPortal} from 'react-dom';
import './GrammyImprimir.css';

export default function GrammyImprimir({resultados,onCerrar}) {
 useEffect(()=>{
  document.body.classList.add('grammyPrinting');
  const cerrar=()=>onCerrar();
  window.addEventListener('afterprint',cerrar);
  const frame=requestAnimationFrame(()=>window.print());
  return ()=>{cancelAnimationFrame(frame);window.removeEventListener('afterprint',cerrar);document.body.classList.remove('grammyPrinting')};
 },[onCerrar]);
 const paginas=[];
 for(let i=0;i<resultados.length;i+=2)paginas.push(resultados.slice(i,i+2));
 return createPortal(<div className="grammyPrintSheet"><div className="grammyPrintControls"><p>Tarjetas listas para sobres. En la ventana de impresión puedes elegir «Guardar como PDF».</p><button onClick={()=>window.print()}>Imprimir / Guardar PDF</button><button onClick={onCerrar}>Cerrar vista de impresión</button></div>{paginas.map((pagina,i)=><div className="grammyPrintPage" key={i}>{pagina.map(({categoria,ganadores,nominados,pendiente,empatados})=><article className="grammyEnvelope" key={categoria.id}><header><span>C.E.R. Claudina Múnera</span><strong>GRAMMY DE LA JUVENTUD CLAUDINISTA</strong></header><h2>{categoria.orden}. {categoria.titulo}</h2><h3>NOMINADOS</h3>{nominados.length?<ul>{nominados.map(v=><li key={v.candidato_id}>{v.nombre} <span>· {v.grado}° · {v.votos} votos</span></li>)}</ul>:<p>Sin candidatos disponibles con votos.</p>}<div className="grammyEnvelopeWinner"><h3>{ganadores.length>1?'GANADORES · PREMIO COMPARTIDO':ganadores.length?'GANADOR / GANADORA':'PREMIO PENDIENTE'}</h3>{ganadores.map(v=><p key={v.candidato_id}><strong>{v.nombre}</strong> · {v.grado}° · {v.votos} votos</p>)}{pendiente&&<p>Desempate pendiente: {empatados.map(v=>v.nombre).join(' / ')}.</p>}{!ganadores.length&&!pendiente&&<p>No se ha asignado ganador.</p>}</div><footer>Recortar por el borde punteado · Una tarjeta por sobre</footer></article>)}</div>)}</div>,document.body);
}
