import assert from 'node:assert/strict';
import {generarRecorrido,claveProyecto,puntajeEvaluacion,rubricas} from '../src/evaluacionJurados.js';
const proyectos=n=>Array.from({length:n},(_,i)=>({id:'p'+i,origen:i%2?'invitados':'claudina',titulo:'Proyecto '+i,asesor_id:'docente'+i,areas:['science'],ubicaciones:[{fecha:'2026-11-06',inicio:'08:00',fin:'10:00',espacio_nombre:'Aula '+i%9}]}));
const jurados=n=>Array.from({length:n},(_,i)=>({id:'j'+i,usuario_id:'docente'+i,areas:['science'],conflictos:[]}));
const config={fecha:'2026-11-06',inicio:'08:00',fin:'10:00'};
function verificar(ps,js){const vs=generarRecorrido(ps,js,config);assert.equal(vs.length,ps.length*3);for(const p of ps){const v=vs.filter(v=>claveProyecto(v)===claveProyecto(p));assert.equal(v.length,3);assert.equal(new Set(v.map(v=>v.jurado_id)).size,3);assert.equal(new Set(v.map(v=>v.ronda)).size,3);assert(!v.some(v=>js.find(j=>j.id===v.jurado_id).usuario_id===p.asesor_id));}for(const j of js){const v=vs.filter(v=>v.jurado_id===j.id);assert(v.length<=10);assert.equal(new Set(v.map(v=>v.ronda)).size,v.length);assert(!v.some(v=>j.conflictos.includes(claveProyecto(v))));}assert(vs.every(v=>v.inicio>='08:00'&&v.fin<='09:49'));return vs}
for(const n of [1,2,3,10,20,25,30,35,40,61,100])verificar(proyectos(n),jurados(Math.max(4,Math.ceil(n*3/10))));
const ps=proyectos(20),js=jurados(7);js[0].conflictos=ps.slice(0,12).map(claveProyecto);verificar(ps,js);
assert.throws(()=>generarRecorrido(proyectos(40),jurados(11),config),/12 jurados/);
assert.throws(()=>generarRecorrido(proyectos(2),jurados(2),config),/3 jurados/);
assert.throws(()=>generarRecorrido(proyectos(2),jurados(4),{...config,fin:'10:01'}),/110 a 120/);
assert.throws(()=>generarRecorrido([{...proyectos(1)[0],ubicaciones:[]}],jurados(4),config),/Amplía la reserva/);
const bloqueados=jurados(4).map(j=>({...j,conflictos:ps.map(claveProyecto)}));assert.throws(()=>generarRecorrido(ps,bloqueados,config),/al menos|conflictos/);
for(const c of Object.keys(rubricas)){assert.equal(puntajeEvaluacion(c,[5,5,5,5,5]),100);assert.equal(puntajeEvaluacion(c,[1,1,1,1,1]),20);assert.equal(puntajeEvaluacion(c,[0,5,5,5,5]),null);assert.equal(puntajeEvaluacion(c,[null,5,5,5,5]),null)}
assert.equal(puntajeEvaluacion('stem',[1,2,3,4,5]),62);
console.log('PASS: asignación completa 3 jurados, 10 visitas máximo, conflictos, simultaneidad, capacidad, 2 horas y rúbricas');
