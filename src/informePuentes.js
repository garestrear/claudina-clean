import {categoriasPuentes,clasificacionPuentes,nombrePuenteConGrado,sigueEnCompetencia} from './puentes.js';
const numero=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:3}).format(Number(n)||0);
const limpio=v=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
const estados={pendiente:'En competencia',en_prueba:'Intento en curso',finalizado:'Participación finalizada',descalificado:'Descalificado'};
export function informePuentes(datos,{categoria='',fecha=datos.ahora||new Date()}={}){
 const puentes=datos.puentes.filter(p=>!categoria||p.categoria===categoria);
 const activos=puentes.filter(p=>sigueEnCompetencia(p,datos.rondas)).length;
 const fechaTexto=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'long',timeStyle:'short'}).format(new Date(fecha));
 const lineas=['🌉 *ASÍ VA EL CONCURSO DE PUENTES*','Feria STEAM · C.E.R. Claudina Múnera',datos.fase==='final'?'*GRAN FINAL* · Solo cuentan las cargas de esta fase.':'*ELIMINATORIA*',`🕒 Corte: ${fechaTexto} (Colombia)`,'',`📊 ${puentes.length} puentes inscritos · ${activos} ${activos===1?'sigue':'siguen'} en competencia.`, ''];
 for(const [id,nombre] of Object.entries(categoriasPuentes).filter(([id])=>!categoria||id===categoria)){
  const filas=clasificacionPuentes(datos.puentes,datos.rondas,id);
  lineas.push(`*CATEGORÍA ${nombre.toLocaleUpperCase('es')}*`);
  if(!filas.length){lineas.push('Aún no hay puentes inscritos.','');continue}
  for(const p of filas){
   const puesto=p.puesto?`${p.puesto===1?'🥇 ':p.puesto===2?'🥈 ':p.puesto===3?'🥉 ':''}${p.puesto}. `:'';
   lineas.push(`${puesto}${limpio(nombrePuenteConGrado(p))}`,`   Total válido: *${numero(p.total)} kg* · ${p.intentos}/3 intentos`);
   if(limpio(p.integrantes))lineas.push(`   Equipo: ${limpio(p.integrantes)}`);
   const intentos=datos.rondas.filter(r=>r.puente_id===p.id&&(r.cuenta_intento??r.resultado!=='anulada'));
   if(intentos.length)lineas.push('   '+intentos.map((r,i)=>`${i+1}: ${numero(r.carga_kg)} kg ${r.resultado==='valida'?'✅':r.resultado==='pendiente'?'⏳ (sin confirmar)':'❌ (aporta 0)'}`).join(' · '));
   lineas.push(`   ${p.estado==='pendiente'&&!p.probado?'Pendiente de su primera prueba':estados[p.estado]||'Sin estado'}`,'');
  }
 }
 lineas.push('*Resultados provisionales al momento del corte.*','Se suman las cargas válidas de los tres intentos. Los fallos aportan cero; en empate, gana el puente de menor masa. Los descalificados no reciben puesto.','', '👏 ¡Gracias a las familias por acompañar el esfuerzo, la creatividad y el trabajo en equipo de nuestros estudiantes!');
 return lineas.join('\n');
}
