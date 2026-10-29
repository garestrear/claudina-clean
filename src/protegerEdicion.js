// La protección vive solo en memoria: no almacena textos ni contraseñas en disco.
const tiposNoEditables=new Set(['button','submit','reset','hidden','image']);
function campoDe(nodo){
 if(!nodo||nodo.nodeType!==1)return null;
 if(nodo.matches('textarea,select,input')&&!tiposNoEditables.has(nodo.type)&&!nodo.readOnly)return nodo;
 return nodo.closest('[contenteditable="true"],[contenteditable="plaintext-only"]');
}
function valor(campo){
 if(campo.matches('[contenteditable]'))return campo.textContent;
 if(campo.type==='checkbox'||campo.type==='radio')return String(campo.checked);
 if(campo.tagName==='SELECT'&&campo.multiple)return JSON.stringify([...campo.selectedOptions].map(o=>o.value));
 return campo.value;
}
function textoActivo(campo){return campo&&!campo.disabled&&!campo.readOnly&&(campo.matches('textarea,[contenteditable]')||(campo.tagName==='INPUT'&&!['checkbox','radio','range','color','file',...tiposNoEditables].includes(campo.type)))}
export function crearProteccionEdicion(doc=document,onCambio=()=>{}){
 const campos=new Map();
 function iniciar(evento){const campo=campoDe(evento.target);if(campo&&!campos.has(campo))campos.set(campo,{base:valor(campo),tocado:false,desconocido:false})}
 function editar(evento){
  const campo=campoDe(evento.target);if(!campo)return;
  let registro=campos.get(campo);
  if(!registro){registro={base:campo.defaultValue??'',tocado:false,desconocido:true};campos.set(campo,registro)}
  registro.tocado=true;onCambio();
 }
 function limpiar(){let cambio=false;for(const campo of campos.keys())if(!campo.isConnected){campos.delete(campo);cambio=true}return cambio}
 function hayEdicion(){
  limpiar();if(textoActivo(campoDe(doc.activeElement)))return true;
  for(const[campo,registro]of campos)if(registro.tocado&&(registro.desconocido||valor(campo)!==registro.base))return true;
  return false;
 }
 function reiniciar(evento){queueMicrotask(()=>{for(const campo of campos.keys())if(evento.target.contains(campo))campos.delete(campo);onCambio()})}
 const eventos=[['focusin',iniciar],['beforeinput',iniciar],['input',editar],['change',editar],['focusout',onCambio],['reset',reiniciar]];
 eventos.forEach(([nombre,fn])=>doc.addEventListener(nombre,fn,true));
 const observador=new MutationObserver(()=>{if(limpiar())onCambio()});observador.observe(doc.documentElement,{childList:true,subtree:true});
 return{hayEdicion,destruir(){observador.disconnect();eventos.forEach(([nombre,fn])=>doc.removeEventListener(nombre,fn,true));campos.clear()}};
}
