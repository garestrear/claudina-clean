import {feriaEvento as feria} from './feriaEvento.js';
const limpio=v=>String(v||'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
export function nombreArchivoJurado(nombre){
 const parte=limpio(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'Jurado';
 return `Invitacion-Jurado-${parte}-Feria-STEAM-2026.pdf`;
}
// Texto nativo en PDF, sin depender de imprimir ni de una captura de pantalla.
export function construirCartaJurado(jsPDF,jurado,{escudo,firma,fuenteRegular,fuenteNegrita,fecha=new Date()}={}){
 if(!limpio(jurado?.nombre)||!limpio(jurado?.institucion))throw new Error('Faltan el nombre o la institución de la persona inscrita.');
 const pdf=new jsPDF({unit:'mm',format:'letter',compress:true});
 if(fuenteRegular&&fuenteNegrita){pdf.addFileToVFS('carta-regular.ttf',fuenteRegular);pdf.addFont('carta-regular.ttf','Carta','normal');pdf.addFileToVFS('carta-bold.ttf',fuenteNegrita);pdf.addFont('carta-bold.ttf','Carta','bold');}
 const fuente=fuenteRegular&&fuenteNegrita?'Carta':'helvetica';
 const ancho=215.9,alto=279.4,margen=19,util=ancho-2*margen;let y;
 function cabecera(){
  pdf.setDrawColor(112,48,160);pdf.setLineWidth(.45);pdf.rect(8,7,ancho-16,alto-16);
  if(escudo)pdf.addImage(escudo,'PNG',101,9,14,15);
  pdf.setTextColor(0);pdf.setFont(fuente,'bold');pdf.setFontSize(10.5);
  pdf.text('CENTRO EDUCATIVO RURAL CLAUDINA MÚNERA',ancho/2,28,{align:'center'});
  pdf.text('CALDAS - ANTIOQUIA',ancho/2,33,{align:'center'});
  pdf.text('RESOLUCIÓN 201500094400 12/03/2015',ancho/2,38,{align:'center'});
  pdf.setFont(fuente,'normal');pdf.text('CÓDIGO DANE: 205129000156',ancho/2,43,{align:'center'});
  pdf.text('NIT: 811011120-5',ancho/2,48,{align:'center'});
  pdf.setDrawColor(65,110,190);pdf.setLineWidth(.45);pdf.line(52,51,170,51);
  pdf.line(35,258,186,258);pdf.setFontSize(9.5);
  pdf.text('Vereda La Corrala - Caldas, Antioquia.',ancho/2,263,{align:'center'});
  pdf.text('e-mail: direccioncm2024@claudinamunera.edu.co',ancho/2,268,{align:'center'});
  y=58;
 }
 function espacio(h){if(y+h>251){pdf.addPage();cabecera();}}
 function texto(t,{negrita=false,tamano=11,despues=3}={}){
  pdf.setFont(fuente,negrita?'bold':'normal');pdf.setFontSize(tamano);
  const lineas=pdf.splitTextToSize(t,util);const paso=tamano*.35278*1.18;
  espacio(lineas.length*paso+despues);
  // cabecera puede cambiar la fuente al saltar de página.
  pdf.setFont(fuente,negrita?'bold':'normal');pdf.setFontSize(tamano);
  for(const linea of lineas){espacio(paso);pdf.setFont(fuente,negrita?'bold':'normal');pdf.setFontSize(tamano);pdf.text(linea,margen,y);y+=paso;}
  y+=despues;
 }
 cabecera();
 const fechaCarta=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'long',year:'numeric'}).format(fecha);
 texto('Caldas, Antioquia, '+fechaCarta,{despues:5});
 texto('Señor(a)',{despues:0});texto(limpio(jurado.nombre),{negrita:true,despues:0});
 if(limpio(jurado.profesion))texto(limpio(jurado.profesion),{despues:0});
 texto(limpio(jurado.institucion),{despues:5});
 texto('Asunto: Invitación como jurado de la Feria STEAM 2026',{negrita:true,despues:5});
 texto('Cordial saludo:');
 texto(`El Centro Educativo Rural Claudina Múnera tiene el gusto de invitarle a participar como jurado en nuestra ${feria.nombre}, que se realizará el ${feria.fecha}, de ${feria.horario}, en nuestra institución, ubicada en la vereda La Corrala del municipio de Caldas, Antioquia.`);
 texto('Este encuentro integra las ciencias, la tecnología, la ingeniería, las artes y las matemáticas. Estudiantes de primaria y secundaria compartirán sus proyectos y experiencias con las familias, la comunidad y las entidades invitadas.');
 texto('Su experiencia será un valioso aporte para valorar los proyectos, reconocer los aprendizajes y ofrecer recomendaciones que motiven a nuestros estudiantes a continuar sus procesos de investigación y creación.');
 texto(`En caso de ser posible contar con su participación, le agradeceríamos confirmar su disponibilidad al correo ${feria.correo} o al celular ${feria.contacto}, para coordinar la evaluación y compartir las orientaciones de la jornada.`);
 texto('Agradecemos su atención y esperamos contar con su acompañamiento.',{despues:4});
 espacio(46);
 texto('Con aprecio,',{despues:2});
 texto('Equipo PRAE C.E.R. Claudina Múnera.',{despues:0});
 texto('Original firmado en su representación por:',{despues:1});
 if(firma){pdf.addImage(firma,'JPEG',margen,y-1,43,11.7);y+=12;}
 pdf.setDrawColor(0);pdf.setLineWidth(.2);pdf.line(margen,y,margen+78,y);y+=4;
 texto(feria.firmante,{negrita:true,tamano:10.5,despues:0});
 texto(`C.C. ${feria.documento} - ${feria.cargo}`,{tamano:10.5,despues:0});
 texto(`Celular: ${feria.contacto} - Correo: ${feria.correo}`,{tamano:10.5,despues:0});
 pdf.setProperties({title:`Invitación como jurado - ${limpio(jurado.nombre)}`,author:'Equipo PRAE C.E.R. Claudina Múnera',subject:'Feria STEAM 2026 - Invitación a ser jurado'});
 return pdf;
}
async function imagen(url){
 const r=await fetch(url);if(!r.ok)throw new Error('No se pudo cargar el membrete o la firma. Revisa tu conexión e intenta de nuevo.');
 const blob=await r.blob();return await new Promise((resolve,reject)=>{const lector=new FileReader();lector.onload=()=>resolve(lector.result);lector.onerror=()=>reject(new Error('No se pudo cargar la imagen institucional.'));lector.readAsDataURL(blob)});
}
export async function descargarCartaJurado(jurado){
 const [{jsPDF},escudoModulo,firmaModulo,regularModulo,boldModulo]=await Promise.all([import('jspdf'),import('./assets/escudo-membrete.png'),import('./assets/firma-gustavo-prae.jpg'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const [escudo,firma,regular,bold]=await Promise.all([imagen(escudoModulo.default),imagen(firmaModulo.default),imagen(regularModulo.default),imagen(boldModulo.default)]);
 const pdf=construirCartaJurado(jsPDF,jurado,{escudo,firma,fuenteRegular:regular.split(',')[1],fuenteNegrita:bold.split(',')[1]});pdf.save(nombreArchivoJurado(jurado.nombre));
}
