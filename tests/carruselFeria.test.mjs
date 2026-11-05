import assert from 'node:assert/strict';
import {generarGruposCarrusel,rondasCarrusel} from '../src/carruselFeria.js';
const ctx={aulas:[{id:'a',requiere_lider:true},{id:'b',requiere_lider:false},{id:'c',requiere_lider:true}],visitantes:Array.from({length:11},(_,i)=>({id:String(i)})),docentes:[{id:'p'},{id:'q'}]};
const plan=generarGruposCarrusel(ctx);assert.deepEqual(plan.grupos.map(g=>g.estudiantes_ids.length),[4,4,3]);assert.equal(new Set(plan.grupos.flatMap(g=>g.estudiantes_ids)).size,11);assert.deepEqual(plan.lideres.map(l=>l.espacio_id),['a','c']);
const rondas=rondasCarrusel(ctx.aulas,plan.grupos,'08:00','10:00',20);assert.equal(rondas.length,6);assert.equal(rondas[5].fin,'10:00');for(const r of rondas)assert.equal(new Set(r.visitas.map(v=>v.aula.id)).size,3);
for(const g of plan.grupos)assert.equal(new Set(rondas.slice(0,3).flatMap(r=>r.visitas.filter(v=>v.grupo===g.numero).map(v=>v.aula.id))).size,3);
assert.deepEqual(rondasCarrusel([],[], '08:00','10:00',20),[]);
console.log('PASS carrusel: grupos equilibrados, líderes solo con múltiples proyectos y rutas sin cruces');
const crear=(cantidades,aforo)=>({...ctx,aulas:ctx.aulas.map(a=>({...a,aforo})),visitantes:cantidades.flatMap(([grado,n])=>Array.from({length:n},(_,i)=>({id:`${grado}-${i}`,grado})))});
for(const aforo of [null,4]){
 const contexto=crear([[0,9],[1,8],[2,7],[3,3]],aforo),p=generarGruposCarrusel(contexto);
 const ubicaciones=grado=>p.grupos.filter(g=>g.estudiantes_ids.some(id=>id.startsWith(grado+'-'))).length;
 assert.equal(ubicaciones(0),1);assert.equal(ubicaciones(1),1);
 if(!aforo){assert.equal(ubicaciones(2),1);assert.equal(ubicaciones(3),1)}
 assert.equal(new Set(p.grupos.flatMap(g=>g.estudiantes_ids)).size,27);
}
assert.deepEqual(generarGruposCarrusel({...ctx,aulas:[]}).grupos,[]);
console.log('PASS grados completos, TS/preescolar y primero indivisibles incluso sobre aforo');
