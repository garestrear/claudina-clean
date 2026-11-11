import {textoFeria,nombreFeria} from './estiloTextoFeria.js';
import {textoUbicacionEscarapela} from './ubicacionFeria.js';
import escudoOriginal from './assets/escudo-original.js';
import {firmantesPredeterminados,prepararFirma} from './firmasCertificados.js';
import {categoriasPlaca} from './placaFeria.js';
export const tiposParticipante={
 expositor:{nombre:'Expositor(a)',prefijo:'EXP',color:'#16844b',oscuro:'#10552f',claro:'#edf8f0'},
 evaluador:{nombre:'Jurado',prefijo:'EVA',color:'#1e527d',oscuro:'#153a58',claro:'#edf3f9'},
 profesor:{nombre:'Profesor(a)',prefijo:'PRO',color:'#146b82',oscuro:'#104759',claro:'#edf7fa'},
 logistica:{nombre:'Logística',prefijo:'LOG',color:'#c45832',oscuro:'#74351e',claro:'#fff3ed'},
 ponente:{nombre:'Ponente',prefijo:'PON',color:'#793eab',oscuro:'#512776',claro:'#f5effb'},
 asistente:{nombre:'Asistente',prefijo:'ASI',color:'#117d7b',oscuro:'#0b514f',claro:'#eaf7f6'}
};
export const tiposEscarapelaEnBlanco={
 expositor:{...tiposParticipante.expositor,nombre:'Expositor'},
 lider_aula:{nombre:'Líder de aula',color:'#1e527d',oscuro:'#153a58',claro:'#edf3f9'},
 lider_rotacion:{nombre:'Líder de rotación',color:'#c45832',oscuro:'#74351e',claro:'#fff3ed'},
 invitado_especial:{nombre:'Invitado especial',color:'#793eab',oscuro:'#512776',claro:'#f5effb'}
};
export function prepararEscarapelasEnBlanco(tipo,cantidad){
 if(!Object.hasOwn(tiposEscarapelaEnBlanco,tipo)||!Number.isInteger(cantidad)||cantidad<1||cantidad>100)throw new Error('Selecciona un tipo y una cantidad entre 1 y 100.');
 return Array.from({length:cantidad},()=>({tipo,enBlanco:true}));
}
export const temaParticipante=p=>p.enBlanco?tiposEscarapelaEnBlanco[p.tipo]:p.tipo==='expositor'&&categoriasPlaca[p.categoria]?{...tiposParticipante.expositor,...categoriasPlaca[p.categoria],nombre:tiposParticipante.expositor.nombre}:tiposParticipante[p.tipo];
export const codigoParticipante=p=>`${tiposParticipante[p.tipo].prefijo}-${String(p.folio).padStart(4,'0')}`;
export const codigoCertificado=c=>`CM-STEAM-2026-${String(c.folio).padStart(6,'0')}`;
const limpio=v=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
const fecha=v=>new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'long',year:'numeric'}).format(new Date(v));
function fuentes(pdf,recursos){if(recursos.fuenteRegular&&recursos.fuenteNegrita){pdf.addFileToVFS('participante-regular.ttf',recursos.fuenteRegular);pdf.addFont('participante-regular.ttf','Participante','normal');pdf.addFileToVFS('participante-bold.ttf',recursos.fuenteNegrita);pdf.addFont('participante-bold.ttf','Participante','bold');return 'Participante'}return 'helvetica'}
function ajustar(pdf,texto,ancho,alto,{size=16,min=6,bold=true,fuente,color='#17372b'}={}){let lineas;pdf.setFont(fuente,bold?'bold':'normal');pdf.setTextColor(color);do{pdf.setFontSize(size);lineas=pdf.splitTextToSize(limpio(texto),ancho);if(lineas.length*size*.35278*1.15<=alto)break;size-=.5}while(size>min);return{lineas,size}}
// Cada rectángulo de corte mide exactamente 91 × 113 mm; cuatro en carta vertical.
export function construirEscarapelas(jsPDF,personas,recursos={}){
 if(!personas.length||personas.some(p=>p.enBlanco?!Object.hasOwn(tiposEscarapelaEnBlanco,p.tipo):!tiposParticipante[p.tipo]||!limpio(p.nombre)||!p.folio))throw new Error('Selecciona participantes con nombre y tipo válidos.');
 const pdf=new jsPDF({unit:'mm',format:'letter',orientation:'portrait',compress:true}),fuente=fuentes(pdf,recursos);
 personas.forEach((p,i)=>{
  if(i&&i%4===0)pdf.addPage('letter','portrait');const slot=i%4,x=11.95+(slot%2)*101,y=21.7+Math.floor(slot/2)*123,c=temaParticipante(p);
  pdf.setFillColor('#fbfbf2');pdf.rect(x,y,91,113,'F');
  // Ondas vectoriales: texto nítido y colores de la categoría, sin rasterizar el nombre.
  pdf.setFillColor(c.color);pdf.lines([[20,12,48,-15,91,-5],[0,22],[-91,0],[0,-17]],x,y+29,[1,1],'F',true);
  pdf.setFillColor(c.oscuro);pdf.lines([[27,-14,62,15,91,-3],[0,10],[-91,0],[0,-7]],x,y+44,[1,1],'F',true);
  pdf.setFont(fuente,'bold');pdf.setTextColor(c.oscuro);pdf.setFontSize(28);pdf.text('Feria',x+6,y+12);pdf.text('STEAM',x+6,y+21);
  pdf.setTextColor(c.color);pdf.setFontSize(24);pdf.text('2026',x+6,y+30);
  pdf.setTextColor(c.oscuro);pdf.setFontSize(5.8);pdf.text(['Ciencia','Tecnología','Ingeniería','Arte','Matemáticas'],x+62,y+7,{lineHeightFactor:1.3});
  pdf.setDrawColor(c.color);pdf.setLineWidth(.3);pdf.circle(x+77,y+32,2.3);pdf.line(x+79,y+31,x+84,y+27);pdf.circle(x+85,y+26,1.2);
  // Imagen original, proporción intacta; el mismo recurso que en la vista de la app.
  pdf.addImage(escudoOriginal,'PNG',x+39.5,y+37,12,15.6);
  const rol=(p.enBlanco?tiposEscarapelaEnBlanco[p.tipo]:tiposParticipante[p.tipo]).nombre;pdf.setFontSize(9);const rw=Math.max(40,pdf.getTextWidth(rol)+13);
  pdf.setFillColor(c.oscuro);pdf.roundedRect(x+(91-rw)/2,y+55,rw,7,3.5,3.5,'F');pdf.setTextColor('#ffffff');pdf.text(rol,x+45.5,y+59.8,{align:'center'});
  if(p.enBlanco){
   pdf.setDrawColor('#7b837f');pdf.setLineWidth(.2);
   const campos=p.tipo==='expositor'?[[68,'Nombre'],[78,'Grado / institución'],[88,'Proyecto'],[99,'Aula y puesto']]:p.tipo==='lider_aula'?[[72,'Nombre'],[87,'Institución'],[99,'Aula']]:p.tipo==='lider_rotacion'?[[72,'Nombre'],[87,'Institución'],[99,'Grupo de rotación']]:[[72,'Nombre'],[87,'Institución'],[99,'Cargo / entidad']];
   campos.forEach(([alto,etiqueta])=>{pdf.setFont(fuente,'normal');pdf.setFontSize(6);pdf.setTextColor(c.oscuro);pdf.text(etiqueta,x+7,y+alto);pdf.line(x+7,y+alto+7,x+84,y+alto+7)});
  }else{
  const nombre=ajustar(pdf,nombreFeria(p.nombre),79,12,{size:18,min:7,fuente,color:c.oscuro});pdf.text(nombre.lineas,x+45.5,y+72,{align:'center',lineHeightFactor:1.15});
  const institucion=ajustar(pdf,(p.grado?'Grado '+limpio(p.grado)+' · ':'')+nombreFeria(p.institucion||'C.E.R. Claudina Múnera'),79,6,{size:7,min:4.5,bold:false,fuente,color:c.oscuro});pdf.text(institucion.lineas,x+45.5,y+85,{align:'center',lineHeightFactor:1.15});
  pdf.setDrawColor(c.color);pdf.setLineWidth(.25);pdf.line(x+7,y+92,x+84,y+92);
  if(p.proyecto_codigo){pdf.setFont(fuente,'bold');pdf.setTextColor(c.oscuro);pdf.setFontSize(11);pdf.text(p.proyecto_codigo,x+45.5,y+97,{align:'center'});const proyecto=ajustar(pdf,textoFeria(p.proyecto_titulo),79,4,{size:6,min:4.5,fuente,color:c.oscuro});pdf.text(proyecto.lineas,x+45.5,y+100,{align:'center',lineHeightFactor:1.15});const aula=ajustar(pdf,textoUbicacionEscarapela(p),79,6,{size:8,min:4,fuente,color:c.oscuro});pdf.text(aula.lineas,x+45.5,y+104,{align:'center',lineHeightFactor:1.05})}
  else if(p.detalle){const detalle=ajustar(pdf,textoFeria(p.detalle),79,13,{size:8,min:4.5,fuente,color:c.oscuro});pdf.text(detalle.lineas,x+45.5,y+96,{align:'center',lineHeightFactor:1.15})}
  }
  pdf.setDrawColor(c.color);pdf.setLineWidth(.5);pdf.line(x,y+108,x+91,y+108);pdf.setFont(fuente,'normal');pdf.setFontSize(5.7);pdf.setTextColor(c.oscuro);pdf.text(p.enBlanco?'':codigoParticipante(p),x+5,y+111.5);pdf.text('6 nov 2026',x+86,y+111.5,{align:'right'});pdf.setFont(fuente,'bold');pdf.setFontSize(7);pdf.text('Claudina App',x+45.5,y+111.5,{align:'center'});
  pdf.setDrawColor('#808b84');pdf.setLineWidth(.15);pdf.setLineDashPattern([1,1],0);pdf.rect(x,y,91,113);pdf.setLineDashPattern([],0);
 });pdf.setProperties({title:'Escarapelas 9,1 × 11,3 cm - Feria STEAM 2026',author:'C.E.R. Claudina Múnera'});return pdf;
}
export function textoCertificado(p){
 const evento=limpio(p.evento)||'Feria STEAM 2026',dia=limpio(p.fecha_evento)||'6 de noviembre de 2026';
 const accion={expositor:`participó como expositor(a)${p.proyecto_titulo?' con el proyecto «'+textoFeria(p.proyecto_titulo)+'»':''}`,evaluador:'participó como jurado de los proyectos',profesor:'participó como docente',logistica:'integró el equipo de logística y apoyó la organización',ponente:`participó como ponente${p.detalle?' con la actividad «'+textoFeria(p.detalle)+'»':''}`,asistente:'participó como asistente'}[p.tipo];
 if(!accion)throw new Error('Tipo de participante no válido.');return `${accion.charAt(0).toLocaleUpperCase('es')+accion.slice(1)} en la ${evento}, realizada el ${dia} en el C.E.R. Claudina Múnera, vereda La Corrala, Caldas, Antioquia.`;
}
export function construirCertificados(jsPDF,certificados,recursos={}, {borrador=false,mencion=false}={}){
 if(!certificados.length||certificados.some(c=>!c.contenido?.nombre||!tiposParticipante[c.contenido.tipo]||(!borrador&&((!mencion&&!c.folio)||!c.emitido_en||c.anulado_en))))throw new Error('El certificado debe estar emitido y vigente.');
 const pdf=new jsPDF({unit:'mm',format:'letter',orientation:'landscape',compress:true}),fuente=fuentes(pdf,recursos);
 certificados.forEach((cert,i)=>{
  if(i)pdf.addPage('letter','landscape');const p=cert.contenido,c=temaParticipante(p);
  const tinta='#0b2f70',azul='#0754d8';
  if(!recursos.fondoCertificado)throw new Error('No se pudo cargar el diseño del certificado. Actualiza la app e inténtalo otra vez.');
  pdf.addImage(recursos.fondoCertificado,'PNG',0,0,279.4,215.9);
  // Fondo ilustrado aprobado; escudo, textos y firmas se añaden como datos independientes.
  pdf.addImage(escudoOriginal,'PNG',37,21,18,23.4);
  pdf.setTextColor(tinta);pdf.setFont(fuente,'bold');pdf.setFontSize(13);pdf.text('Centro Educativo Rural Claudina Múnera',139.7,30,{align:'center'});
  pdf.setFont(fuente,'normal');pdf.setFontSize(8);pdf.text('Vereda La Corrala · Caldas, Antioquia',139.7,38,{align:'center'});
  const resolucion=ajustar(pdf,'Aprobado por Resolución Departamental n.º S201500094400 del 12 de marzo de 2015',184,7,{size:7.5,min:6.5,bold:false,fuente,color:tinta});pdf.text(resolucion.lineas,139.7,44,{align:'center',lineHeightFactor:1.15});
  pdf.setFillColor(azul);pdf.roundedRect(99.7,55,80,10,5,5,'F');pdf.setFont(fuente,'bold');pdf.setFontSize(12);pdf.setTextColor('#ffffff');pdf.text('Feria STEAM 2026',139.7,61.8,{align:'center'});
  pdf.setTextColor(azul);pdf.setFontSize(34);pdf.text('Certificado',139.7,81,{align:'center'});
  pdf.setTextColor(tinta);pdf.setFont(fuente,'bold');pdf.setFontSize(10);pdf.text(mencion?'Mención de honor':'De participación',139.7,90,{align:'center'});
  pdf.setDrawColor('#ffc31a');pdf.setLineWidth(1);pdf.line(103,101,176.4,101);
  pdf.setFont(fuente,'bold');pdf.setFontSize(11);pdf.text('¡Tus ideas pueden cambiar el mundo!',139.7,98,{align:'center'});
  const nombre=ajustar(pdf,nombreFeria(p.nombre),184,16,{size:25,min:10,fuente,color:tinta});pdf.text(nombre.lineas,139.7,112,{align:'center',lineHeightFactor:1.15});
  const institucion=ajustar(pdf,mencion?textoFeria(p.integrantes):nombreFeria(p.institucion),184,mencion?10:6,{size:9,min:mencion?5:6,bold:false,fuente,color:tinta});if(mencion&&institucion.lineas.length*institucion.size*.35278*1.15>10)throw new Error('La lista de integrantes es demasiado extensa para el certificado. Revisa los nombres del proyecto.');pdf.text(institucion.lineas,139.7,mencion?124:128,{align:'center',lineHeightFactor:1.15});
  const firmantes=Array.isArray(p.firmantes)&&p.firmantes.length>=1&&p.firmantes.length<=6?p.firmantes:firmantesPredeterminados.map((f,n)=>({...f,firma:n===1?recursos.firmaTransparente:null}));
  const dosFilas=firmantes.length>3;
  const cuerpo=ajustar(pdf,mencion?`Por su destacada participación en la Feria STEAM 2026, realizada el 6 de noviembre de 2026 en el C.E.R. Claudina Múnera, vereda La Corrala, Caldas, Antioquia. ${limpio(p.motivo)}`:textoCertificado(p),184,dosFilas?12:17,{size:dosFilas?10:11,min:6,bold:false,fuente,color:tinta});pdf.text(cuerpo.lineas,139.7,138,{align:'center',lineHeightFactor:1.15});
  pdf.setFont(fuente,'normal');pdf.setFontSize(7);pdf.setTextColor(tinta);pdf.text(borrador?(mencion?'Vista previa para revisión. Pendiente de emisión.':'Vista previa para revisión. Pendiente de confirmar la participación.'):`Se expide en Caldas, Antioquia, el ${fecha(cert.emitido_en)}.`,139.7,dosFilas?153:161,{align:'center'});
  pdf.setFillColor('#ffffff');pdf.roundedRect(47.7,dosFilas?155:166,184,dosFilas?47:36,3,3,'F');
  firmantes.forEach((f,n)=>{
   const fila=Math.floor(n/3),cantidadFila=Math.min(3,firmantes.length-fila*3),anchoCelda=184/cantidadFila,ancho=Math.min(84,anchoCelda-7);
   const centro=47.7+anchoCelda*(n%3+.5),linea=dosFilas?167+fila*23:184,altoFirma=dosFilas?10:16;
   if(f.firma){const info=pdf.getImageProperties(f.firma),ratio=info.width/info.height,w=Math.min(ancho-8,50,altoFirma*ratio),h=w/ratio;pdf.addImage(f.firma,'PNG',centro-w/2,linea-2-h,w,h);}
   pdf.setDrawColor(c.color);pdf.setLineWidth(.25);pdf.line(centro-ancho/2,linea,centro+ancho/2,linea);
   const nombreFirma=ajustar(pdf,nombreFeria(f.nombre),ancho,dosFilas?5:7,{size:cantidadFila===3?7.5:9,min:4.5,fuente,color:tinta});pdf.text(nombreFirma.lineas,centro,linea+4,{align:'center',lineHeightFactor:1.15});
   const cargo=ajustar(pdf,textoFeria(f.cargo),ancho,dosFilas?5:7,{size:7,min:4.5,bold:false,fuente,color:tinta});pdf.text(cargo.lineas,centro,linea+(dosFilas?9:11),{align:'center',lineHeightFactor:1.15});
  });
  pdf.setFillColor('#ffffff');pdf.roundedRect(47.7,203,184,5,1,1,'F');
  pdf.setFont(fuente,'normal');pdf.setFontSize(5.3);pdf.setTextColor(tinta);pdf.text(borrador?'Vista previa · Sin emitir':mencion?'Reconocimiento al proyecto · Feria STEAM 2026':codigoCertificado(cert),47.7,206);
  pdf.text('Ciencia · Tecnología · Ingeniería · Arte · Matemáticas',231.7,206,{align:'right'});
  if(borrador){pdf.setTextColor('#aa4555');pdf.setFont(fuente,'bold');pdf.setFontSize(9);pdf.text('Borrador',229,50,{align:'right'});}
 });pdf.setProperties({title:'Certificados - Feria STEAM 2026',author:'C.E.R. Claudina Múnera'});return pdf;
}

