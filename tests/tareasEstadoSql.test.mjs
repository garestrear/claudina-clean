import assert from 'node:assert/strict';
import {crearDbTareasEstado,id,tarea} from './fixtures/tareasEstadoDb.mjs';
const db=await crearDbTareasEstado();
try{
 const identity=n=>db.query("select set_config('test.uid',$1,false)",[n?id(n):'']);
 const list=async()=>(await db.query('select tareas_estado_listar() data')).rows[0].data;
 const mark=async(n,hecha=true)=>(await db.query('select tarea_marcar_hecha($1,$2) data',[tarea(n),hecha])).rows[0].data;
 for(const n of [0,4,5,6]){await identity(n);await assert.rejects(list());await assert.rejects(mark(1));}
 await identity(1);assert.deepEqual(await list(),[]);
 const first=await mark(1);assert.equal(first.hecha,true);assert.ok(first.hecha_at);
 assert.deepEqual(await mark(1),first,'marcar de nuevo conserva fecha y no duplica');
 assert.equal((await list()).length,1);await mark(2);assert.equal((await list()).length,2);
 for(const n of [3,4,5,6,99]){await assert.rejects(mark(n));await assert.rejects(mark(n,false));}
 await assert.rejects(mark(1,null));
 await identity(2);assert.deepEqual(await list(),[],'otra cuenta no recibe marcas');
 await mark(1,false);await mark(1);assert.equal((await list()).length,1);
 await identity(1);assert.equal((await list()).length,2,'las marcas de otro no cambian las propias');
 await mark(1,false);assert.equal((await list()).length,1);await mark(1,false);
 await mark(1);await db.query('update avisos set publicado=false where id=$1',[tarea(1)]);assert.equal((await list()).length,1);
 await assert.rejects(mark(1));await db.query('update avisos set publicado=true where id=$1',[tarea(1)]);assert.equal((await list()).length,2);
 await db.query('update estudiantes set grado=7 where id=$1',[id(1)]);assert.deepEqual((await list()).map(x=>x.tarea_id),[tarea(2)]);
 await identity(7);await mark(6);assert.equal((await list()).length,1,'grado cero también puede organizar tareas');
 await db.exec('set role authenticated');assert.equal((await list()).length,1);
 await assert.rejects(db.query('select * from tareas_estado_estudiante'));await assert.rejects(db.query('delete from tareas_estado_estudiante'));
 await db.exec('reset role');await db.exec('set role anon');await assert.rejects(list());await assert.rejects(mark(2));await db.exec('reset role');
 assert.equal((await db.query('select count(*)::int n from avisos')).rows[0].n,6,'sin cambiar publicaciones');
 await db.query('delete from avisos where id=$1',[tarea(6)]);assert.equal((await db.query('select count(*)::int n from tareas_estado_estudiante where tarea_id=$1',[tarea(6)])).rows[0].n,0);
 console.log('PASS: SQL repetible, hechas/pendientes por cuenta, persistencia, idempotencia, grado cero, visibilidad por grado/publicación, permisos y eliminación en cascada');
}finally{await db.close()}
