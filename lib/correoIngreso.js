// Solo completa el dominio cuando se escribe un usuario sin arroba.
// Los correos completos de otros dominios conservan su comportamiento.
export function normalizarCorreoIngreso(valor){
 const correo=typeof valor==='string'?valor.trim().toLowerCase():'';
 return correo&&!correo.includes('@')?correo+'@claudinamunera.edu.co':correo;
}
