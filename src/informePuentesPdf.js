import {categoriasPuentes,clasificacionPuentes,nombrePuenteConGrado} from './puentes.js';
const n=v=>Number(v).toLocaleString('es-CO',{maximumFractionDigits:3});
const texto=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim();
const estados={pendiente:'En competencia',en_prueba:'Intento en curso',finalizado:'Participación finalizada',descalificado:'Descalificado'};
const resultados={valida:'Válido',fallo:'Falló · aporta 0 kg',pendiente:'En curso · sin confirmar',anulada:'Anulado · aporta 0 kg'};
export function construirInformePuentesPdf(jsPDF,datos,{categoria='',fotos={},fuenteRegular,fuenteNegrita}={}){
 const pdf=new jsPDF({unit:'mm',format:'letter',compress:true});
 let font='helvetica';
 if(fuenteRegular&&fuenteNegrita){pdf.addFileToVFS('regular.ttf',fuenteRegular);pdf.addFont('regular.ttf','Informe','normal');pdf.addFileToVFS('bold.ttf',fuenteNegrita);pdf.addFont('bold.ttf','Informe','bold');font='Informe'}
 const ancho=185.9,limite=258;let y=33;
 const fecha=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',dateStyle:'long',timeStyle:'short'}).format(new Date(datos.ahora||Date.now()));
 function cabecera(){pdf.setFillColor('#123f5b');pdf.rect(0,0,215.9,25,'F');pdf.setTextColor('#ffffff');pdf.setFont(font,'bold');pdf.setFontSize(15);pdf.text('CONCURSO DE PUENTES',15,11);pdf.setFontSize(9);pdf.text('Feria STEAM · C.E.R. Claudina Múnera',15,18);pdf.setTextColor('#183449');y=33}
 function pagina(){pdf.addPage();cabecera()}
 function linea(t,{bold=false,size=10}={}){pdf.setFont(font,bold?'bold':'normal');pdf.setFontSize(size);for(const l of pdf.splitTextToSize(texto(t),ancho)){if(y+5>limite)pagina();pdf.text(l,15,y);y+=5}y+=2}
 function titulo(t){if(y+16>limite)pagina();y+=3;linea(t,{bold:true,size:13})}
 cabecera();linea('Resultados provisionales',{bold:true,size:17});linea('Corte: '+fecha+' (Colombia)');
 const categorias=Object.entries(categoriasPuentes).filter(([id])=>!categoria||categoria===id);
 const filas=categorias.flatMap(([id])=>clasificacionPuentes(datos.puentes,datos.rondas,id));
 linea(`${filas.length} puentes inscritos · ${filas.filter(p=>p.estado==='descalificado').length} descalificados`);
 linea('Se suman las cargas válidas de los tres intentos. Los fallos y anulaciones aportan cero. En empate se usa la menor masa; si falta registrarla, el desempate queda pendiente. Los descalificados no reciben puesto.');
 for(const[id,nombre]of categorias){titulo('Clasificación · '+nombre);const lista=filas.filter(p=>p.categoria===id);if(!lista.length)linea('Sin puentes inscritos.');
 for(const p of lista){linea(`${p.puesto?`${p.puesto}.`:'—'} ${nombrePuenteConGrado(p)} · ${n(p.total)} kg`,{bold:true});linea(`${p.codigo||'Sin código'} · ${p.intentos}/3 intentos · ${p.estado==='descalificado'?'Descalificado':!p.probado?'Sin prueba confirmada':estados[p.estado]||p.estado}${p.empate_masa_pendiente?' · Desempate pendiente de masa':''}`,{size:9})}}
 for(const p of filas){pagina();linea(nombrePuenteConGrado(p),{bold:true,size:16});linea(`${categoriasPuentes[p.categoria]} · ${p.codigo||'Sin código'} · ${p.puesto?'Puesto provisional '+p.puesto:'Sin puesto'}`,{bold:true});
 const foto=fotos[p.id];if(foto){try{const info=pdf.getImageProperties(foto);const w=Math.min(ancho,80*info.width/info.height),h=w*info.height/info.width;pdf.addImage(foto,'JPEG',15+(ancho-w)/2,y,w,h,undefined,'FAST');y+=h+6}catch{linea('Foto registrada no disponible en este informe.')}}else linea(p.foto_path?'Foto registrada no disponible en este informe.':'Sin foto registrada.',{size:9});
 linea('Integrantes: '+(p.integrantes||'Por registrar'));
 linea('Estado: '+(!p.probado&&p.estado==='pendiente'?'Pendiente de primera prueba':estados[p.estado]||p.estado));
 linea(`Total válido: ${n(p.total)} kg · Mejor carga: ${n(p.mejor)} kg · Intentos consumidos: ${p.intentos}/3`,{bold:true});
 linea(`Masa: ${p.masa_g==null?'Por registrar':n(p.masa_g)+' g'} · Largo: ${p.largo_cm==null?'Por registrar':n(p.largo_cm)+' cm'} · Ancho: ${p.ancho_cm==null?'Por registrar':n(p.ancho_cm)+' cm'}`);
 if(p.prediccion_kg!=null)linea('Predicción de carga: '+n(p.prediccion_kg)+' kg');
 if(p.empate_masa_pendiente)linea('Desempate pendiente: falta registrar la masa de uno o más puentes empatados.');
 if(p.motivo_fin)linea('Observaciones de cierre: '+p.motivo_fin);
 titulo('Detalle de las pruebas');const rondas=datos.rondas.filter(r=>r.puente_id===p.id).sort((a,b)=>Number(a.numero)-Number(b.numero));
 if(!rondas.length)linea('Todavía no hay pruebas registradas.');
 let intento=0;for(const r of rondas){const consume=r.cuenta_intento??r.resultado!=='anulada';if(consume)intento++;linea(`${consume?'Intento '+intento:'Prueba sin consumir intento'} · ${n(r.carga_kg)} kg · ${resultados[r.resultado]||r.resultado}`,{bold:true});if(r.motivo)linea('Observación: '+r.motivo)}
 }
 const total=pdf.getNumberOfPages();for(let i=1;i<=total;i++){pdf.setPage(i);pdf.setFont(font,'normal');pdf.setFontSize(8);pdf.setTextColor('#566676');pdf.text(`Claudina App · Resultados provisionales · Página ${i} de ${total}`,15,271)}
 pdf.setProperties({title:'Informe del concurso de puentes',subject:'Resultados provisionales con fotografías'});return pdf;
}
async function base64(url){const r=await fetch(url);if(!r.ok)throw Error('No se pudo cargar un recurso del PDF.');const b=await r.blob();return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(b)})}
export async function generarArchivoInformePuentes(datos,opciones={}){
 const [{jsPDF},{supabase},regular,bold]=await Promise.all([import('jspdf'),import('./lib/supabase'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const [r,b]=await Promise.all([base64(regular.default),base64(bold.default)]);const fotos={};
 // Sequential downloads keep memory bounded on phones; photos are embedded, never linked.
 for(const p of datos.puentes.filter(p=>p.foto_path&&(!opciones.categoria||p.categoria===opciones.categoria))){try{const{data,error}=await supabase.storage.from('feria-puentes-fotos').download(p.foto_path);if(error)throw error;const bitmap=await createImageBitmap(data);try{const canvas=document.createElement('canvas');const scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);fotos[p.id]=canvas.toDataURL('image/jpeg',.82)}finally{bitmap.close()}}catch{/* A missing photograph must not prevent the report. */}}
 const pdf=construirInformePuentesPdf(jsPDF,datos,{...opciones,fotos,fuenteRegular:r.split(',')[1],fuenteNegrita:b.split(',')[1]});
 const fecha=new Date(datos.ahora||Date.now()).toLocaleDateString('en-CA',{timeZone:'America/Bogota'});
 return new File([pdf.output('blob')],`Informe-puentes-${opciones.categoria?categoriasPuentes[opciones.categoria]+'-':''}${fecha}.pdf`,{type:'application/pdf'});
}
export function descargarArchivoInforme(archivo){const url=URL.createObjectURL(archivo);const a=document.createElement('a');a.href=url;a.download=archivo.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
