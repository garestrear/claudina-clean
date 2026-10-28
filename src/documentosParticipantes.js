import escudoOriginal from './assets/escudo-original.js';
import {categoriasPlaca} from './placaFeria.js';
export const tiposParticipante={
 expositor:{nombre:'Expositor(a)',prefijo:'EXP',color:'#16844b',oscuro:'#10552f',claro:'#edf8f0'},
 evaluador:{nombre:'Evaluador(a)',prefijo:'EVA',color:'#1e527d',oscuro:'#153a58',claro:'#edf3f9'},
 logistica:{nombre:'Logística',prefijo:'LOG',color:'#c45832',oscuro:'#74351e',claro:'#fff3ed'},
 ponente:{nombre:'Ponente',prefijo:'PON',color:'#793eab',oscuro:'#512776',claro:'#f5effb'},
 asistente:{nombre:'Asistente',prefijo:'ASI',color:'#117d7b',oscuro:'#0b514f',claro:'#eaf7f6'}
};
export const temaParticipante=p=>p.tipo==='expositor'&&categoriasPlaca[p.categoria]?{...tiposParticipante.expositor,...categoriasPlaca[p.categoria],nombre:tiposParticipante.expositor.nombre}:tiposParticipante[p.tipo];
export const codigoParticipante=p=>`${tiposParticipante[p.tipo].prefijo}-${String(p.folio).padStart(4,'0')}`;
export const codigoCertificado=c=>`CM-STEAM-2026-${String(c.folio).padStart(6,'0')}`;
const limpio=v=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
const fecha=v=>new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'long',year:'numeric'}).format(new Date(v));
function fuentes(pdf,recursos){if(recursos.fuenteRegular&&recursos.fuenteNegrita){pdf.addFileToVFS('participante-regular.ttf',recursos.fuenteRegular);pdf.addFont('participante-regular.ttf','Participante','normal');pdf.addFileToVFS('participante-bold.ttf',recursos.fuenteNegrita);pdf.addFont('participante-bold.ttf','Participante','bold');return 'Participante'}return 'helvetica'}
function ajustar(pdf,texto,ancho,alto,{size=16,min=6,bold=true,fuente,color='#17372b'}={}){let lineas;pdf.setFont(fuente,bold?'bold':'normal');pdf.setTextColor(color);do{pdf.setFontSize(size);lineas=pdf.splitTextToSize(limpio(texto),ancho);if(lineas.length*size*.35278*1.15<=alto)break;size-=.5}while(size>min);return{lineas,size}}
// Cada rectángulo de corte mide exactamente 91 × 113 mm; cuatro en carta vertical.
export function construirEscarapelas(jsPDF,personas,recursos={}){
 if(!personas.length||personas.some(p=>!tiposParticipante[p.tipo]||!limpio(p.nombre)||!p.folio))throw new Error('Selecciona participantes con nombre y tipo válidos.');
 const pdf=new jsPDF({unit:'mm',format:'letter',orientation:'portrait',compress:true}),fuente=fuentes(pdf,recursos);
 personas.forEach((p,i)=>{
  if(i&&i%4===0)pdf.addPage('letter','portrait');const slot=i%4,x=11.95+(slot%2)*101,y=21.7+Math.floor(slot/2)*123,c=temaParticipante(p);
  pdf.setFillColor('#fbfbf2');pdf.rect(x,y,91,113,'F');
  // Ondas vectoriales: texto nítido y colores de la categoría, sin rasterizar el nombre.
  pdf.setFillColor(c.color);pdf.lines([[20,12,48,-15,91,-5],[0,22],[-91,0],[0,-17]],x,y+29,[1,1],'F',true);
  pdf.setFillColor(c.oscuro);pdf.lines([[27,-14,62,15,91,-3],[0,10],[-91,0],[0,-7]],x,y+44,[1,1],'F',true);
  pdf.setFont(fuente,'bold');pdf.setTextColor(c.oscuro);pdf.setFontSize(28);pdf.text('FERIA',x+6,y+12);pdf.text('STEAM',x+6,y+21);
  pdf.setTextColor(c.color);pdf.setFontSize(24);pdf.text('2026',x+6,y+30);
  pdf.setTextColor(c.oscuro);pdf.setFontSize(5.8);pdf.text(['CIENCIA','TECNOLOGÍA','INGENIERÍA','ARTE','MATEMÁTICAS'],x+62,y+7,{lineHeightFactor:1.3});
  pdf.setDrawColor(c.color);pdf.setLineWidth(.3);pdf.circle(x+77,y+32,2.3);pdf.line(x+79,y+31,x+84,y+27);pdf.circle(x+85,y+26,1.2);
  // Imagen original, proporción intacta; el mismo recurso que en la vista de la app.
  pdf.addImage(escudoOriginal,'PNG',x+39.5,y+37,12,15.6);
  const rol=tiposParticipante[p.tipo].nombre.toUpperCase();pdf.setFontSize(9);const rw=Math.max(40,pdf.getTextWidth(rol)+13);
  pdf.setFillColor(c.oscuro);pdf.roundedRect(x+(91-rw)/2,y+55,rw,7,3.5,3.5,'F');pdf.setTextColor('#ffffff');pdf.text(rol,x+45.5,y+59.8,{align:'center'});
  const nombre=ajustar(pdf,p.nombre.toUpperCase(),79,20,{size:18,min:7,fuente,color:c.oscuro});pdf.text(nombre.lineas,x+45.5,y+66,{align:'center',lineHeightFactor:1.15});
  const institucion=ajustar(pdf,(p.grado?'Grado '+limpio(p.grado)+' · ':'')+(p.institucion||'C.E.R. Claudina Múnera'),79,6,{size:7,min:4.5,bold:false,fuente,color:c.oscuro});pdf.text(institucion.lineas,x+45.5,y+85,{align:'center',lineHeightFactor:1.15});
  pdf.setDrawColor(c.color);pdf.setLineWidth(.25);pdf.line(x+7,y+92,x+84,y+92);
  if(p.proyecto_codigo){pdf.setFont(fuente,'bold');pdf.setTextColor(c.oscuro);pdf.setFontSize(14);pdf.text(p.proyecto_codigo,x+45.5,y+98,{align:'center'});const proyecto=ajustar(pdf,limpio(p.proyecto_titulo).toUpperCase(),79,7,{size:7,min:4.5,fuente,color:c.oscuro});pdf.text(proyecto.lineas,x+45.5,y+102,{align:'center',lineHeightFactor:1.15})}
  else if(p.detalle){const detalle=ajustar(pdf,p.detalle,79,13,{size:8,min:4.5,fuente,color:c.oscuro});pdf.text(detalle.lineas,x+45.5,y+96,{align:'center',lineHeightFactor:1.15})}
  pdf.setDrawColor(c.color);pdf.setLineWidth(.5);pdf.line(x,y+108,x+91,y+108);pdf.setFont(fuente,'normal');pdf.setFontSize(5.7);pdf.setTextColor(c.oscuro);pdf.text(codigoParticipante(p),x+5,y+111.5);pdf.text('6 NOV 2026',x+86,y+111.5,{align:'right'});pdf.setFont(fuente,'bold');pdf.setFontSize(7);pdf.text('Claudina App',x+45.5,y+111.5,{align:'center'});
  pdf.setDrawColor('#808b84');pdf.setLineWidth(.15);pdf.setLineDashPattern([1,1],0);pdf.rect(x,y,91,113);pdf.setLineDashPattern([],0);
 });pdf.setProperties({title:'Escarapelas 9,1 × 11,3 cm - Feria STEAM 2026',author:'C.E.R. Claudina Múnera'});return pdf;
}
export function textoCertificado(p){
 const evento=limpio(p.evento)||'Feria STEAM 2026',dia=limpio(p.fecha_evento)||'6 de noviembre de 2026';
 const accion={expositor:`participó como expositor(a)${p.proyecto_titulo?' con el proyecto «'+limpio(p.proyecto_titulo)+'»':''}${p.proyecto_codigo?' ('+p.proyecto_codigo+')':''}`,evaluador:'participó como evaluador(a) de los proyectos',logistica:'integró el equipo de logística y apoyó la organización',ponente:`participó como ponente${p.detalle?' con la actividad «'+limpio(p.detalle)+'»':''}`,asistente:'participó como asistente'}[p.tipo];
 if(!accion)throw new Error('Tipo de participante no válido.');return `${accion} en la ${evento}, realizada el ${dia} en el C.E.R. Claudina Múnera, vereda La Corrala, Caldas, Antioquia.`;
}
export function construirCertificados(jsPDF,certificados,recursos={}, {borrador=false}={}){
 if(!certificados.length||certificados.some(c=>!c.contenido?.nombre||!tiposParticipante[c.contenido.tipo]||(!borrador&&(!c.folio||!c.emitido_en||c.anulado_en))))throw new Error('El certificado debe estar emitido y vigente.');
 const pdf=new jsPDF({unit:'mm',format:'letter',orientation:'landscape',compress:true}),fuente=fuentes(pdf,recursos);
 certificados.forEach((cert,i)=>{if(i)pdf.addPage('letter','landscape');const p=cert.contenido,c=temaParticipante(p);pdf.setFillColor(c.claro);pdf.rect(0,0,279.4,215.9,'F');pdf.setDrawColor(c.color);pdf.setLineWidth(.6);pdf.rect(8,8,263.4,199.9);pdf.setFillColor(c.color);pdf.rect(8,8,4,199.9,'F');
  if(recursos.escudo)pdf.addImage(recursos.escudo,'PNG',131,15,17,21);pdf.setTextColor(c.oscuro);pdf.setFont(fuente,'bold');pdf.setFontSize(13);pdf.text('CENTRO EDUCATIVO RURAL CLAUDINA MÚNERA',139.7,45,{align:'center'});pdf.setFont(fuente,'normal');pdf.setFontSize(9);pdf.text('LA CORRALA · CALDAS, ANTIOQUIA',139.7,51,{align:'center'});pdf.setFont(fuente,'bold');pdf.setFontSize(22);pdf.text('CERTIFICADO DE PARTICIPACIÓN',139.7,65,{align:'center'});pdf.setFont(fuente,'normal');pdf.setFontSize(11);pdf.text('El C.E.R. Claudina Múnera certifica que',139.7,77,{align:'center'});
  const nombre=ajustar(pdf,p.nombre,238,22,{size:25,min:14,fuente,color:c.oscuro});pdf.text(nombre.lineas,139.7,91,{align:'center',lineHeightFactor:1.15});const institucion=ajustar(pdf,p.institucion||'',238,8,{size:9,min:7,bold:false,fuente,color:c.oscuro});pdf.text(institucion.lineas,139.7,112,{align:'center',lineHeightFactor:1.15});
  const cuerpo=ajustar(pdf,textoCertificado(p),232,28,{size:12,min:9,bold:false,fuente,color:c.oscuro});pdf.text(cuerpo.lineas,139.7,123,{align:'center',lineHeightFactor:1.15});
  pdf.setFont(fuente,'normal');pdf.setFontSize(9);pdf.setTextColor(c.oscuro);pdf.text(borrador?'Vista previa para revisión. La emisión requiere confirmar la participación.':`Se expide en Caldas, Antioquia, el ${fecha(cert.emitido_en)}.`,139.7,154,{align:'center'});
  if(recursos.firma)pdf.addImage(recursos.firma,'JPEG',114,158,51,13.9);pdf.setDrawColor(c.color);pdf.setLineWidth(.2);pdf.line(93,174,186,174);pdf.setFont(fuente,'bold');pdf.setFontSize(10);pdf.text(p.firmante||'GUSTAVO ADOLFO RESTREPO ARBOLEDA',139.7,180,{align:'center'});pdf.setFont(fuente,'normal');pdf.setFontSize(8.5);pdf.text(p.cargo||'Docente líder PRAE - Organizador Feria STEAM',139.7,186,{align:'center'});
  pdf.setFont(fuente,'bold');pdf.setFontSize(9);pdf.text(borrador?'VISTA PREVIA · SIN EMITIR':codigoCertificado(cert),139.7,199,{align:'center'});pdf.setFont(fuente,'normal');pdf.setFontSize(7);pdf.text('Feria STEAM 2026 · '+tiposParticipante[p.tipo].nombre,139.7,204,{align:'center'});
  if(borrador){pdf.setTextColor('#aa4555');pdf.setFont(fuente,'bold');pdf.setFontSize(10);pdf.text('BORRADOR',255,16,{align:'right'});}
 });pdf.setProperties({title:'Certificados - Feria STEAM 2026',author:'C.E.R. Claudina Múnera'});return pdf;
}
let recursosPromise;
async function recurso(url){const r=await fetch(url);if(!r.ok)throw new Error('No se pudieron cargar los recursos de impresión. Revisa tu conexión.');const b=await r.blob();return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=()=>reject(new Error('No se pudo leer el archivo de impresión.'));f.readAsDataURL(b)})}
async function recursos(){if(!recursosPromise)recursosPromise=(async()=>{const [{jsPDF},escudo,firma,regular,bold]=await Promise.all([import('jspdf'),import('./assets/escudo-membrete.png'),import('./assets/firma-gustavo-prae.jpg'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);const[e,f,r,b]=await Promise.all([recurso(escudo.default),recurso(firma.default),recurso(regular.default),recurso(bold.default)]);return{jsPDF,recursos:{escudo:e,firma:f,fuenteRegular:r.split(',')[1],fuenteNegrita:b.split(',')[1]}}})().catch(e=>{recursosPromise=null;throw e});return recursosPromise}
export async function descargarEscarapelas(personas){const r=await recursos();construirEscarapelas(r.jsPDF,personas,r.recursos).save(personas.length===1?`Escarapela-${codigoParticipante(personas[0])}.pdf`:'Escarapelas-Feria-STEAM-2026.pdf')}
export async function descargarCertificados(certificados,{borrador=false}={}){const r=await recursos();construirCertificados(r.jsPDF,certificados,r.recursos,{borrador}).save(borrador?'Vista-previa-certificado-STEAM.pdf':certificados.length===1?`Certificado-${codigoCertificado(certificados[0])}.pdf`:'Certificados-Feria-STEAM-2026.pdf')}
