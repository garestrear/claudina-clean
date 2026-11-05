// Resoluciones confirmadas por el organizador para este archivo exacto.
// El Excel original y sus colores se conservan sin cambios.
import {normalizarPuente} from './puentesImportacion.js';
export const hashConcursoConfirmado='1060df44f3070a1f83edd364b02708824cfbffa9697e9f8439e73baa48ba80df';
export function aplicarAclaracionesPuentes(rows,sha){
 if(sha!==hashConcursoConfirmado)return rows;
 return rows.map(row=>{const nombre=normalizarPuente(row.nombre);
  if(nombre==='laestrella')return {...row,descalificado:true,motivo_descalificacion:'No alcanzaba la longitud adecuada.',aclaracion:'Motivo de descalificación confirmado por el organizador.'};
  if(nombre==='elrayo2')return {...row,descalificado:true,motivo_descalificacion:'Estaba reforzado con palos de chuzo.',aceptar_total_calculado:true,motivo_total:'Corrección confirmada: el tercer intento de 7 kg falló y no suma. Total válido: 12 kg.',aclaracion:'Descalificación y corrección del total confirmadas por el organizador.'};
  if(nombre==='elpuentedemedellin')return {...row,aceptar_total_calculado:true,motivo_total:'Corrección confirmada: el único intento de 5 kg falló. Total válido: 0 kg.',aclaracion:'Corrección del total confirmada por el organizador.'};
  if(nombre==='elpuentedorado')return {...row,intentos:row.intentos.map((i,n)=>n>0?{...i,resultado:'no_realizado'}:i),motivo_finalizacion:'La estudiante decidió no someterlo a más peso para no dañarlo.',aclaracion:'Intentos 2 y 3 no realizados por decisión voluntaria. El rojo de las celdas vacías no representa un fallo.'};
  return row;
 });
}
