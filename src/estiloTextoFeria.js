// Formato de presentación: conserva los datos originales y los códigos.
const siglas=new Set(['STEAM','STEM','AMVA','SIATA','PRAE','C.E.R','C.E.R.','QR','IA','WS','TS','JR','PDF','SENA','UDEA','UNAL']);
const propios=new Map(['Claudina','Múnera','Caldas','Antioquia','Corrala','Weather','Scientists','Envigado','Colombia','Medellín','Corantioquia'].map(p=>[p.toLocaleLowerCase('es'),p]));
const limpiar=v=>String(v??'').replace(/\s+/g,' ').trim();
const inicial=v=>v.replace(/\p{L}/u,c=>c.toLocaleUpperCase('es'));
export function textoFeria(valor){
 const texto=limpiar(valor);if(!texto||/[<>]/.test(texto))return texto;
 // Los textos ya escritos con mayúsculas y minúsculas conservan sus nombres propios.
 const uniforme=texto===texto.toLocaleUpperCase('es')||texto===texto.toLocaleLowerCase('es');
 const base=uniforme?texto.toLocaleLowerCase('es'):texto;
 return inicial(base.replace(/[\p{L}]+(?:\.[\p{L}]+)*\.?/gu,p=>siglas.has(p.toLocaleUpperCase('es'))?p.toLocaleUpperCase('es'):propios.get(p.toLocaleLowerCase('es'))||p));
}
export function nombreFeria(valor){
 const texto=limpiar(valor);if(/[<>]/.test(texto))return texto;const particulas=new Set(['de','del','la','las','los','y','e']);
 return texto.replace(/[\p{L}]+(?:\.[\p{L}]+)*\.?/gu,(p,indice)=>{
  if(siglas.has(p.toLocaleUpperCase('es')))return p.toLocaleUpperCase('es');
  const minuscula=p.toLocaleLowerCase('es');return indice>0&&particulas.has(minuscula)?minuscula:inicial(minuscula);
 });
}
