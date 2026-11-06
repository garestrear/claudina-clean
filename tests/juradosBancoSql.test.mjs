import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearEvaluacionDb} from './fixtures/evaluacionDb.mjs';
const {db,actor,rpc,uid,ctx}=await crearEvaluacionDb();
await db.exec('create role service_role bypassrls');
await db.exec(await readFile('supabase/feria-jurados-cuentas.sql','utf8'));
const sql=await readFile('supabase/feria-jurados-banco-cuentas.sql','utf8');
await db.exec(sql);await db.exec(sql);
await actor(null);await assert.rejects(rpc('feria_jurado_banco_listar'),/Solo docentes/);
await actor(1);assert.deepEqual(await rpc('feria_jurado_banco_listar'),[]);
for(let n=1;n<=20;n++){
 const usuario='jurado'+String(n).padStart(2,'0');
 await db.query('insert into auth.users values($1,$2,now())',[uid(800+n),usuario+'@jurados.claudina.invalid']);
 await db.exec('set role authenticated');await assert.rejects(rpc('feria_jurado_banco_registrar',[usuario,uid(800+n)],['text','uuid']),/permission denied/);await db.exec('reset role');
 await db.exec('set role service_role');await rpc('feria_jurado_banco_registrar',[usuario,uid(800+n)],['text','uuid']);await rpc('feria_jurado_banco_registrar',[usuario,uid(800+n)],['text','uuid']);await db.exec('reset role');
}
assert.equal((await rpc('feria_jurado_banco_listar')).length,20);
await db.query("select set_config('test.uid',$1,false)",[uid(801)]);assert.equal(await rpc('feria_mi_jurado'),null,'reserva sin asignar no es jurado');
await actor(1);await rpc('feria_jurado_banco_asignar',[uid(101),'jurado01'],['uuid','text']);
await assert.rejects(rpc('feria_jurado_banco_asignar',[uid(102),'jurado01'],['uuid','text']),/no está disponible/);
await assert.rejects(rpc('feria_jurado_banco_asignar',[uid(101),'jurado02'],['uuid','text']),/ya vinculada/);
const cuentas=await rpc('feria_jurado_banco_listar');assert.equal(cuentas.filter(c=>!c.jurado_id).length,19);assert.equal(cuentas[0].jurado_id,uid(101));
await db.query("select set_config('test.uid',$1,false)",[uid(801)]);assert((await ctx()).requiere_cambio_password);
await db.exec('set role authenticated');await assert.rejects(db.query('select * from feria_jurado_cuentas_disponibles'),/permission denied/);await db.exec('reset role');
await actor(2);await assert.rejects(rpc('feria_jurado_banco_asignar',[uid(102),'jurado02'],['uuid','text']),/Solo docentes/);
console.log('PASS banco: 20 reservas, permisos, repetición, asociación única, acceso bloqueado sin asignar y cambio obligatorio');await db.close();
