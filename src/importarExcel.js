export const limpiar=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const claveNombre=s=>limpiar(s).split(' ').sort().join(' ');
export const normalizarDocumento=s=>String(s??'').trim().toUpperCase();
export const documentoValido=s=>!s||/^[A-Z0-9-]{3,30}$/.test(s);
const cabeceras={nombre:['nombre','nombre del estudiante','estudiante','nombre estudiante'],email:['correo','correo electronico','email','e mail'],grado:['grado'],documento:['documento','documento del estudiante','numero de documento','documento de identidad','identificacion']};
export function interpretarHojas(hojas){
 const filas=[],omitidas=[];
 for(const hoja of hojas){
  const cabecera=hoja.data.slice(0,25).map((r,i)=>({i,indices:Object.fromEntries(Object.entries(cabeceras).map(([campo,alias])=>[campo,r.findIndex(v=>alias.includes(limpiar(v)))]))})).find(x=>['nombre','email','grado'].every(c=>x.indices[c]>=0));
  if(!cabecera){omitidas.push(`${hoja.sheet}: faltan columnas Nombre del estudiante, Correo o Grado`);continue}
  let cantidad=0;
  for(const [i,r] of hoja.data.entries()){
   if(i<=cabecera.i)continue;
   const nombre=String(r[cabecera.indices.nombre]??'').trim().replace(/\s+/g,' '),email=String(r[cabecera.indices.email]??'').trim().toLowerCase(),grado=Number(r[cabecera.indices.grado]);
   if(!nombre&&!email&&!r[cabecera.indices.grado])continue;
   const tieneDocumento=cabecera.indices.documento>=0;
   filas.push({clave:`${hoja.sheet}-${i+1}`,hoja:hoja.sheet,fila:i+1,nombre,email,grado,documento:tieneDocumento?normalizarDocumento(r[cabecera.indices.documento]):'',tieneDocumento,id:'',omitir:false});cantidad++;
  }
  if(!cantidad)omitidas.push(`${hoja.sheet}: no hay estudiantes debajo de las columnas`);
 }
 return{filas,omitidas};
}
export function vincularFilas(filas,existentes,soloDocumentos=false){
 return filas.map(f=>{
  const porCorreo=existentes.filter(x=>x.email?.toLowerCase()===f.email&&f.email);
  const porNombre=existentes.filter(x=>Number(x.grado)===f.grado&&claveNombre(x.nombre)===claveNombre(f.nombre));
  const porDocumento=f.documento?existentes.filter(x=>normalizarDocumento(x.documento)===f.documento):[];
  const candidatos=porCorreo.length?porCorreo:porNombre;
  const matched=candidatos.length===1?candidatos[0]:null;
  const conflicto=candidatos.length>1?'Hay varias fichas coincidentes. Selecciona la correcta.':porDocumento.some(x=>x.id!==matched?.id)?'Documento asignado a otra ficha. Revisa la coincidencia.':'';
  return {...f,id:matched?.id||'',conflicto,omitir:!!conflicto||(soloDocumentos?(!matched||!f.documento||normalizarDocumento(matched.documento)===f.documento):!!matched)};
 });
}
