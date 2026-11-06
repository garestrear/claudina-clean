import {jsPDF} from 'jspdf';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {construirCartaJurado,prepararRecorridoCarta} from '../src/cartaJurado.js';
const opts={escudo:'data:image/png;base64,'+(await readFile('src/assets/escudo-membrete.png')).toString('base64'),firma:'data:image/jpeg;base64,'+(await readFile('src/assets/firma-gustavo-prae.jpg')).toString('base64'),fuenteRegular:(await readFile('src/assets/carta-regular.ttf')).toString('base64'),fuenteNegrita:(await readFile('src/assets/carta-bold.ttf')).toString('base64'),fecha:new Date('2026-11-06T00:30:00Z')};
const jurado={id:'j1',nombre:'Isabel Osorio Bolívar',institucion:'Tecnológico de Artes Débora Arango',usuario:'jurado01',cuenta_id:'c1',habilitado:true,cambiar_password:true};
const proyectos=Array.from({length:10},(_,i)=>({id:'p'+i,origen:'claudina',codigo:'C'+(i+1),titulo:i?'Huerta escolar y aprovechamiento de residuos orgánicos':'Weather Scientists: Análisis climático y prevención de riesgos.',integrantes:'Ana María Restrepo, Juan José Osorio',ubicaciones:[{fecha:'2026-11-06',inicio:'08:00',fin:'10:00',espacio_nombre:'Salón '+(i%5+1)}]}));
const visitas=proyectos.map((p,i)=>({jurado_id:'j1',proyecto_id:p.id,origen:p.origen,fecha:'2026-11-06',inicio:`09:${String(i*5).padStart(2,'0')}`,fin:`09:${String(i*5+5).padStart(2,'0')}`})).reverse();
const ctx={docente:true,jurados:[jurado],proyectos,visitas:[...visitas,{...visitas[0],jurado_id:'otro'}]};
assert.throws(()=>prepararRecorridoCarta({...ctx,docente:false},'j1'),/Solo docentes/);
assert.throws(()=>prepararRecorridoCarta(ctx,'noexiste'),/asígnale/);
assert.throws(()=>prepararRecorridoCarta(ctx,'j1',''),/contraseña inicial/);
const datos=prepararRecorridoCarta(ctx,'j1','Inicial-Ejemplo-2026');assert.equal(datos.recorrido.visitas.length,10);assert.equal(datos.recorrido.visitas[0].inicio,'09:00');assert.equal(visitas[0].inicio,'09:45','no modifica contexto');
const changed=prepararRecorridoCarta({...ctx,jurados:[{...jurado,cambiar_password:false}]},'j1','No-imprimir-esta');assert.equal(changed.recorrido.passwordInicial,'');
await mkdir('/tmp/cartas-recorrido-qa',{recursive:true});
for(const tipo of ['normal','larga','cambiada','sin-asignaciones']){
 const persona=tipo==='larga'?{...jurado,nombre:'María José de los Ángeles Álvarez Espinosa Barrientos '.repeat(3).slice(0,150)}:tipo==='cambiada'?changed.jurado:jurado;
 const recorrido=tipo==='cambiada'?changed.recorrido:tipo==='sin-asignaciones'?{...datos.recorrido,visitas:[]}:tipo==='larga'?{...datos.recorrido,proyectos:proyectos.map(p=>({...p,titulo:p.titulo.repeat(3),integrantes:p.integrantes.repeat(4)}))}:datos.recorrido;
 const pdf=construirCartaJurado(jsPDF,persona,{...opts,recorrido});assert(pdf.getNumberOfPages()>=2);if(tipo==='normal')assert.equal(pdf.getNumberOfPages(),2);assert(pdf.getNumberOfPages()<6);await writeFile('/tmp/cartas-recorrido-qa/'+tipo+'.pdf',Buffer.from(pdf.output('arraybuffer')));
}
console.log('PASS cartas de recorrido: autorización, cuenta asignada, filtro individual, orden, contraseña inicial vs personal, firma y paginación');
