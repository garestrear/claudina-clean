import {useEffect} from 'react';
export function posicionReproductor({alto,ancho,offsetTop=0,offsetLeft=0,altoPlayer,tecladoTop}){
 const limite=Number.isFinite(tecladoTop)&&tecladoTop>offsetTop?Math.min(offsetTop+alto,tecladoTop):offsetTop+alto;
 return {top:Math.max(offsetTop+4,limite-altoPlayer-8),left:offsetLeft+Math.max(8,(ancho-Math.min(620,ancho-16))/2),width:Math.min(620,ancho-16)};
}
export function useReproductorVisible(ref,visible){
 useEffect(()=>{
  const el=ref.current;if(!visible||!el||typeof window==='undefined')return;
  const vv=window.visualViewport,vk=typeof navigator!=='undefined'?navigator.virtualKeyboard:null;let frame;
  const actualizar=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const foco=document.activeElement,escribiendo=foco?.matches?.('.musicGap input');el.dataset.escribiendo=escribiendo?'true':'false';
   const p=posicionReproductor({alto:vv?.height||window.innerHeight,ancho:vv?.width||window.innerWidth,offsetTop:vv?.offsetTop||0,offsetLeft:vv?.offsetLeft||0,altoPlayer:el.getBoundingClientRect().height,tecladoTop:vk?.boundingRect?.height>0?vk.boundingRect.y:undefined});
   Object.assign(el.style,{top:p.top+'px',left:p.left+'px',width:p.width+'px'});
   if(escribiendo){const r=foco.getBoundingClientRect(),barra=el.getBoundingClientRect();const limiteSuperior=Math.max((vv?.offsetTop||0)+4,document.querySelector('.musicWordBankFloating')?.getBoundingClientRect().bottom+8||0);if(r.bottom>barra.top-8)window.scrollBy({top:r.bottom-barra.top+12,behavior:'instant'});else if(r.top<limiteSuperior)window.scrollBy({top:r.top-limiteSuperior,behavior:'instant'})}
  })};
  vv?.addEventListener('resize',actualizar);vv?.addEventListener('scroll',actualizar);vk?.addEventListener('geometrychange',actualizar);window.addEventListener('resize',actualizar);document.addEventListener('focusin',actualizar);document.addEventListener('focusout',actualizar);
  const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(actualizar):null;observer?.observe(el);actualizar();
  return()=>{cancelAnimationFrame(frame);observer?.disconnect();vv?.removeEventListener('resize',actualizar);vv?.removeEventListener('scroll',actualizar);vk?.removeEventListener('geometrychange',actualizar);window.removeEventListener('resize',actualizar);document.removeEventListener('focusin',actualizar);document.removeEventListener('focusout',actualizar)};
 },[ref,visible]);
}
export function useBancoVisible(ref,visible){
 useEffect(()=>{
  const el=ref.current;if(!visible||!el||typeof window==='undefined')return;
  const vv=window.visualViewport;let frame;
  const actualizar=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   const ancho=vv?.width||window.innerWidth,alto=vv?.height||window.innerHeight;
   Object.assign(el.style,{top:((vv?.offsetTop||0)+6)+'px',left:((vv?.offsetLeft||0)+Math.max(8,(ancho-Math.min(620,ancho-16))/2))+'px',width:Math.min(620,ancho-16)+'px','--music-bank-limit':Math.max(64,Math.min(150,alto*.28))+'px'});
  })};
  vv?.addEventListener('resize',actualizar);vv?.addEventListener('scroll',actualizar);window.addEventListener('resize',actualizar);actualizar();
  return()=>{cancelAnimationFrame(frame);vv?.removeEventListener('resize',actualizar);vv?.removeEventListener('scroll',actualizar);window.removeEventListener('resize',actualizar)};
 },[ref,visible]);
}