let recursosPromise;
async function recurso(url){const r=await fetch(url);if(!r.ok)throw new Error('No se pudieron cargar los recursos de impresión. Revisa tu conexión.');const b=await r.blob();return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(new Error('No se pudo leer el archivo de impresión.'));f.readAsDataURL(b)})}
async function recursos(){if(!recursosPromise)recursosPromise=(async()=>{const [{jsPDF},escudo,firma,regular,bold]=await Promise.all([import('jspdf'),import('./assets/escudo-membrete.png'),import('./assets/firma-gustavo-prae.jpg'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);const[e,f,r,b]=await Promise.all([recurso(escudo.default),recurso(firma.default),recurso(regular.default),recurso(bold.default)]);const firmaTransparente=await prepararFirma(await(await fetch(firma.default)).blob());return{jsPDF,recursos:{escudo:e,firma:f,firmaTransparente,fuenteRegular:r.split(',')[1],fuenteNegrita:b.split(',')[1]}}})().catch(e=>{recursosPromise=null;throw e});return recursosPromise}
export async function descargarEscarapelas(personas){const r=await recursos();construirEscarapelas(r.jsPDF,personas,r.recursos).save(personas.length===1?`Escarapela-${codigoParticipante(personas[0])}.pdf`:'Escarapelas-Feria-STEAM-2026.pdf')}
let fondoCertificadoPromise;
async function cargarFondoCertificado(){if(!fondoCertificadoPromise)fondoCertificadoPromise=import('./assets/certificado-steam-juvenil.png').then(m=>recurso(m.default)).catch(e=>{fondoCertificadoPromise=null;throw e});return fondoCertificadoPromise}
export async function descargarCertificados(certificados,{borrador=false}={}){const[r,fondoCertificado]=await Promise.all([recursos(),cargarFondoCertificado()]);construirCertificados(r.jsPDF,certificados,{...r.recursos,fondoCertificado},{borrador}).save(borrador?'Vista-previa-certificado-STEAM.pdf':certificados.length===1?`Certificado-${codigoCertificado(certificados[0])}.pdf`:'Certificados-Feria-STEAM-2026.pdf')}

export async function descargarEscarapelasEnBlanco(tipo,cantidad){const personas=prepararEscarapelasEnBlanco(tipo,cantidad),r=await recursos();construirEscarapelas(r.jsPDF,personas,r.recursos).save(`Escarapelas-en-blanco-${tipo}.pdf`)}

// Reconocimiento colectivo por decisión docente; no usa folios de participación.
export function prepararMencion(proyecto,{motivo='',firmantes}={}){
 const p=proyecto.datos||proyecto;
 const nombre=limpio(p.titulo).replace(/^\[Emprendimiento familiar\] /,'');
 const integrantes=limpio(p.titulo).startsWith('[Emprendimiento familiar] ')?limpio(p.materiales):limpio(p.integrantes);
 if(!nombre||!integrantes)throw new Error('Completa el título y los integrantes del proyecto antes de generar la mención.');
 if(limpio(motivo).length>300)throw new Error('El motivo debe tener como máximo 300 caracteres.');
 if(!Array.isArray(firmantes)||firmantes.length<1||firmantes.length>6||firmantes.some(f=>!limpio(f.nombre)||!limpio(f.cargo)))throw new Error('Revisa los firmantes en Participantes y certificados.');
 return {emitido_en:new Date().toISOString(),contenido:{tipo:'expositor',nombre,integrantes,motivo:limpio(motivo),firmantes}};
}
export async function descargarMencion(proyecto,opciones={}){
 const certificado=prepararMencion(proyecto,opciones);
 const [r,fondoCertificado]=await Promise.all([recursos(),cargarFondoCertificado()]);
 const pdf=construirCertificados(r.jsPDF,[certificado],{...r.recursos,fondoCertificado},{mencion:true,borrador:!!opciones.borrador});
 pdf.setProperties({title:'Mención de honor - '+certificado.contenido.nombre,author:'C.E.R. Claudina Múnera'});
 pdf.save(opciones.borrador?'Vista-previa-mencion-de-honor.pdf':'Mencion-de-honor-STEAM-2026.pdf');
}
