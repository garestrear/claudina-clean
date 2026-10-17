// Guarda solo huellas de contenido, nunca textos, documentos o nombres.
export function huella(valor){const canonico=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonico):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonico(v[k])])):v;const texto=JSON.stringify(canonico(valor));let h=2166136261;for(let i=0;i<texto.length;i++){h^=texto.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
export function instantanea(filas){return Object.fromEntries((filas||[]).map((fila,i)=>[String(fila.id??fila.key??i),huella(fila)]))}
export function diferencias(actual,visto){const cantidad=Object.keys(actual).filter(id=>actual[id]!==visto?.[id]).length;const retiradas=Object.keys(visto||{}).some(id=>!(id in actual));return{cantidad,cambio:retiradas}}
export const claveNovedades=(cuenta,scope,seccion)=>'claudina:novedades:v1:'+cuenta+':'+scope+':'+seccion;
export function leerVisto(storage,clave){try{const v=JSON.parse(storage.getItem(clave));return v&&typeof v==='object'&&!Array.isArray(v)?v:null}catch{return null}}
