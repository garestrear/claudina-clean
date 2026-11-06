import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearEvaluacionDb} from './fixtures/evaluacionDb.mjs';
const {db,actor,rpc,ctx,guardarPlan}=await crearEvaluacionDb();
try{
 const sql=await readFile('supabase/feria-evaluaciones-manuales.sql','utf8');await db.exec(sql);await db.exec(sql);await guardarPlan();
 let c=await ctx();const v=c.visitas[0];
 await actor(2);await assert.rejects(()=>rpc('feria_evaluacion_manual',[v.id,4.5,'Papel'],['uuid','numeric','text']),/Solo docentes/);
 await actor(1);for(const n of [0,5.01,4.555,'NaN'])await assert.rejects(()=>rpc('feria_evaluacion_manual',[v.id,n,''],['uuid','numeric','text']),/promedio/);
 const e=await rpc('feria_evaluacion_manual',[v.id,4.5,'Ficha entregada al comité'],['uuid','numeric','text']);assert.equal(Number(e.puntaje),90);assert.equal(e.enviada,true);assert.equal(e.registro_manual,true);assert.deepEqual(e.notas,[]);assert(e.registrado_por);assert.equal(Number(e.promedio_manual),4.5);
 await assert.rejects(()=>rpc('feria_evaluacion_manual',[v.id,3,''],['uuid','numeric','text']),/No se sobrescribió/);
 c=await ctx();assert.equal(c.visitas.find(x=>x.id===v.id).evaluacion.registro_manual,true);
 const otra=c.visitas.find(x=>x.id!==v.id);await db.query("insert into feria_evaluaciones(visita_id,solicitud) values($1,gen_random_uuid())",[otra.id]);await assert.rejects(()=>rpc('feria_evaluacion_manual',[otra.id,3,''],['uuid','numeric','text']),/No se sobrescribió/);
 console.log('PASS SQL: solo docentes, límites, conversión, autor, resultados, no sobrescribir notas ni borradores, migración repetible');
}finally{await db.close()}
