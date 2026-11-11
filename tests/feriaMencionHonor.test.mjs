import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {jsPDF} from 'jspdf';
import {prepararMencion,construirCertificados} from '../src/documentosParticipantes.js';
const firmantes=Array.from({length:6},(_,i)=>({nombre:i?'Gustavo Adolfo Restrepo Arboleda':'Yasmith Bernal',cargo:i?'Docente organizador':'Directora',firma:null}));
const proyecto={titulo:'Weather Scientists: Análisis climático y prevención de riesgos.',integrantes:'María José Restrepo · Samuel Andrés Muñoz · Celeste Jaramillo'};
const c=prepararMencion(proyecto,{firmantes,motivo:'Por su investigación del clima local y su compromiso con la prevención de riesgos en nuestra comunidad.'});
assert.equal(c.contenido.nombre,proyecto.titulo);assert.equal(c.contenido.integrantes,proyecto.integrantes);assert.equal(c.folio,undefined);
assert.throws(()=>prepararMencion({titulo:'Proyecto sin autores'},{firmantes}));
assert.throws(()=>prepararMencion(proyecto,{firmantes:[]}));
assert.throws(()=>prepararMencion(proyecto,{firmantes,motivo:'x'.repeat(301)}));
const familia=prepararMencion({titulo:'[Emprendimiento familiar] Sabores de la Corrala',materiales:'Isabel Pérez y familia',integrantes:'Estudiante vinculado'},{firmantes});assert.equal(familia.contenido.integrantes,'Isabel Pérez y familia');assert.equal(familia.contenido.nombre,'Sabores de la Corrala');
assert.equal(prepararMencion({datos:proyecto},{firmantes}).contenido.nombre,proyecto.titulo);
const recursos={fondoCertificado:'data:image/png;base64,'+(await readFile('src/assets/certificado-steam-juvenil.png')).toString('base64'),fuenteRegular:(await readFile('src/assets/carta-regular.ttf')).toString('base64'),fuenteNegrita:(await readFile('src/assets/carta-bold.ttf')).toString('base64')};
for(const n of [1,2,6]){
 const pdf=construirCertificados(jsPDF,[{...c,contenido:{...c.contenido,firmantes:firmantes.slice(0,n)}}],recursos,{mencion:true});
 assert.equal(pdf.getNumberOfPages(),1);await writeFile(`/tmp/mencion-honor-${n}.pdf`,Buffer.from(pdf.output('arraybuffer')));
}
assert.throws(()=>construirCertificados(jsPDF,[c],recursos));
console.log('PASS: mención colectiva independiente de clasificación, autores familiares, invitados, validación y firmas de 1 a 6.');
