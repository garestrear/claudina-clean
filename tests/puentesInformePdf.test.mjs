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

console.log('PASS PDF: categorías, paginación, registros sin foto, imagen corrupta, sin registros y textos extensos');
