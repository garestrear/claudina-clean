import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uuid,uid} from './fixtures/feriaDb.mjs';
const {db,identity,rpc}=await crearFeriaDb();
try{
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;`);
 for(const f of ['inscripcion','tres-intentos','registro-y-eliminacion','descalificacion','duracion','orden-turnos','corregir-masa','gran-final','reclasificar-final','reclasificar-final'])await db.exec(await readFile(`supabase/feria-puentes-${f}.sql`,'utf8'));
 await identity(1);
 for(const categoria of ['puentes_juvenil','puentes_infantil'])for(let i=0;i<8;i++){
  const id=uuid((categoria==='puentes_juvenil'?100:200)+i);
  await db.query(`insert into feria_puentes(id,origen,categoria,titulo,integrantes,integrantes_ids,masa_g,estado,creado_por) values($1,'claudina',$2,$3,'Equipo de prueba',$4,80,'finalizado',$5)`,[id,categoria,'Puente '+i,[uuid(3)],uid(1)]);
  for(let n=1;n<=3;n++)await db.query(`insert into feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,resultado,operador,cuenta_intento) values($1,$2,$3,now()-interval '30 seconds',now()-interval '20 seconds','valida',$4,true)`,[id,n,20-i,uid(1)]);
 }
 let ctx=await rpc('feria_puentes_contexto');await rpc('feria_puentes_accion',['preparar-final',{},ctx.mesa.version,crypto.randomUUID()],['text','jsonb','integer','uuid']);
 const finales=()=>db.query("select * from feria_puentes where fase='final' order by id");
 const obtener=async id=>(await db.query('select * from feria_puentes where id=$1',[id])).rows[0];
 const descalificar=(id,version,sol=crypto.randomUUID())=>rpc('feria_puentes_descalificar',[id,version,sol,'Longitud inferior al requisito'],['uuid','integer','uuid','text']);
 let fs=(await finales()).rows;const retirado=fs.find(p=>p.puente_eliminatoria_id===uuid(100)),conservado=fs.find(p=>p.puente_eliminatoria_id===uuid(101));
 for(const p of [retirado,conservado])await db.query(`insert into feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,resultado,operador,cuenta_intento)values($1,1,9,now()-interval '30 seconds',now()-interval '20 seconds','valida',$2,true)`,[p.id,uid(1)]);
 const rondas=JSON.stringify((await db.query('select * from feria_puentes_rondas order by id')).rows);
 const version=(await obtener(uuid(100))).version,sol=crypto.randomUUID();
 await identity(3);await assert.rejects(descalificar(uuid(100),version,sol),/Solo docentes/);await identity(1);
 await descalificar(uuid(100),version,sol);await descalificar(uuid(100),version,sol);
 fs=(await finales()).rows;assert.equal(fs.length,12);assert.equal(fs.filter(p=>p.estado!=='descalificado').length,11);assert.equal((await obtener(retirado.id)).estado,'descalificado');assert.equal((await obtener(conservado.id)).id,conservado.id);
 const promovido=fs.find(p=>p.puente_eliminatoria_id===uuid(105));assert(promovido);assert.equal(promovido.estado,'pendiente');assert.equal((await db.query('select count(*)::int n from feria_puentes_rondas where puente_id=$1',[promovido.id])).rows[0].n,0);
 assert.equal(JSON.stringify((await db.query('select * from feria_puentes_rondas order by id')).rows),rondas,'conserva TODOS los intentos, incluidos los del retirado');
 const a=(await db.query('select datos from feria_puentes_auditoria where solicitud=$1',[sol])).rows[0].datos;assert(a.final_antes&&a.final_despues&&a.inscripcion);
 // Un intento pendiente bloquea la corrección completa.
 const infantil=fs.find(p=>p.puente_eliminatoria_id===uuid(200));await db.query(`insert into feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,operador)values($1,1,1,now(),now()+interval '10 seconds',$2)`,[infantil.id,uid(1)]);
 await assert.rejects(descalificar(uuid(200),(await obtener(uuid(200))).version),/prueba en curso/);assert.notEqual((await obtener(uuid(200))).estado,'descalificado');await db.query("delete from feria_puentes_rondas where resultado='pendiente'");
 await descalificar(uuid(200),(await obtener(uuid(200))).version);assert((await finales()).rows.find(p=>p.puente_eliminatoria_id===uuid(206)));
 // Empate en el corte revierte la descalificación sin retirar finalistas.
 const primero=(await obtener(uuid(101)));await db.exec("alter table feria_puentes_rondas disable trigger feria_puentes_rondas_archivo");await db.query('update feria_puentes_rondas set carga_kg=14 where puente_id=$1',[uuid(107)]);await db.exec("alter table feria_puentes_rondas enable trigger feria_puentes_rondas_archivo");
 await assert.rejects(descalificar(primero.id,primero.version),/empate/);assert.notEqual((await obtener(primero.id)).estado,'descalificado');
 await descalificar(uuid(106),(await obtener(uuid(106))).version);await descalificar(uuid(107),(await obtener(uuid(107))).version);await assert.rejects(descalificar(uuid(101),(await obtener(uuid(101))).version),/suficientes/);assert.notEqual((await obtener(uuid(101))).estado,'descalificado');
 // La excepción de archivo no permite alterar cargas, masa ni retirar fichas.
 await assert.rejects(db.query('update feria_puentes set masa_g=90 where id=$1',[uuid(101)]),/cerrada/);await assert.rejects(db.query('delete from feria_puentes where id=$1',[uuid(101)]),/cerrada/);await assert.rejects(db.query('update feria_puentes_rondas set carga_kg=1 where puente_id=$1',[uuid(101)]),/cerrada/);
 await db.exec('set role authenticated');await assert.rejects(rpc('feria_puentes_descalificar_sin_recalculo',[uuid(102),1,crypto.randomUUID(),'Motivo válido'],['uuid','integer','uuid','text']),/permission denied/);await db.exec('reset role');
 console.log('PASS reclasificación: reemplazo juvenil/infantil, finales en cero, marcas intactas, auditoría, permisos, reintentos, prueba pendiente, empate y archivo protegido');
}finally{await db.close()}
