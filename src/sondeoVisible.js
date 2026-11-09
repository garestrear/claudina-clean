// Una petición a la vez, sin consultas en pestañas ocultas.
export function sondearVisible(consultar,{intervalo=60000,documento=globalThis.document,reloj=globalThis}={}){
 let detenido=false,ocupado=false,timer;
 const visible=()=>documento?.visibilityState!=='hidden';
 const programar=()=>{if(!detenido&&visible())timer=reloj.setTimeout(ejecutar,typeof intervalo==='function'?intervalo():intervalo)};
 async function ejecutar(){
  reloj.clearTimeout(timer);
  if(detenido||ocupado||!visible())return;
  ocupado=true;
  try{await consultar()}catch{/* El consumidor conserva el estado y presenta el error. */}
  finally{ocupado=false;programar()}
 }
 const cambio=()=>{reloj.clearTimeout(timer);if(visible())ejecutar()};
 documento?.addEventListener('visibilitychange',cambio);
 ejecutar();
 return()=>{detenido=true;reloj.clearTimeout(timer);documento?.removeEventListener('visibilitychange',cambio)};
}
