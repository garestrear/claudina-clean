import {nombreFeria,textoFeria} from './estiloTextoFeria.js';
import {claveProyecto} from './evaluacionJurados.js';
import {feriaEvento as feria} from './feriaEvento.js';
const limpio=v=>String(v||'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
export function nombreArchivoJurado(nombre){
 const parte=limpio(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'Jurado';
 return `Invitacion-Jurado-${parte}-Feria-STEAM-2026.pdf`;
}
export function saludoJurado(jurado){
 const nombre=nombreFeria(limpio(jurado?.nombre)).split(' ')[0];
 return jurado?.genero==='F'?`Apreciada ${nombre}:`:jurado?.genero==='M'?`Apreciado ${nombre}:`:`Recibe un cordial saludo, ${nombre}:`;
}
// Texto nativo en PDF, sin depender de imprimir ni de una captura de pantalla.
export function construirCartaJurado(jsPDF,jurado,{escudo,firma,fuenteRegular,fuenteNegrita,fecha=new Date(),recorrido,pdf:documento}={}){
 if(!limpio(jurado?.nombre)||(!recorrido&&!limpio(jurado?.institucion)))throw new Error('Falta el nombre o la institución de la persona inscrita.');
 const pdf=documento||new jsPDF({unit:'mm',format:'letter',compress:true});const primeraPagina=documento?pdf.getNumberOfPages()+1:1;if(documento)pdf.addPage('letter','portrait');
 if(fuenteRegular&&fuenteNegrita){pdf.addFileToVFS('carta-regular.ttf',fuenteRegular);pdf.addFont('carta-regular.ttf','Carta','normal');pdf.addFileToVFS('carta-bold.ttf',fuenteNegrita);pdf.addFont('carta-bold.ttf','Carta','bold');}
 const fuente=fuenteRegular&&fuenteNegrita?'Carta':'helvetica';
 const ancho=215.9,alto=279.4,margen=19,util=ancho-2*margen;let y;
 function cabecera(){
  pdf.setTextColor(0);pdf.setDrawColor(90,120,100);pdf.setLineWidth(.35);
  if(escudo)pdf.addImage(escudo,'PNG',margen,12,16,17);
  pdf.setFont(fuente,'bold');pdf.setFontSize(10.2);
  pdf.text('CENTRO EDUCATIVO RURAL CLAUDINA MÚNERA',118,18,{align:'center'});
  pdf.setFont(fuente,'normal');pdf.setFontSize(9);
  pdf.text('Caldas - Antioquia · Vereda La Corrala',118,23,{align:'center'});
  pdf.setFontSize(7.3);
  pdf.text('Resolución 201500094400 (12/03/2015) · DANE: 205129000156 · NIT: 811011120-5',118,28,{align:'center'});
  pdf.setFontSize(8);pdf.text('direccioncm2024@claudinamunera.edu.co',118,33,{align:'center'});
  pdf.line(margen,38,ancho-margen,38);
  pdf.line(margen,258,ancho-margen,258);pdf.setFontSize(8);
  pdf.text('C.E.R. Claudina Múnera · Feria STEAM 2026',margen,263);
  pdf.text('Vereda La Corrala · Caldas, Antioquia',ancho-margen,263,{align:'right'});
  y=46;
 }
 function espacio(h){if(y+h>251){pdf.addPage();cabecera();}}
 function texto(t,{negrita=false,tamano=11,despues=3,mantener=0}={}){
  pdf.setFont(fuente,negrita?'bold':'normal');pdf.setFontSize(tamano);
  const lineas=pdf.splitTextToSize(t,util);const paso=tamano*.35278*1.18;
  espacio(lineas.length*paso+despues+mantener);
  // cabecera puede cambiar la fuente al saltar de página.
  pdf.setFont(fuente,negrita?'bold':'normal');pdf.setFontSize(tamano);
  for(const linea of lineas){espacio(paso);pdf.setFont(fuente,negrita?'bold':'normal');pdf.setFontSize(tamano);pdf.text(linea,margen,y);y+=paso;}
  y+=despues;
 }
 cabecera();
 const fechaCarta=new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',day:'numeric',month:'long',year:'numeric'}).format(fecha);
 pdf.setFont(fuente,'normal');pdf.setFontSize(9);pdf.text('Caldas, Antioquia, '+fechaCarta,ancho-margen,y,{align:'right'});y+=10;
 texto(nombreFeria(jurado.nombre),{negrita:true,tamano:10.5,despues:0});
 if(limpio(jurado.profesion))texto(limpio(jurado.profesion),{tamano:9.5,despues:0});
 if(limpio(jurado.institucion))texto(limpio(jurado.institucion),{tamano:9.5,despues:0});
 y+=5;
 if(recorrido){
  texto('Asunto: Orientaciones y recorrido de evaluación - Feria STEAM 2026',{negrita:true,tamano:10.5,despues:4});
  texto(saludoJurado(jurado),{tamano:10,despues:3});
  const t=(v,o={})=>texto(v,{tamano:9.2,despues:.8,...o});
  const seccion=titulo=>{espacio(16);y+=1.3;texto(titulo,{negrita:true,tamano:9.7,despues:1.5,mantener:12})};
  t(`Gracias por acompañarnos en la ${feria.nombre}. Tu experiencia y acompañamiento nos ayudan a reconocer el esfuerzo de los estudiantes y a motivarlos a seguir aprendiendo y creando.`);
  seccion('Datos de la jornada');
  t(`Fecha: ${feria.fecha} · Horario general: ${feria.horario}`);
  t('Lugar: '+feria.lugar+'.');
  if(recorrido.sinAcceso){seccion('Evaluación en papel');t('El comité te entregará tus datos de acceso a Claudina App. Mientras tanto, utiliza tus fichas impresas y entrégalas al finalizar.');}
  else{
  seccion('Tus datos de acceso');
  t('Claudina App: '+recorrido.url);
  t('Usuario: '+limpio(jurado.usuario),{negrita:true});
  t(jurado.cambiar_password?'Contraseña inicial: '+recorrido.passwordInicial:'Contraseña: usa tu contraseña personal; la inicial ya fue reemplazada.',{negrita:true});
  t('Guarda esta carta para ti: contiene tus datos de acceso.');
  seccion('Cómo evaluar en Claudina App');
  t('1. Abre Claudina App e ingresa con tu usuario y contraseña; no necesitas recibir correos.');
  t('2. Si es tu primer ingreso, elige una contraseña personal de al menos 6 caracteres.');
  t('3. En “Mi recorrido como jurado”, encontrarás tus proyectos. Pulsa “Evaluar proyecto” al visitar cada equipo.');
  t('4. Escucha al equipo, valora los cinco criterios de 1 a 5 y escribe un logro y una sugerencia amable.');
  t('5. Puedes guardar un borrador. Al terminar cada proyecto, pulsa “Enviar evaluación definitiva” y verifica “Evaluación enviada”; después la nota no se puede cambiar.');
  }
  seccion('Orientaciones generales');
  t('Dedica 10 minutos por equipo. Valora comprensión y aprendizaje según la edad, sin exigir investigación extensa ni materiales costosos. El 3 es un buen cumplimiento. No descuentes automáticamente por nervios, lectura o fallas de la demostración.');
  t('En arte, valora expresión y decisiones propias, no tu gusto personal. En emprendimiento, revisa nombre, logo, eslogan, costos y precio con cuentas sencillas, sin exigir contabilidad formal ni premiar ventas.');
  t('Si hay conflicto de interés o necesitas ayuda, avisa al comité. Sin celular, utiliza tu formato impreso de evaluación.');
  t('El recorrido adjunto corresponde a la asignación vigente al descargar esta carta; consulta los ajustes posteriores en la app. Gracias por tu valioso aporte a nuestra comunidad educativa.');
  espacio(30);t('Con aprecio,');
  if(firma){pdf.addImage(firma,'JPEG',margen,y-1,43,11.7);y+=12;}
  t('Gustavo Adolfo Restrepo Arboleda',{negrita:true});
  t(feria.cargo+' · C.E.R. Claudina Múnera');
  t(`Contacto: ${feria.contacto} · ${feria.correo}`);
  pdf.addPage();cabecera();
  texto('Tu recorrido de evaluación',{negrita:true,tamano:13,despues:4});
  t(limpio(jurado.nombre)+(jurado.usuario?' · Usuario: '+limpio(jurado.usuario):''),{negrita:true});
  t(`${recorrido.visitas.length} proyectos asignados · ${feria.fecha}`);
  if(!recorrido.visitas.length)t('Aún estamos preparando tus proyectos. Acércate al equipo organizador antes de empezar; con gusto te orientamos.');
  const columnas=[29,108,util-137],paso=4.2;
  function encabezadoTabla(){
   pdf.setFillColor('#edf4ef');pdf.rect(margen,y,util,9,'F');pdf.setDrawColor('#bdcdbf');pdf.rect(margen,y,util,9);
   pdf.setFont(fuente,'bold');pdf.setFontSize(9.5);let x=margen;
   ['Hora','Proyecto','Aula y puesto'].forEach((titulo,i)=>{pdf.text(titulo,x+3,y+5.8);x+=columnas[i]});y+=9;
  }
  if(recorrido.visitas.length)encabezadoTabla();
  for(const [i,v] of recorrido.visitas.entries()){
   const p=recorrido.proyectos.find(p=>claveProyecto(p)===claveProyecto(v)),h=x=>String(x||'').slice(0,5);
   const u=p?.ubicaciones?.find(u=>u.fecha===v.fecha&&h(u.inicio)<=h(v.inicio)&&h(u.fin)>=h(v.fin));
   pdf.setFont(fuente,'normal');pdf.setFontSize(9.5);
   const titulo=pdf.splitTextToSize((limpio(p?.codigo)?limpio(p.codigo)+' · ':'')+(textoFeria(p?.titulo)||'Proyecto por confirmar'),columnas[1]-6);
   const lugar=pdf.splitTextToSize(nombreFeria(u?.espacio_nombre)||'Por confirmar',columnas[2]-6);
   const puesto=u?.puesto?pdf.splitTextToSize('Puesto: '+limpio(u.puesto),columnas[2]-6):[];
   const altura=Math.max(15,6+Math.max(titulo.length,lugar.length+puesto.length)*paso);
   if(y+altura>244){pdf.addPage();cabecera();t('Tu recorrido (continuación)',{negrita:true});encabezadoTabla()}
   pdf.setFillColor(i%2?'#f5f8f5':'#ffffff');pdf.rect(margen,y,util,altura,'F');pdf.setDrawColor('#bdcdbf');pdf.setLineWidth(.2);
   let x=margen;columnas.forEach(w=>{pdf.rect(x,y,w,altura);x+=w});
   pdf.setTextColor(0);pdf.setFont(fuente,'bold');pdf.setFontSize(9.5);pdf.text(h(v.inicio),margen+3,y+6);pdf.setFont(fuente,'normal');pdf.text('a '+h(v.fin),margen+3,y+11);
   pdf.setFont(fuente,'normal');pdf.text(titulo,margen+columnas[0]+3,y+6,{lineHeightFactor:paso/(9.5*.35278)});
   pdf.setFont(fuente,'bold');pdf.text(lugar,margen+columnas[0]+columnas[1]+3,y+6,{lineHeightFactor:paso/(9.5*.35278)});
   pdf.setFont(fuente,'normal');if(puesto.length)pdf.text(puesto,margen+columnas[0]+columnas[1]+3,y+6+lugar.length*paso,{lineHeightFactor:paso/(9.5*.35278)});
   y+=altura;
  }
  for(let pagina=primeraPagina;pagina<=pdf.getNumberOfPages();pagina++){pdf.setPage(pagina);pdf.setFont(fuente,'normal');pdf.setFontSize(8);pdf.text(`Documento personal · Página ${pagina-primeraPagina+1} de ${pdf.getNumberOfPages()-primeraPagina+1}`,ancho/2,250,{align:'center'});}
  pdf.setProperties({title:`Recorrido y orientaciones como jurado - ${limpio(jurado.nombre)}`,author:'Gustavo Adolfo Restrepo Arboleda',subject:'Feria STEAM 2026 - Acceso y proyectos asignados'});
  return pdf;
 }
 texto('Asunto: Invitación como jurado de la Feria STEAM 2026',{negrita:true,despues:5});
 texto(saludoJurado(jurado),{despues:4});
 texto(`Queremos invitarte a acompañar a nuestros estudiantes como jurado en la ${feria.nombre}, que se realizará el ${feria.fecha}, de ${feria.horario}, en nuestra institución, ubicada en la vereda La Corrala del municipio de Caldas, Antioquia.`);
 texto('Este encuentro integra las ciencias, la tecnología, la ingeniería, las artes y las matemáticas. Estudiantes de primaria y secundaria compartirán sus proyectos y experiencias con las familias, la comunidad y las entidades invitadas.');
 texto('Tu experiencia y tu mirada nos ayudarán a reconocer lo que nuestros estudiantes han aprendido. Para ellos será muy especial conversar contigo, mostrarte sus ideas y recibir palabras de ánimo y sugerencias para seguir creciendo.');
 texto(`Si puedes acompañarnos, por favor cuéntanos al correo ${feria.correo} o al celular ${feria.contacto}. Con gusto te compartiremos tu recorrido y te acompañaremos durante la jornada.`);
 texto('Gracias por regalarle tu tiempo a nuestra comunidad. ¡Será una alegría contar contigo!',{despues:4});
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
let recursosCartaPromise;
export async function cargarRecursosCarta(){
 if(!recursosCartaPromise)recursosCartaPromise=(async()=>{
 const [{jsPDF},escudoModulo,firmaModulo,regularModulo,boldModulo]=await Promise.all([import('jspdf'),import('./assets/escudo-membrete.png'),import('./assets/firma-gustavo-prae.jpg'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const [escudo,firma,regular,bold]=await Promise.all([imagen(escudoModulo.default),imagen(firmaModulo.default),imagen(regularModulo.default),imagen(boldModulo.default)]);
 return {jsPDF,recursos:{escudo,firma,fuenteRegular:regular.split(',')[1],fuenteNegrita:bold.split(',')[1]}};
 })().catch(e=>{recursosCartaPromise=null;throw e});return recursosCartaPromise;
}
export async function descargarCartaJurado(jurado,opciones={}){
 const {jsPDF,recursos}=await cargarRecursosCarta();
 const pdf=construirCartaJurado(jsPDF,jurado,{...opciones,...recursos});pdf.save(opciones.recorrido?nombreArchivoJurado(jurado.nombre).replace('Invitacion-Jurado-','Recorrido-Jurado-'):nombreArchivoJurado(jurado.nombre));
}

export function prepararRecorridoCarta(contexto,personaId,passwordInicial='',url='https://claudina-clean.vercel.app/?ingreso=jurado'){
 if(!contexto?.docente)throw new Error('Solo docentes pueden descargar las cartas de acceso.');
 const jurado=contexto.jurados?.find(j=>j.id===personaId);
 if(!jurado?.habilitado||!jurado.usuario||!jurado.cuenta_id)throw new Error('Primero habilita al jurado y asígnale un usuario.');
 if(jurado.cambiar_password&&(passwordInicial.length<6||passwordInicial.length>128))throw new Error('Introduce la contraseña inicial que asignaste a esta cuenta.');
 return {jurado,recorrido:{passwordInicial:jurado.cambiar_password?passwordInicial:'',url,proyectos:contexto.proyectos||[],visitas:(contexto.visitas||[]).filter(v=>v.jurado_id===personaId).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||String(a.inicio).localeCompare(String(b.inicio)))}};
}
