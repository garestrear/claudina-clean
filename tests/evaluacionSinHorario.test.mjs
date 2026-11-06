import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearEvaluacionDb} from './fixtures/evaluacionDb.mjs';
const {db,actor,rpc,uid}=await crearEvaluacionDb();
try {
 await actor(1);
 const c=await rpc('feria_evaluacion_contexto');
 const {generarRecorrido}=await import('../src/evaluacionJurados.js');
 const plan=generarRecorrido(c.proyectos,c.jurados.filter(j=>j.id!==uid(107)&&j.id!==uid(108)),{fecha:'2026-11-06',inicio:'08:00',fin:'10:00'});
 await rpc('feria_evaluacion_plan',['2026-11-06','08:00','10:00',plan,c.config.version],['date','time','time','jsonb','integer']);
 await db.exec('create role service_role');
 await db.exec(await readFile('supabase/feria-jurados-cuentas.sql','utf8'));
 await db.exec(await readFile('supabase/feria-rubrica-experiencias.sql','utf8'));
 const sql=await readFile('supabase/feria-evaluacion-sin-horario.sql','utf8');
 await db.exec(sql);await db.exec(sql);
 await actor(2);
 const ctx=await rpc('feria_evaluacion_contexto'),v=ctx.visitas[0];
 // La reserva ya no coincide con la fecha ni las horas del recorrido.
 await db.query("update feria_programacion set fecha='2026-11-07',inicio='10:15',fin='11:35' where origen=$1 and proyecto_id=$2",[v.origen,v.proyecto_id]);
 const guardar=(id,enviar,version,n)=>rpc('feria_evaluacion_guardar',[id,{notas:[5,5,5,5,5],rubrica_version:2},enviar,version,uid(n)],['uuid','jsonb','boolean','integer','uuid']);
 let e=await guardar(v.id,false,0,800);assert.equal(e.enviada,false);
 // Incluso sin reserva, la asignación permite enviar.
 await db.query('update feria_programacion set activo=false where origen=$1 and proyecto_id=$2',[v.origen,v.proyecto_id]);
 e=await guardar(v.id,true,e.version,801);assert.equal(e.enviada,true);assert.equal(Number(e.puntaje),100);
 await assert.rejects(guardar(v.id,true,e.version,802),/ya fue enviada/);
 await actor(3);await assert.rejects(guardar(v.id,true,0,803),/no está asignada/);
 console.log('PASS: horario y aula no bloquean; borrador, envío, rúbrica y propiedad se conservan');
} finally {await db.close()}
