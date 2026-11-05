import {htmlProgramacionFeria} from '../src/programacionFeria.js';
import assert from 'node:assert/strict';
import {generarGruposCarrusel,rondasCarrusel} from '../src/carruselFeria.js';
const ctx={segunda_franja:true,aulas:Array.from({length:5},(_,i)=>({id:'s'+i,nombre:'Salón '+i,requiere_lider:false})),docentes:[],visitantes:[[0,10],[1,20],[2,3],[3,7],[4,22],[5,18],[6,9],[7,8],[8,10]].flatMap(([grado,n])=>Array.from({length:n},(_,i)=>({id:grado+'-'+i,grado})))};
const p=generarGruposCarrusel(ctx);
assert.equal(p.grupos.length,5);assert.equal(p.minutos,20);assert.equal(p.max_rotaciones,4);
const ids=p.grupos.flatMap(g=>g.estudiantes_ids);assert.equal(ids.length,97);assert.equal(new Set(ids).size,ids.length);assert(!ids.some(id=>id.startsWith('0-')));
assert.deepEqual(p.grupos.find(g=>g.estudiantes_ids.includes('2-0')).estudiantes_ids.filter(id=>id.startsWith('3-')).length,7);
const bach=p.grupos.find(g=>g.estudiantes_ids.includes('6-0'));assert.equal(bach.estudiantes_ids.length,27);assert(bach.estudiantes_ids.every(id=>Number(id.split('-')[0])>=6));
for(const grado of [1,3,4,5])assert.equal(p.grupos.filter(g=>g.estudiantes_ids.some(id=>id.startsWith(grado+'-'))).length,1);
const rondas=rondasCarrusel(ctx.aulas,p.grupos,'10:15','11:40',p.minutos,p.max_rotaciones);assert.equal(rondas.length,4);assert.equal(rondas.at(-1).fin,'11:35');
for(const r of rondas)assert.equal(new Set(r.visitas.map(v=>v.aula.id)).size,5);
for(const g of p.grupos)assert.equal(new Set(rondas.flatMap(r=>r.visitas.filter(v=>v.grupo===g.numero).map(v=>v.aula.id))).size,4);
assert.throws(()=>generarGruposCarrusel({...ctx,aulas:ctx.aulas.slice(0,4)}),/cinco espacios/);
console.log('PASS segunda franja: cinco grupos, dos menores unidos, bachillerato, exclusión preescolar y cuatro rutas sin repeticiones');

const html=htmlProgramacionFeria({espacios:ctx.aulas,docentes:[],programacion:[],carruseles:[{inicio:'10:15',fin:'11:40',contexto:{...ctx,plan:p,firma:'ok',firma_guardada:'ok'}}]},'2026-11-06');assert(html.includes('11:15 - 11:35'));assert(!html.includes('11:35 - 11:40'));assert(html.includes('Bachillerato'));
