import assert from 'node:assert/strict';
import {jsPDF} from 'jspdf';
import {construirInformePuentesPdf} from '../src/informePuentesPdf.js';
const datos={ahora:'2026-11-05T02:00:00Z',puentes:[{id:'a',titulo:'Puente de prueba',categoria:'puentes_infantil',grado_turno:5,integrantes:'Ana y Luis',estado:'finalizado',foto_path:'a.jpg',motivo_fin:'Participación finalizada'},{id:'b',titulo:'Descalificado',categoria:'puentes_juvenil',estado:'descalificado',motivo_fin:'Longitud insuficiente'}],rondas:[{puente_id:'a',numero:1,carga_kg:20,resultado:'valida'},{puente_id:'a',numero:2,carga_kg:30,resultado:'fallo',motivo:'No resistió'},{puente_id:'a',numero:3,carga_kg:10,resultado:'anulada',cuenta_intento:false}]};
const pdf=construirInformePuentesPdf(jsPDF,datos);
assert.equal(pdf.getNumberOfPages(),3);
const fuente=pdf.output();assert(fuente.startsWith('%PDF-'));assert(fuente.length>2000);
const solo=construirInformePuentesPdf(jsPDF,datos,{categoria:'puentes_infantil'});assert.equal(solo.getNumberOfPages(),2);
const vacio=construirInformePuentesPdf(jsPDF,{puentes:[],rondas:[]});assert.equal(vacio.getNumberOfPages(),1);
const largo=construirInformePuentesPdf(jsPDF,{...datos,puentes:[{...datos.puentes[0],integrantes:'Nombre del participante '.repeat(200),motivo_fin:'Observación extensa '.repeat(200)}]});assert(largo.getNumberOfPages()>2);
// A corrupt image is omitted without losing the report.
assert.doesNotThrow(()=>construirInformePuentesPdf(jsPDF,datos,{fotos:{a:'data:image/jpeg;base64,AAAA'}}));

// Read text calls as well as PDF bytes to verify report order and labels.
const llamadas=[];
function PdfRegistrado(opciones){const doc=new jsPDF(opciones),original=doc.text;doc.text=function(t,...args){llamadas.push({pagina:doc.internal.getCurrentPageInfo().pageNumber,texto:Array.isArray(t)?t.join(' '):String(t)});return original.call(doc,t,...args)};return doc}
const ordenados={...datos,puentes:[{...datos.puentes[0],id:'sexto',titulo:'Sexto',grado_turno:6,codigo:'IGNORAR'},{...datos.puentes[0],id:'mixto',titulo:'Mixto',grado_turno:null,equipo:[{grado:5},{grado:2}]},{...datos.puentes[0],id:'cero',titulo:'Inicial',grado_turno:0},{...datos.puentes[1],id:'sin',titulo:'Pendiente de grado'},{...datos.puentes[0],id:'quinto',titulo:'Quinto',grado_turno:5}]};
construirInformePuentesPdf(PdfRegistrado,ordenados);
const contenido=llamadas.map(l=>l.texto).join('\n');
assert(!/Sin código|IGNORAR/.test(contenido));
assert(contenido.includes('Puesto en la categoría, no por grado'));
assert(contenido.indexOf('Inicial')<contenido.indexOf('Mixto'));
assert(contenido.indexOf('Mixto')<contenido.indexOf('Quinto'));
assert(contenido.indexOf('Quinto')<contenido.indexOf('Sexto'));
const fichas=llamadas.filter(l=>/^(Inicial|Mixto|Quinto|Sexto|Pendiente de grado) · /.test(l.texto)&&l.pagina>1).map(l=>l.texto);
assert.deepEqual(fichas,['Inicial · TS y JR','Mixto · 2°','Quinto · 5°','Sexto · 6°','Pendiente de grado · Grado por registrar']);
llamadas.length=0;
const masivo={...datos,puentes:Array.from({length:70},(_,i)=>({...datos.puentes[0],id:'p'+i,titulo:'Puente '+i,grado_turno:5})),rondas:[]};
construirInformePuentesPdf(PdfRegistrado,masivo);
assert(llamadas.filter(l=>l.texto==='Puesto*').length>=3,'Repite encabezados al dividir una tabla');
assert(llamadas.some(l=>l.texto==='Clasificaciones por grado (continuación)'));
console.log('PASS PDF: categorías, paginación, registros sin foto, imagen corrupta, sin registros y textos extensos');
