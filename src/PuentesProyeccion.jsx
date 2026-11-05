import React,{useEffect,useState} from 'react';
import {FotoPuente} from './PuentesInscripcion';
import {categoriasPuentes,clasificacionPuentes,sigueEnCompetencia,duracionPrueba,nombrePuenteConGrado,segundosPuente} from './puentes.js';
import './FeriaPuentes.css';
const numero=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:3}).format(Number(n)||0);
const estados={pendiente:'En competencia',en_prueba:'En prueba',finalizado:'Finalizado',descalificado:'Descalificado'};
const resultados={valida:'Válido',fallo:'Falló',anulada:'Anulado',pendiente:'En prueba'};
export function filasProyeccion(ancho,alto){
 const espacio=ancho<760?alto*.53-210:alto-350;
 return Math.max(2,Math.min(14,Math.floor(espacio/(ancho<760?48:alto<650?48:58))));
}
export default function PuentesProyeccion({datos,categoria,onCategoria,ahora,error,fresco,onActualizar}){
 const[ventana,setVentana]=useState(()=>({ancho:globalThis.innerWidth||1280,alto:globalThis.innerHeight||720}));
 const[soloCompetencia,setSoloCompetencia]=useState(false),[pagina,setPagina]=useState(0),[rotar,setRotar]=useState(true),[aviso,setAviso]=useState('');
 useEffect(()=>{document.body.classList.add('bridgeProjectionActive');const resize=()=>setVentana({ancho:window.innerWidth,alto:window.innerHeight});window.addEventListener('resize',resize);return()=>{document.body.classList.remove('bridgeProjectionActive');window.removeEventListener('resize',resize)}},[]);
 const ranking=datos?clasificacionPuentes(datos.puentes,datos.rondas,categoria):[];
 const orden=ranking.filter(p=>!soloCompetencia||sigueEnCompetencia(p,datos?.rondas));
 const capacidad=filasProyeccion(ventana.ancho,ventana.alto),paginas=Math.max(1,Math.ceil(orden.length/capacidad)),actual=Math.min(pagina,paginas-1);
 useEffect(()=>setPagina(0),[categoria,capacidad,soloCompetencia]);
 useEffect(()=>{if(!rotar||paginas<2)return;const timer=setInterval(()=>setPagina(p=>(p+1)%paginas),8000);return()=>clearInterval(timer)},[rotar,paginas,categoria]);
 const puente=datos?.puentes.find(p=>p.id===datos.mesa.puente_id),ronda=datos?.rondas.find(r=>r.id===datos.mesa.ronda_id);
 const marca=puente&&clasificacionPuentes(datos.puentes,datos.rondas,puente.categoria).find(p=>p.id===puente.id);
 const rr=datos?.rondas.filter(r=>r.puente_id===puente?.id&&(r.cuenta_intento??r.resultado!=='anulada'))||[];
 const pendiente=ronda?.resultado==='pendiente',segundos=pendiente?segundosPuente(ronda.fin,ahora):0;
 const duracion=duracionPrueba(datos?.config?.find(c=>c.categoria===(puente?.categoria||categoria)),ronda);
 const lider=ranking.find(p=>p.puesto===1);
 const estado=pendiente?(segundos>0?'Sosteniendo la carga':'Esperando confirmación'):puente?.estado==='descalificado'?'Descalificado':puente?.estado==='finalizado'?'Participación finalizada':ronda?resultados[ronda.resultado]:'Preparados para el siguiente intento';
 async function pantallaCompleta(){try{if(document.fullscreenElement)await document.exitFullscreen?.();else await document.documentElement.requestFullscreen?.()}catch{setAviso('No se pudo activar pantalla completa.')}}
 return <section className="bridgeContest bridgeShow" lang="es-CO" aria-label="Proyección del concurso de puentes">
 <header className="bridgeShowHeader"><div><span>CLAUDINA MÚNERA · FERIA STEAM</span><h1>El desafío de los puentes</h1></div><div className="bridgeShowTools"><span className={'bridgeLive '+(!fresco?'bridgeOffline':'')}>{fresco?'● En vivo':'● Sin conexión reciente'}</span><button onClick={onActualizar} aria-label="Actualizar marcador">↻</button><button onClick={pantallaCompleta}>Pantalla completa</button></div></header>
 <div className="bridgeShowBody"><div className="bridgeShowLeft"><article className="bridgeShowCurrent">
 <div className="bridgeShowEyebrow"><span>PUENTE EN TURNO</span><span>{puente?categoriasPuentes[puente.categoria]:'Esperando equipo'}</span></div>
 <h2 title={puente?nombrePuenteConGrado(puente):''}>{puente?nombrePuenteConGrado(puente):'Preparando el concurso'}</h2>
 <p className="bridgeShowTeam" title={puente?.integrantes}>{puente?.integrantes||'El profesor selecciona el próximo puente desde la mesa.'}</p>
 <div className="bridgeShowTrial"><div><span>{pendiente?'CARGA EN PRUEBA':'ÚLTIMA CARGA'}</span><strong>{ronda?numero(ronda.carga_kg):'—'} <small>kg</small></strong></div><div className={'bridgeShowClock '+(pendiente?'isRunning':'')} role="timer" aria-label={`Cuenta de ${duracion} segundos`}><strong>{pendiente?segundos>0?segundos:'✓':'—'}</strong><span>{pendiente?segundos>0?'SEGUNDOS':'TIEMPO CUMPLIDO':`${duracion} s POR INTENTO`}</span></div></div>
 <p className="bridgeShowStatus" aria-live="polite">{estado}</p>
 <div className="bridgeShowAttempts">{[0,1,2].map(i=><div key={i} className={'bridgeAttempt '+(rr[i]?.resultado||'')}><span>INTENTO {i+1}</span><strong>{rr[i]?numero(rr[i].carga_kg)+' kg':'—'}</strong><small>{rr[i]?resultados[rr[i].resultado]:'Por realizar'}</small></div>)}</div>
 <div className="bridgeShowTotal"><span>TOTAL VÁLIDO <small>{marca?.intentos||0}/3 intentos</small></span><strong>{numero(marca?.total)} <small>kg</small></strong></div>
 {puente?.foto_path&&<div className="bridgeShowPhoto"><FotoPuente path={puente.foto_path} titulo={puente.titulo}/></div>}
 </article><aside className="bridgeShowLeader"><span>LÍDER PROVISIONAL · {categoriasPuentes[categoria]}</span><div><h2 title={lider?nombrePuenteConGrado(lider):''}>{lider?nombrePuenteConGrado(lider):'Aún no hay marcas'}</h2><strong>{lider?numero(lider.total):'—'} <small>kg</small></strong></div><p>{ranking.filter(p=>p.puesto===1).length>1?'Empate en el primer puesto · ':''}{lider?.masa_g?'Masa: '+numero(lider.masa_g)+' g':'Suma de cargas válidas · desempate por menor masa'}</p></aside></div>
 <article className="bridgeShowBoard"><div className="bridgeShowBoardHead"><div><span>CLASIFICACIÓN · TOTAL SOPORTADO</span><h2>{categoriasPuentes[categoria]} <small>{orden.length} puentes</small></h2></div><div className="bridgeShowBoardFilters"><label className="bridgeShowFilter"><input type="checkbox" checked={soloCompetencia} onChange={e=>setSoloCompetencia(e.target.checked)}/>Solo en competencia</label><div className="bridgeShowCategories" aria-label="Categoría del tablero">{Object.entries(categoriasPuentes).map(([id,n])=><button key={id} aria-pressed={id===categoria} onClick={()=>onCategoria(id)}>{n}</button>)}</div></div></div>
 <div className="bridgeShowTable"><table><thead><tr><th>Puesto</th><th>Puente / grado</th><th>I</th><th>II</th><th>III</th><th>Total kg</th><th>Estado</th></tr></thead><tbody>{orden.slice(actual*capacidad,(actual+1)*capacidad).map(p=>{const intentos=datos.rondas.filter(r=>r.puente_id===p.id&&(r.cuenta_intento??r.resultado!=='anulada'));return <tr key={p.id} className={p.id===puente?.id?'bridgeShowSelected':p.puesto===1?'bridgeShowFirst':''}><td>{p.puesto??'—'}</td><td title={nombrePuenteConGrado(p)}><span className="bridgeRankingName">{nombrePuenteConGrado(p)}</span>{p.integrantes&&<small className="bridgeRankingTeam" title={p.integrantes}>{p.integrantes}</small>}</td>{[0,1,2].map(i=><td key={i} className={'bridgeShowResult '+(intentos[i]?.resultado||'')} title={intentos[i]?resultados[intentos[i].resultado]:''}>{intentos[i]?numero(intentos[i].carga_kg):'—'}{['fallo','anulada'].includes(intentos[i]?.resultado)&&<span> ×</span>}</td>)}<td><strong>{numero(p.total)}</strong></td><td title={p.motivo_fin||estados[p.estado]}>{estados[p.estado]}</td></tr>})}</tbody></table>{!orden.length&&<p className="bridgeShowEmpty">{soloCompetencia?'No quedan puentes en competencia en esta categoría.':'Todavía no hay puentes inscritos en esta categoría.'}</p>}</div>
 <div className="bridgeShowPagination"><span>{orden.length?actual*capacidad+1:0}–{Math.min((actual+1)*capacidad,orden.length)} de {orden.length} · mayor total soportado primero</span><div><button disabled={paginas===1} onClick={()=>setPagina((actual-1+paginas)%paginas)} aria-label="Página anterior">‹</button><span>{actual+1} / {paginas}</span><button disabled={paginas===1} onClick={()=>setPagina((actual+1)%paginas)} aria-label="Página siguiente">›</button><button disabled={paginas===1} aria-pressed={rotar} onClick={()=>setRotar(v=>!v)}>{rotar?'Pausar rotación':'Rotar páginas'}</button></div></div></article></div>
 <footer className="bridgeShowFooter"><span role={error||aviso?'alert':'status'}>{error||aviso||(!datos?'Consultando el concurso…':!fresco?'Sin actualización reciente. Comprueba la conexión.':'Resultados provisionales · 3 intentos · los fallos aportan cero')}</span><span>{paginas>1&&rotar?'Cambio de página cada 8 s':'CLAUDINA APP'}</span></footer>
 </section>;
}

