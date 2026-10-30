import {textoUbicacion} from './ubicacionFeria.js';
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
// Dos placas de media carta por hoja vertical; conserva códigos y nombres completos.
export function construirPlacasFeria(jsPDF,placas,{escudo,fuenteRegular,fuenteNegrita}={}){
 if(!placas.length||placas.some(p=>!validarPlaca(p)))throw new Error('La placa necesita un proyecto aprobado, su código y los nombres de los expositores.');
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'letter',compress:true});
 if(fuenteRegular&&fuenteNegrita){pdf.addFileToVFS('placa-regular.ttf',fuenteRegular);pdf.addFont('placa-regular.ttf','Placa','normal');pdf.addFileToVFS('placa-bold.ttf',fuenteNegrita);pdf.addFont('placa-bold.ttf','Placa','bold');}
 const fuente=fuenteRegular&&fuenteNegrita?'Placa':'helvetica';let seccion=0;
 function letra(size,bold=false,color='#19382a'){pdf.setFont(fuente,bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(color)}
 function corte(){pdf.setDrawColor('#9ca7a0');pdf.setLineWidth(.2);pdf.setLineDashPattern([2,2],0);pdf.line(6,139.7,209.9,139.7);pdf.setLineDashPattern([],0);pdf.setFillColor('#ffffff');pdf.rect(77,137.7,62,4,'F');letra(6,false,'#69766d');pdf.text('RECORTAR POR LA MITAD',107.95,140.3,{align:'center'})}
 for(const placa of placas){
  const cat=categoriasPlaca[placa.categoria],codigo=codigoPlaca(placa);
  const nombres=texto(placa.integrantes).split(/\r?\n/).filter(Boolean);
  const columnas=nombres.length>5?2:1,anchoCol=columnas===2?94:193;
  const size=nombres.length>16?9:nombres.length>5?10:12;
  letra(size,true);const lineas=nombres.flatMap(n=>pdf.splitTextToSize(n,anchoCol)),paso=size*.35278*1.28;
  const porCol=Math.floor(25/paso)+1,porParte=porCol*columnas,totalPartes=Math.ceil(lineas.length/porParte);
  for(let parte=0;parte<totalPartes;parte++){
   if(seccion>0&&seccion%2===0)pdf.addPage('letter','portrait');
   const y=seccion%2===0?0:139.7;seccion++;
   pdf.setFillColor(cat.claro);pdf.roundedRect(6,y+6,203.9,128,3,3,'F');
   pdf.setFillColor(cat.color);pdf.roundedRect(6,y+6,203.9,23,3,3,'F');
   letra(8,true,'#ffffff');pdf.text('FERIA STEAM 2026 / CLAUDINA MÚNERA',12,y+13);
   let encabezadoSize=17;letra(encabezadoSize,true,'#ffffff');while(pdf.getTextWidth(cat.nombre.toUpperCase())>169)letra(--encabezadoSize,true,'#ffffff');pdf.text(cat.nombre.toUpperCase(),12,y+21);
   letra(7,false,'#ffffff');pdf.text(cat.detalle,12,y+26);
   if(escudo){pdf.setFillColor('#ffffff');pdf.roundedRect(188,y+9,17,17,1,1,'F');pdf.addImage(escudo,'PNG',191,y+10,11,15);}
   pdf.setDrawColor(cat.color);pdf.setLineWidth(.5);pdf.setFillColor('#ffffff');pdf.roundedRect(10,y+35,52,31,2,2,'FD');
   letra(7,true,cat.oscuro);pdf.text('CÓDIGO DEL PROYECTO',36,y+42,{align:'center'});
   let codigoSize=23;letra(codigoSize,true,cat.oscuro);while(pdf.getTextWidth(codigo)>47&&codigoSize>10)letra(--codigoSize,true,cat.oscuro);pdf.text(codigo,36,y+53,{align:'center'});
   letra(8,true,cat.oscuro);pdf.text(`N.º GENERAL ${String(placa.numero_general).padStart(3,'0')}`,36,y+62,{align:'center'});
   let tituloSize=20,tituloLineas;
   do{letra(tituloSize,true,cat.oscuro);tituloLineas=pdf.splitTextToSize(texto(placa.titulo),136);if(tituloLineas.length*tituloSize*.35278*1.15<=29)break;tituloSize--}while(tituloSize>10);
   pdf.text(tituloLineas,69,y+42,{lineHeightFactor:1.15});
   letra(8,false,cat.oscuro);pdf.text(pdf.splitTextToSize(texto(placa.institucion)||'C.E.R. Claudina Múnera',193),11,y+74);
   pdf.setDrawColor(cat.color);pdf.line(11,y+82,204,y+82);
   letra(8,true,cat.oscuro);pdf.text('EXPOSITORES'+(parte?` / CONTINUACIÓN ${parte+1} DE ${totalPartes}`:''),11,y+88);
   letra(size,true,cat.oscuro);lineas.slice(parte*porParte,(parte+1)*porParte).forEach((linea,i)=>{const columna=Math.floor(i/porCol),fila=i%porCol;pdf.text(linea,11+columna*99,y+94+fila*paso)});
   letra(10,true,cat.oscuro);const ubicacion=textoUbicacion(placa);let ubicacionSize=10;while(pdf.getTextWidth(ubicacion)>193&&ubicacionSize>5)letra(--ubicacionSize,true,cat.oscuro);pdf.text(pdf.splitTextToSize(ubicacion,193).slice(0,2),11,y+125,{lineHeightFactor:1.05});
   pdf.setFillColor(cat.color);pdf.rect(6,y+129,203.9,5,'F');letra(6.5,true,'#ffffff');pdf.text('6 NOVIEMBRE 2026 · UBICACIÓN DE PROYECTOS PARA JURADOS'+(totalPartes>1?` · PARTE ${parte+1}/${totalPartes}`:''),107.95,y+132.5,{align:'center'});
   corte();
  }
 }
 pdf.setProperties({title:'Placas de mesa - Dos por hoja carta - Feria STEAM 2026',author:'C.E.R. Claudina Múnera'});return pdf;
}
async function recurso(url){const r=await fetch(url);if(!r.ok)throw new Error('No se pudieron cargar los recursos de impresión. Revisa tu conexión.');const b=await r.blob();return new Promise((resolve,reject)=>{const lector=new FileReader();lector.onload=()=>resolve(lector.result);lector.onerror=()=>reject(new Error('No se pudo leer el recurso de impresión.'));lector.readAsDataURL(b)})}
export async function descargarPlacasFeria(placas){
 const [{jsPDF},escudoM,regularM,boldM]=await Promise.all([import('jspdf'),import('./assets/escudo-membrete.png'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const[escudo,regular,bold]=await Promise.all([recurso(escudoM.default),recurso(regularM.default),recurso(boldM.default)]);
 const pdf=construirPlacasFeria(jsPDF,placas,{escudo,fuenteRegular:regular.split(',')[1],fuenteNegrita:bold.split(',')[1]});
 pdf.save(placas.length===1?nombreArchivoPlaca(placas[0]):'Placas-Feria-STEAM-2026.pdf');
}
