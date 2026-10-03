// Los campos pequeños se guardan de forma síncrona antes de abrir la cámara.
// Las fotos usan IndexedDB para no llenar localStorage con imágenes grandes.
export function leerBorrador(clave){
  try{return JSON.parse(localStorage.getItem(clave)||'null')}catch{return null}
}
export function guardarBorrador(clave,datos){
  try{localStorage.setItem(clave,JSON.stringify(datos))}catch{/* El formulario sigue disponible en memoria. */}
}
let apertura;
function abrir(){
  if(!apertura)apertura=new Promise((resolve,reject)=>{
    const peticion=indexedDB.open('claudina-clean-borradores',1);
    peticion.onupgradeneeded=()=>peticion.result.createObjectStore('fotos');
    peticion.onsuccess=()=>resolve(peticion.result);
    peticion.onerror=()=>{apertura=null;reject(peticion.error)};
  });
  return apertura;
}
async function operar(clave,modo,accion){
  const db=await abrir();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('fotos',modo);
    const peticion=accion(tx.objectStore('fotos'),clave);
    tx.oncomplete=()=>resolve(peticion.result);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Borrador cancelado'));
  });
}
export async function leerFotosBorrador(clave){
  try{
    const fotos=await operar(clave,'readonly',(store,key)=>store.get(key));
    return (fotos||[]).map(f=>new File([f.blob],f.nombre,{type:f.blob.type,lastModified:f.fecha}));
  }catch{return []}
}
export function guardarFotosBorrador(clave,fotos){
  return operar(clave,'readwrite',(store,key)=>store.put(fotos.map(f=>({blob:f,nombre:f.name,fecha:f.lastModified})),key));
}
export async function borrarBorrador(clave){
  try{localStorage.removeItem(clave)}catch{}
  try{await operar(clave,'readwrite',(store,key)=>store.delete(key))}catch{}
}
