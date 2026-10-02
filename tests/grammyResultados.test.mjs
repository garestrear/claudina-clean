import test from 'node:test';
import assert from 'node:assert/strict';
import {repartirPremios} from '../src/grammyResultados.js';
const cats=[1,2,3].map(id=>({id,orden:id,habilitada:true}));
const v=(c,id,n)=>({categoria_id:c,candidato_id:id,nombre:id,grado:6,votos:n});
test('gana donde tiene más votos y reasigna sin excluir perdedores',()=>{
 const r=repartirPremios(cats,[v(1,'A',9),v(1,'B',7),v(2,'A',12),v(2,'C',6),v(3,'C',8),v(3,'B',5)]);
 assert.deepEqual(r.map(x=>x.ganadores.map(g=>g.candidato_id)),[['B'],['A'],['C']]);
 assert.equal(new Set(r.flatMap(x=>x.ganadores.map(g=>g.candidato_id))).size,3);
});
test('empate de cuatro comparte; tres queda pendiente',()=>{
 const r=repartirPremios(cats,[v(1,'A',4),v(1,'B',4),v(2,'A',2),v(2,'C',3),v(2,'D',3)]);
 assert.equal(r[0].ganadores.length,2);assert.equal(r[1].pendiente,true);assert.equal(r[2].nominados.length,0);
});
test('un nominado que pierde puede ganar otro premio',()=>{
 const r=repartirPremios(cats,[v(1,'A',10),v(1,'B',8),v(2,'B',7)]);
 assert.equal(r[1].ganadores[0].candidato_id,'B');
});
test('reconsidera empate bajo tras excluir ganador en otra categoría',()=>{
 const r=repartirPremios(cats,[v(1,'A',3),v(1,'B',3),v(2,'A',2)]);
 assert.equal(r[0].ganadores[0].candidato_id,'B');assert.equal(r[1].ganadores[0].candidato_id,'A');
});
test('ignora desactivadas y resuelve igualdad entre premios por orden',()=>{
 const r=repartirPremios([{id:1,orden:1,habilitada:false},...cats.slice(1)],[v(1,'A',99),v(2,'A',5),v(3,'A',5),v(3,'B',2)]);
 assert.equal(r[0].ganadores[0].candidato_id,'A');assert.equal(r[1].ganadores[0].candidato_id,'B');
});
