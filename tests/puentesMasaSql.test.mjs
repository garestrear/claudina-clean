import {crearFeriaDb,uuid} from './fixtures/feriaDb.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {clasificacionPuentes} from '../src/puentes.js';
const {db,identity,rpc}=await crearFeriaDb();
try{
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;`);
 for(const f of ['inscripcion','tres-intentos','registro-y-eliminacion','descalificacion','orden-turnos','duracion','importar','corregir-masa'])await db.exec(await readFile(`supabase/feria-puentes-${f}.sql`,'utf8'));
 await identity(1);
 for(const [id,masa] of [[50,80],[51,90]])await rpc('feria_puentes_guardar',[uuid(id),{titulo:'Puente '+id,categoria:'puentes_infantil',integrantes_ids:[uuid(3)],masa_g:masa},0,crypto.randomUUID()],['uuid','jsonb','integer','uuid']);
 let ctx=await rpc('feria_puentes_contexto');
 const actuar=async(accion,datos={},solicitud=crypto.randomUUID())=>ctx=await rpc('feria_puentes_accion',[accion,datos,ctx.mesa.version,solicitud],['text','jsonb','integer','uuid']);
 await actuar('configurar',{categoria:'puentes_infantil',inicial:1,incremento:1,limite:100,separacion:50});
 for(const id of [50,51]){
  await actuar('seleccionar',{puente_id:uuid(id)});
  await actuar('iniciar',{carga_kg:5});
  await db.query("update feria_puentes_rondas set inicio=clock_timestamp()-interval '20 seconds',fin=clock_timestamp()-interval '1 second' where resultado='pendiente'");
  await actuar('validar');await actuar('finalizar',{motivo:'El equipo termina su participación'});
 }
 const rondas=structuredClone(ctx.rondas),previo=structuredClone(ctx.puentes.find(p=>p.id===uuid(50)));
 assert.equal(clasificacionPuentes(ctx.puentes,ctx.rondas,'puentes_infantil')[0].id,uuid(50));
 const solicitud=crypto.randomUUID(),version=ctx.mesa.version;
 await actuar('masa',{puente_id:uuid(50),masa_g:100},solicitud);
 assert.equal(clasificacionPuentes(ctx.puentes,ctx.rondas,'puentes_infantil')[0].id,uuid(51));
 assert.deepEqual(ctx.rondas,rondas);
 const despues=ctx.puentes.find(p=>p.id===uuid(50));
 for(const k of Object.keys(previo).filter(k=>!['masa_g','version','actualizado_en'].includes(k)))assert.deepEqual(despues[k],previo[k],k);
 await rpc('feria_puentes_accion',['masa',{puente_id:uuid(50),masa_g:100},version,solicitud],['text','jsonb','integer','uuid']);
 assert.equal((await db.query('select count(*)::int n from feria_puentes_auditoria where solicitud=$1',[solicitud])).rows[0].n,1);
 for(const masa_g of [0,-1,'NaN','Infinity',10000000])await assert.rejects(()=>actuar('masa',{puente_id:uuid(50),masa_g}));
 await assert.rejects(()=>actuar('masa',{puente_id:uuid(50),masa_g:90,largo_cm:5}),/Solo se permite/);
 await identity(3);await assert.rejects(()=>actuar('masa',{puente_id:uuid(50),masa_g:90}),/Solo docentes/);await identity(1);
 await actuar('masa',{puente_id:uuid(50),masa_g:''});assert.equal(ctx.puentes.find(p=>p.id===uuid(50)).masa_g,null);
 await db.exec(await readFile('supabase/feria-puentes-corregir-masa.sql','utf8'));
 assert.deepEqual((await rpc('feria_puentes_contexto')).rondas,rondas);
 console.log('PASS corrección de masa: puente finalizado, desempate actualizado, intentos y ficha intactos, permisos, validación, auditoría e idempotencia');
}finally{await db.close()}
