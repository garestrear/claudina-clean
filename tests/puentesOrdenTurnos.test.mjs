import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uuid} from './fixtures/feriaDb.mjs';
import {ordenarTurnosPuentes,intentosPuente,clasificacionPuentes} from '../src/puentes.js';
const bridges=[
 {id:'a',titulo:'Zeta',grado_turno:2,intentos_consumidos:0},
 {id:'b',titulo:'Águila',grado_turno:6,intentos_consumidos:0},
 {id:'c',titulo:'Brisa',grado_turno:6,intentos_consumidos:0},
 {id:'d',titulo:'Primero',grado_turno:0,intentos_consumidos:1},
 {id:'e',titulo:'Otro',grado_turno:1,intentos_consumidos:2},
 {id:'f',titulo:'Final',grado_turno:1,intentos_consumidos:3},
 {id:'g',titulo:'Sin grado',grado_turno:null,intentos_consumidos:0},
 {id:'h',titulo:'Pequeños',grado_turno:0,intentos_consumidos:0}
];
const ids=a=>a.map(p=>p.id);
assert.deepEqual(ids(ordenarTurnosPuentes(bridges)),['h','a','b','c','g','d','e','f']);
assert.equal(bridges[0].id,'a','El orden original no se muta');
assert.deepEqual(ids(ordenarTurnosPuentes([{id:'x',titulo:'Águila',grado_turno:6},{id:'y',titulo:'arco',grado_turno:6}])),['x','y']);
assert.deepEqual(ids(ordenarTurnosPuentes([{id:'x',titulo:'Zeta',equipo:[{grado:8},{grado:2}]},{id:'y',titulo:'A',equipo:[{grado:6}]}])),['x','y']);
const rondas=[{puente_id:'a',resultado:'valida',cuenta_intento:true},{puente_id:'a',resultado:'anulada',cuenta_intento:false},{puente_id:'b',resultado:'anulada',cuenta_intento:true}];
assert.equal(intentosPuente(bridges[0],rondas),1);assert.equal(intentosPuente(bridges[1],rondas),1);
assert.deepEqual(ids(ordenarTurnosPuentes(bridges.slice(0,3),rondas)),['c','a','b']);
const {db,identity,rpc}=await crearFeriaDb();
try{
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;`);
 for(const f of ['feria-puentes-inscripcion','feria-puentes-tres-intentos','feria-puentes-registro-y-eliminacion','feria-puentes-descalificacion','feria-puentes-orden-turnos','feria-puentes-orden-turnos'])await db.exec(await readFile(`supabase/${f}.sql`,'utf8'));
 await identity(1);
 for(const [n,titulo,equipo] of [[50,'Zeta',[uuid(3)]],[51,'Águila',[uuid(3)]],[52,'Mayor',[uuid(9)]],[53,'Mixto',[uuid(9),uuid(4)]]])await rpc('feria_puentes_guardar',[uuid(n),{titulo,categoria:'puentes_infantil',integrantes_ids:equipo,masa_g:80},0,crypto.randomUUID()],['uuid','jsonb','integer','uuid']);
 let ctx=await rpc('feria_puentes_contexto');assert.equal(ctx.orden_turnos,true);
 assert.deepEqual(ids(ordenarTurnosPuentes(ctx.puentes,ctx.rondas)),[uuid(53),uuid(51),uuid(50),uuid(52)]);
 const actuar=async(accion,datos={})=>ctx=await rpc('feria_puentes_accion',[accion,datos,ctx.mesa.version,crypto.randomUUID()],['text','jsonb','integer','uuid']);
 await actuar('configurar',{categoria:'puentes_infantil',inicial:1,incremento:1,limite:20,separacion:50});
 await actuar('seleccionar',{puente_id:uuid(53)});await actuar('iniciar',{carga_kg:10});await actuar('fallo',{roto:false});
 assert.deepEqual(ids(ordenarTurnosPuentes(ctx.puentes,ctx.rondas)),[uuid(51),uuid(50),uuid(52),uuid(53)]);
 let ins=await rpc('feria_puentes_inscripcion_contexto');assert.deepEqual(ids(ordenarTurnosPuentes(ins.puentes)),ids(ordenarTurnosPuentes(ctx.puentes,ctx.rondas)));
 assert.equal(ins.puentes.find(p=>p.id===uuid(53)).intentos_consumidos,1);assert.equal(ins.puentes.find(p=>p.id===uuid(53)).grado_turno,0);
 await actuar('seleccionar',{puente_id:uuid(51)});await actuar('iniciar',{carga_kg:5});await actuar('cancelar',{motivo:'Ajuste de montaje'});
 assert.equal(ordenarTurnosPuentes(ctx.puentes,ctx.rondas)[0].id,uuid(51),'Cancelación no consume');
 await actuar('iniciar',{carga_kg:5});await db.exec("update feria_puentes_rondas set inicio=now()-interval '6 seconds',fin=now()-interval '1 second' where resultado='pendiente'");await actuar('validar');
 assert.equal(ordenarTurnosPuentes(ctx.puentes,ctx.rondas)[0].id,uuid(50),'Menos intentos primero tras intento válido');
 assert.equal(clasificacionPuentes(ctx.puentes,ctx.rondas,'puentes_infantil')[0].id,uuid(51),'El ranking conserva puntuación');
 await identity(3);ins=await rpc('feria_puentes_inscripcion_contexto');assert(ins.puentes.every(p=>p.grado_turno===6));await assert.rejects(()=>rpc('feria_puentes_contexto'),/Solo docentes/);
 console.log('PASS orden de turnos: intentos, grado, alfabético español, equipos mixtos, cancelación, fallo, actualización de contextos y ranking');
}finally{await db.close()}
