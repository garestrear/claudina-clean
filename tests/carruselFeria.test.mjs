import assert from 'node:assert/strict';
import {generarGruposCarrusel,rondasCarrusel} from '../src/carruselFeria.js';
const ctx={aulas:[{id:'a',requiere_lider:true},{id:'b',requiere_lider:false},{id:'c',requiere_lider:true}],visitantes:Array.from({length:11},(_,i)=>({id:String(i)})),docentes:[{id:'p'},{id:'q'}]};
const plan=generarGruposCarrusel(ctx);assert.deepEqual(plan.grupos.map(g=>g.estudiantes_ids.length),[4,4,3]);assert.equal(new Set(plan.grupos.flatMap(g=>g.estudiantes_ids)).size,11);assert.deepEqual(plan.lideres.map(l=>l.espacio_id),['a','c']);
const rondas=rondasCarrusel(ctx.aulas,plan.grupos,'08:00','10:00',20);assert.equal(rondas.length,6);assert.equal(rondas[5].fin,'10:00');for(const r of rondas)assert.equal(new Set(r.visitas.map(v=>v.aula.id)).size,3);
for(const g of plan.grupos)assert.equal(new Set(rondas.slice(0,3).flatMap(r=>r.visitas.filter(v=>v.grupo===g.numero).map(v=>v.aula.id))).size,3);
assert.deepEqual(rondasCarrusel([],[], '08:00','10:00',20),[]);
console.log('PASS carrusel: grupos equilibrados, líderes solo con múltiples proyectos y rutas sin cruces');
