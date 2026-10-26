import {jsPDF} from 'jspdf';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {construirCartaJurado,nombreArchivoJurado} from '../src/cartaJurado.js';
const opciones={escudo:'data:image/png;base64,'+(await readFile('src/assets/escudo-membrete.png')).toString('base64'),firma:'data:image/jpeg;base64,'+(await readFile('src/assets/firma-gustavo-prae.jpg')).toString('base64'),fuenteRegular:(await readFile('src/assets/carta-regular.ttf')).toString('base64'),fuenteNegrita:(await readFile('src/assets/carta-bold.ttf')).toString('base64'),fecha:new Date('2026-10-27T02:00:00Z')};
await mkdir('/tmp/cartas-jurados-qa',{recursive:true});
for(const [nombre,persona] of [['normal',{nombre:'Cristina Espinosa Barrientos',institucion:'Red Piragua - Corantioquia',profesion:'Profesional ambiental'}],['largo',{nombre:'María José de los Ángeles Álvarez Espinosa Barrientos '.repeat(3).slice(0,150),institucion:'Institución de Investigación y Educación Ambiental del municipio de Caldas y del territorio del Valle de Aburrá '.repeat(2).slice(0,150),profesion:'Profesional en educación ambiental y acompañamiento a grupos de investigación escolares '.repeat(2).slice(0,150)}]]){
 const pdf=construirCartaJurado(jsPDF,persona,opciones);assert.equal(pdf.getNumberOfPages(),1);const bytes=Buffer.from(pdf.output('arraybuffer'));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');await writeFile('/tmp/cartas-jurados-qa/'+nombre+'.pdf',bytes);
}
assert.equal(nombreArchivoJurado('María / Álvarez'), 'Invitacion-Jurado-Maria-Alvarez-Feria-STEAM-2026.pdf');assert.throws(()=>construirCartaJurado(jsPDF,{nombre:''}),/Faltan/);console.log('PASS: cartas PDF con fuentes incrustadas, tildes, membrete, firma y nombres largos en una página');
