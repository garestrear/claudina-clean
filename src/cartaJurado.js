import {claveProyecto} from './evaluacionJurados.js';
import {feriaEvento as feria} from './feriaEvento.js';
const limpio=v=>String(v||'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
export function nombreArchivoJurado(nombre){
 const parte=limpio(nombre).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90)||'Jurado';
 return `Invitacion-Jurado-${parte}-Feria-STEAM-2026.pdf`;
}
// Texto nativo en PDF, sin depender de imprimir ni de una captura de pantalla.
export function construirCartaJurado(jsPDF,jurado,{escudo,firma,fuenteRegular,fuenteNegrita,fecha=new Date(),recorrido}={}){
 if(!limpio(jurado?.nombre)||(!recorrido&&!limpio(jurado?.institucion)))throw new Error('Falta el nombre o la institución de la persona inscrita.');
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
 if(recorrido){
  texto('Asunto: Orientaciones y recorrido personal como jurado',{negrita:true,tamano:11,despues:4});
  const t=(v,o={})=>texto(v,{tamano:9.2,despues:1.2,...o});
  t(`Gracias por acompañarnos en la ${feria.nombre}. Su tiempo y experiencia nos ayudan a reconocer el trabajo de los estudiantes y a motivar sus procesos de investigación, creatividad y emprendimiento.`);
  t(`${feria.fecha} · ${feria.horario} Lugar: ${feria.lugar}.`);
  t('Sus datos de acceso',{negrita:true});
  t('Claudina App: '+recorrido.url);
  t('Usuario: '+limpio(jurado.usuario),{negrita:true});
  t(jurado.cambiar_password?'Contraseña inicial: '+recorrido.passwordInicial:'Contraseña: utilice la contraseña personal que eligió. La inicial ya fue reemplazada.',{negrita:true});
  t('Este documento es personal. No comparta sus datos de acceso.');
  t('Cómo evaluar en Claudina App',{negrita:true});
  t('1. Abra el enlace e ingrese con su usuario y contraseña. No necesita recibir correos.');
  t('2. En el primer ingreso debe cambiar la contraseña inicial por una personal de al menos 10 caracteres, antes de evaluar.');
  t('3. En “Mi recorrido como jurado”, abra “Evaluar proyecto” en cada visita asignada.');
  t('4. Escuche al equipo y califique los cinco criterios de 1 a 5. La app muestra los pesos y el puntaje sobre 100. Escriba lo más destacado y una sugerencia constructiva.');
  t('5. Use “Guardar / reintentar sincronización” para conservar el borrador. Al terminar, pulse “Enviar evaluación definitiva” y confirme. Verifique el mensaje “Evaluación enviada”; después no podrá modificarla.');
  t('Orientaciones generales',{negrita:true});
  t('Dedique al menos 10 minutos por proyecto y respete el horario. Valore el proceso según la edad. Informe al comité sobre conflictos de interés, ubicaciones faltantes o fallas de conexión. Confirme la sincronización antes de cerrar.');
  t('El recorrido corresponde a la asignación vigente al descargar la carta. Consulte los ajustes posteriores en la app. Gracias por su aporte a nuestra comunidad educativa.');
  espacio(36);t('Con aprecio,');
  if(firma){pdf.addImage(firma,'JPEG',margen,y-1,43,11.7);y+=12;}
  t('Gustavo Adolfo Restrepo Arboleda',{negrita:true});
  t(feria.cargo+' · C.E.R. Claudina Múnera');
  t(`Contacto: ${feria.contacto} · ${feria.correo}`);
  pdf.addPage();cabecera();
  texto('Su recorrido de evaluación',{negrita:true,tamano:13,despues:4});
  t(limpio(jurado.nombre)+' · Usuario: '+limpio(jurado.usuario),{negrita:true});
  t(`${recorrido.visitas.length} proyectos asignados · ${feria.fecha}`);
  if(!recorrido.visitas.length)t('Todavía no tiene proyectos asignados. Consulte al comité antes de iniciar su recorrido.');
  for(const [i,v] of recorrido.visitas.entries()){
   const p=recorrido.proyectos.find(p=>claveProyecto(p)===claveProyecto(v));
   const h=x=>String(x||'').slice(0,5);
   const u=p?.ubicaciones?.find(u=>u.fecha===v.fecha&&h(u.inicio)<=h(v.inicio)&&h(u.fin)>=h(v.fin));
   espacio(19);
   t(`${i+1}. ${h(v.inicio)} - ${h(v.fin)} · ${limpio(p?.codigo)} ${limpio(p?.titulo)||'Proyecto pendiente de revisión'}`,{negrita:true});
   t('Ubicación: '+(limpio(u?.espacio_nombre)||'Pendiente de confirmar con el comité')+(u?.puesto?' · Puesto: '+limpio(u.puesto):''));
   if(p?.integrantes)t('Integrantes: '+limpio(p.integrantes));
   y+=2;
  }
  for(let pagina=1;pagina<=pdf.getNumberOfPages();pagina++){pdf.setPage(pagina);pdf.setFont(fuente,'normal');pdf.setFontSize(8);pdf.text(`Documento personal · Página ${pagina} de ${pdf.getNumberOfPages()}`,ancho/2,250,{align:'center'});}
  pdf.setProperties({title:`Recorrido y orientaciones como jurado - ${limpio(jurado.nombre)}`,author:'Gustavo Adolfo Restrepo Arboleda',subject:'Feria STEAM 2026 - Acceso y proyectos asignados'});
  return pdf;
 }
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
export async function descargarCartaJurado(jurado,opciones={}){
 const [{jsPDF},escudoModulo,firmaModulo,regularModulo,boldModulo]=await Promise.all([import('jspdf'),import('./assets/escudo-membrete.png'),import('./assets/firma-gustavo-prae.jpg'),import('./assets/carta-regular.ttf?url'),import('./assets/carta-bold.ttf?url')]);
 const [escudo,firma,regular,bold]=await Promise.all([imagen(escudoModulo.default),imagen(firmaModulo.default),imagen(regularModulo.default),imagen(boldModulo.default)]);
 const pdf=construirCartaJurado(jsPDF,jurado,{...opciones,escudo,firma,fuenteRegular:regular.split(',')[1],fuenteNegrita:bold.split(',')[1]});pdf.save(opciones.recorrido?nombreArchivoJurado(jurado.nombre).replace('Invitacion-Jurado-','Recorrido-Jurado-'):nombreArchivoJurado(jurado.nombre));
}

export function prepararRecorridoCarta(contexto,personaId,passwordInicial='',url='https://claudina-clean.vercel.app/?ingreso=jurado'){
 if(!contexto?.docente)throw new Error('Solo docentes pueden descargar las cartas de acceso.');
 const jurado=contexto.jurados?.find(j=>j.id===personaId);
 if(!jurado?.habilitado||!jurado.usuario||!jurado.cuenta_id)throw new Error('Primero habilita al jurado y asígnale un usuario.');
 if(jurado.cambiar_password&&(passwordInicial.length<10||passwordInicial.length>128))throw new Error('Introduce la contraseña inicial que asignaste a esta cuenta.');
 return {jurado,recorrido:{passwordInicial:jurado.cambiar_password?passwordInicial:'',url,proyectos:contexto.proyectos||[],visitas:(contexto.visitas||[]).filter(v=>v.jurado_id===personaId).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha))||String(a.inicio).localeCompare(String(b.inicio)))}};
}
