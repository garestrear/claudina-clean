export const gruposDisponibles=['0','1','2','3','4','5','6','7-8'];
export const gruposValidos=valor=>Array.isArray(valor)&&valor.length>0&&valor.length<=gruposDisponibles.length&&valor.every(g=>gruposDisponibles.includes(g))&&new Set(valor).size===valor.length;
export const normalizarGrupos=valor=>Array.isArray(valor)&&valor.length&&valor.every(g=>gruposDisponibles.includes(g))?[...new Set(valor)]:[...gruposDisponibles];
export const nombreGrupo=g=>g==='0'?'TS y JR':g==='7-8'?'7° y 8°':g+'°';
