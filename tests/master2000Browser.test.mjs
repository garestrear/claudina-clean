import assert from 'node:assert/strict';
import {consultarMaster,lanzarNavegador} from '../lib/master2000/consulta.js';
import {nombreComparable} from '../lib/master2000/planillas.js';
assert.equal(nombreComparable('Persona Prueba Uno'),nombreComparable('PRUEBA UNO PERSONA'));
const planilla=`<div class="nombre_modulo">Seguimiento | Período 3</div><div>C. E. R. CLAUDINA MÚNERA- 2026</div><table><tr><td><table>
<tr><td>INGLÉS DE PRUEBA</td></tr><tr><td id="demoArr072"></td></tr>
<tr><td colspan="12">60% SEGUIMIENTO</td><td colspan="2">30% E. PERIODO</td><td colspan="2">10% HETEROEVALUACION</td><td colspan="2">Nota según porcentaje evaluado</td><td colspan="2">Nota parcial</td><td colspan="2">Faltas</td></tr>
<tr>${Array.from({length:12},(_,i)=>`<td>1.${i+1}</td>`).join('')}<td>2.1</td><td>2.2</td><td>3.1</td><td>3.2</td><td>Def</td><td>Val</td><td>Def</td><td>Val</td><td>F.T.</td><td>F.E.</td></tr>
<tr>${Array.from({length:16},(_,i)=>`<td id="note${i}" ${i<3?`onclick="setTimeout(()=>document.getElementById('demoArr072').innerText='SEGUIMIENTO(60%) NOTA:${i+1} ACTIVIDAD:Actividad ${i+1}',80)"`:''}>${i<3?`<div class="popoverData">${[1,3,4][i]}</div>`:''}</td>`).join('')}<td>1.6</td><td>Bj</td><td>2.7</td><td>Bj</td><td>0</td><td>0</td></tr><tr><td></td></tr></table></td></tr></table>`;
let launches=0,closed=0,scenario='ok';
async function launch(){
 launches++;const b=await lanzarNavegador();const baseNew=b.newContext.bind(b);const close=b.close.bind(b);b.close=async()=>{closed++;return close()};
 b.newContext=async options=>{const c=await baseNew(options);const nativeRoute=c.route.bind(c);c.route=async()=>nativeRoute('**/*',async r=>{
  // Every request is fulfilled in memory. These tests never contact Master or another host.
  const u=new URL(r.request().url());let html='';
  if(u.hostname==='accounts.google.com'){await new Promise(resolve=>setTimeout(resolve,250));await r.fulfill({status:200,contentType:'application/javascript',body:'window.google={accounts:{}};'});return}
  if(u.hostname==='login.master2000.net')html=`<script async src="https://accounts.google.com/gsi/client"></script><select id="asunto1"><option>Seleccionar</option><option>Estudiante</option></select><div id="campos" hidden><input name="Usuario"><input name="Passwd" type="password"><button onclick="location.href='https://s67.master2000.net/academicoestudiante/panel.php'">Acceder</button></div><script>window.addEventListener('load',()=>{if(!window.google)throw Error('client missing');document.getElementById('asunto1').addEventListener('change',()=>document.getElementById('campos').hidden=false)});</script>`;
  else if(u.pathname.endsWith('panel.php'))html=`<div id="InfoEstudiante">Estudiante: ${scenario==='identity'?'OTRA PERSONA':'PRUEBA UNO PERSONA'}\nMatrícula: fixture</div>`;
  else if(u.pathname.endsWith('index.php'))html=`<select id="txt_periodo_opciones"><option>1</option><option>2</option><option>3</option><option>4</option></select><button onclick="location.href='seguimiento.php'">Aceptar</button>`;
  else if(u.pathname.endsWith('seguimiento.php'))html=scenario==='closed'?'La institución ha establecido que el seguimiento del período está cerrado.':`<div id="planilla_numerica">${planilla}</div>`;
  else throw new Error('Unexpected fixture URL');
  await r.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8">'+html});
 });return c};return b;
}
const input={documento:'1234567',password:'fixture-secret',nombre:'Persona Prueba Uno',periodo:3};
let r=await consultarMaster(input,launch);assert.equal(r.materias.length,1);assert.deepEqual(r.materias[0].actividades.slice(0,4).map(a=>a.nota),['1','3','4',null]);assert.equal(r.materias[0].resumen[2].valor,'2.7');assert(!JSON.stringify(r).includes('note0'));assert(!JSON.stringify(r).includes('fixture-secret'));
r=await consultarMaster({...input,materia:'072'},launch);assert.deepEqual(r.materias[0].actividades.slice(0,3).map(a=>a.descripcion),['Actividad 1','Actividad 2','Actividad 3']);
await assert.rejects(consultarMaster({...input,materia:'other'},launch),e=>e.codigo==='MATERIA');
scenario='identity';await assert.rejects(consultarMaster(input,launch),e=>e.codigo==='IDENTIDAD');
scenario='closed';await assert.rejects(consultarMaster(input,launch),e=>e.codigo==='PERIODO_CERRADO');
assert.equal(launches,closed);console.log('PASS Master navegador: Chromium ejecutable, ingreso simulado, extracción de notas y descripción diferida sin mezclar actividades, identidad, período cerrado y cierre de navegador. Sin red externa.');
