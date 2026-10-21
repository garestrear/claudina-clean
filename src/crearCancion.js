export function palabrasLetra(letra){
 return [...letra.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)].map(m=>({texto:m[0],inicio:m.index,fin:m.index+m[0].length}));
}
const normalizar=s=>s.trim().toLocaleLowerCase('en').replaceAll('’',"'");
export function seleccionarPalabras(letra,lista){
 const buscadas=new Set(lista.split(/[,;\n]+/).map(normalizar).filter(Boolean));
 const tokens=palabrasLetra(letra);
 return {indices:tokens.flatMap((t,i)=>buscadas.has(normalizar(t.texto))?[i]:[]),faltantes:[...buscadas].filter(p=>!tokens.some(t=>normalizar(t.texto)===p))};
}
export function marcarLetra(letra,indices){
 const elegidas=new Set(indices),tokens=palabrasLetra(letra);let cursor=0,resultado='';
 tokens.forEach((t,i)=>{resultado+=letra.slice(cursor,t.inicio)+(elegidas.has(i)?`[[${t.texto}]]`:t.texto);cursor=t.fin});
 return resultado+letra.slice(cursor);
}
