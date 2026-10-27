export const categoriasPlaca={
 stem:{nombre:'S-T-E-M',detalle:'Ciencia · Tecnología · Ingeniería · Matemáticas',prefijo:'STEM',color:'#16844b',oscuro:'#10552f',claro:'#edf8f0'},
 arte:{nombre:'Arte y Creatividad',detalle:'Expresión · Imaginación · Creación',prefijo:'ART',color:'#823bb5',oscuro:'#532070',claro:'#f5eefb'},
 emprendimiento:{nombre:'Emprendimiento',detalle:'Ideas · Productos · Servicios',prefijo:'EMP',color:'#e67714',oscuro:'#833b08',claro:'#fff5e9'},
 familias:{nombre:'Emprendimientos de mamás y papás',detalle:'Familias que crean · Saberes que emprenden',prefijo:'FAM',color:'#2168b5',oscuro:'#123d70',claro:'#edf4fc'}
};
const texto=v=>String(v??'').replace(/\t/g,' ').trim();
export function validarPlaca(placa){return placa&&categoriasPlaca[placa.categoria]&&Number.isInteger(placa.numero_general)&&placa.numero_general>0&&Number.isInteger(placa.numero_categoria)&&placa.numero_categoria>0&&texto(placa.titulo)&&texto(placa.integrantes)}
export const codigoPlaca=p=>`${categoriasPlaca[p.categoria].prefijo}-${String(p.numero_categoria).padStart(3,'0')}`;
export const nombreArchivoPlaca=p=>`Placa-${codigoPlaca(p)}-Feria-STEAM-2026.pdf`;
// Una hoja carta horizontal por mesa. El código es texto nativo, legible sin color.
export function construirPlacasFeria(jsPDF,placas,{escudo,fuenteRegular,fuenteNegrita}={}){
 if(!placas.length||placas.some(p=>!validarPlaca(p)))throw new Error('La placa necesita un proyecto aprobado, su código y los nombres de los expositores.');
 const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'letter',compress:true});
 if(fuenteRegular&&fuenteNegrita){pdf.addFileToVFS('placa-regular.ttf',fuenteRegular);pdf.addFont('placa-regular.ttf','Placa','normal');pdf.addFileToVFS('placa-bold.ttf',fuenteNegrita);pdf.addFont('placa-bold.ttf','Placa','bold');}
 const fuente=fuenteRegular&&fuenteNegrita?'Placa':'helvetica';let pagina=0;
 function letra(size,bold=false,color='#19382a'){pdf.setFont(fuente,bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(color)}
 for(const placa of placas){
  const cat=categoriasPlaca[placa.categoria],codigo=codigoPlaca(placa);
  const nombres=texto(placa.integrantes).split(/\r?\n/).filter(Boolean);
  const columnas=nombres.length>8?2:1,anchoCol=columnas===2?119:245;
  const size=nombres.length>16?10:nombres.length>8?12:15;
  letra(size,true);const lineas=nombres.flatMap(n=>pdf.splitTextToSize(n,anchoCol));const paso=size*.35278*1.35;
  const porCol=Math.floor(64/paso),porHoja=porCol*columnas,totalHojas=Math.ceil(lineas.length/porHoja);
  for(let hoja=0;hoja<totalHojas;hoja++){
   if(pagina++)pdf.addPage('letter','landscape');
   pdf.setFillColor(cat.claro);pdf.rect(0,0,279.4,215.9,'F');
   pdf.setFillColor(cat.color);pdf.roundedRect(8,8,263.4,35,4,4,'F');
   letra(11,true,'#ffffff');pdf.text('FERIA STEAM 2026  /  CLAUDINA MÚNERA',16,19);
   letra(22,true,'#ffffff');let encabezadoSize=22;while(pdf.getTextWidth(cat.nombre.toUpperCase())>224)letra(--encabezadoSize,true,'#ffffff');pdf.text(cat.nombre.toUpperCase(),16,32);
   letra(9,false,'#ffffff');pdf.text(cat.detalle,16,39);
   if(escudo){pdf.setFillColor('#ffffff');pdf.roundedRect(245,12,21,26,2,2,'F');pdf.addImage(escudo,'PNG',247,14,17,21);}
   pdf.setDrawColor(cat.color);pdf.setLineWidth(.7);pdf.setFillColor('#ffffff');pdf.roundedRect(12,52,67,44,3,3,'FD');
   letra(9,true,cat.oscuro);pdf.text('CÓDIGO DEL PROYECTO',45.5,62,{align:'center'});
   let codigoSize=27;letra(codigoSize,true,cat.oscuro);while(pdf.getTextWidth(codigo)>60&&codigoSize>12)letra(--codigoSize,true,cat.oscuro);
   pdf.text(codigo,45.5,80,{align:'center'});
   letra(10,true,cat.oscuro);pdf.text(`N.º GENERAL ${String(placa.numero_general).padStart(3,'0')}`,45.5,90,{align:'center'});
   let tituloSize=26,tituloLineas;
   do{letra(tituloSize,true,cat.oscuro);tituloLineas=pdf.splitTextToSize(texto(placa.titulo),174);if(tituloLineas.length*tituloSize*.35278*1.2<=39)break;tituloSize--}while(tituloSize>13);
   pdf.text(tituloLineas,88,61,{lineHeightFactor:1.2});
   letra(10,false,cat.oscuro);pdf.text(pdf.splitTextToSize(texto(placa.institucion)||'C.E.R. Claudina Múnera',242),16,105);
   pdf.setDrawColor(cat.color);pdf.line(16,112,263,112);
   letra(10,true,cat.oscuro);pdf.text('EXPOSITORES'+(hoja?` / CONTINUACIÓN ${hoja+1} DE ${totalHojas}`:''),16,122);
   letra(size,true,cat.oscuro);const actuales=lineas.slice(hoja*porHoja,(hoja+1)*porHoja);
   actuales.forEach((linea,i)=>{const columna=Math.floor(i/porCol),fila=i%porCol;pdf.text(linea,16+columna*127,132+fila*paso)});
   if(totalHojas>1){letra(8,false,cat.oscuro);pdf.text(`Lista completa de expositores: ${totalHojas} hojas con el mismo código.`,16,198);}
   pdf.setFillColor(cat.color);pdf.rect(8,202,263.4,6,'F');letra(8,true,'#ffffff');pdf.text('6 DE NOVIEMBRE 2026  ·  UBICACIÓN DE PROYECTOS PARA JURADOS',139.7,206,{align:'center'});
  }
 }
 pdf.setProperties({title:'Placas de mesa - Feria STEAM 2026',author:'C.E.R. Claudina Múnera'});return pdf;
}
async function recurso(url){const r=await fetch(url);if(!r.ok)throw new Error('No se pudieron cargar los recursos de impresión. Revisa tu conexión.');const b=await r.blob();return new Promise((resolve,reject)=>{const lector=new FileReader();lector.onload=()=>resolve(lector.result);lector.onerror=()=>reject(new Error('No se pudo leer el recurso de impresión.'));lector.readAsDataURL(b)})}
export async function descargarPlacasFeria(placas){
 const [{jsPDF},escudoM,regularM,boldM]=await Promise.all([import('jspdf'),import('./assets/escudo-membrete.png'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const[escudo,regular,bold]=await Promise.all([recurso(escudoM.default),recurso(regularM.default),recurso(boldM.default)]);
 const pdf=construirPlacasFeria(jsPDF,placas,{escudo,fuenteRegular:regular.split(',')[1],fuenteNegrita:bold.split(',')[1]});
 pdf.save(placas.length===1?nombreArchivoPlaca(placas[0]):'Placas-Feria-STEAM-2026.pdf');
}
