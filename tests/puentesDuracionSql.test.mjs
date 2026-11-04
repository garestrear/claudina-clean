import {crearFeriaDb,uuid} from './fixtures/feriaDb.mjs';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const {db,identity,rpc}=await crearFeriaDb();
try{
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;`);
 for(const f of ['feria-puentes-inscripcion','feria-puentes-tres-intentos','feria-puentes-registro-y-eliminacion','feria-puentes-descalificacion','feria-puentes-orden-turnos'])await db.exec(await readFile(`supabase/${f}.sql`,'utf8'));
 await identity(1);await rpc('feria_puentes_guardar',[uuid(50),{titulo:'Prueba de duración',categoria:'puentes_infantil',integrantes_ids:[uuid(3)],masa_g:80},0,crypto.randomUUID()],['uuid','jsonb','integer','uuid']);
 let ctx=await rpc('feria_puentes_contexto');
 const actuar=async(accion,datos={},solicitud=crypto.randomUUID())=>ctx=await rpc('feria_puentes_accion',[accion,datos,ctx.mesa.version,solicitud],['text','jsonb','integer','uuid']);
 await actuar('configurar',{categoria:'puentes_infantil',inicial:1,incremento:1,limite:20,separacion:50});await actuar('seleccionar',{puente_id:uuid(50)});await actuar('iniciar',{carga_kg:5});
 const legacy=ctx.rondas[0];assert.equal((Date.parse(legacy.fin)-Date.parse(legacy.inicio))/1000,5);
 await db.exec(await readFile('supabase/feria-puentes-duracion.sql','utf8'));ctx=await rpc('feria_puentes_contexto');assert.deepEqual(ctx.rondas[0],legacy);assert(ctx.config.every(c=>c.duracion_segundos===10));
 await assert.rejects(()=>actuar('duracion',{categoria:'puentes_infantil',segundos:20}),/intento/);
 await actuar('cancelar',{motivo:'Ajustar el montaje'});await actuar('iniciar',{carga_kg:7});let r=ctx.rondas.at(-1);assert.equal((Date.parse(r.fin)-Date.parse(r.inicio))/1000,10);
 await db.query("update feria_puentes_rondas set inicio=clock_timestamp()-interval '5 seconds',fin=clock_timestamp()+interval '5 seconds' where id=$1",[r.id]);await assert.rejects(()=>actuar('validar'),/termine el tiempo/);
 await db.query("update feria_puentes_rondas set inicio=clock_timestamp()-interval '11 seconds',fin=clock_timestamp()-interval '1 second' where id=$1",[r.id]);await actuar('validar');
 for(const segundos of [0,121,2.5,-1])await assert.rejects(()=>actuar('duracion',{categoria:'puentes_infantil',segundos}),/duración/);
 const req=crypto.randomUUID(),version=ctx.mesa.version;await actuar('duracion',{categoria:'puentes_infantil',segundos:20},req);assert.equal(ctx.config.find(c=>c.categoria==='puentes_infantil').duracion_segundos,20);
 await rpc('feria_puentes_accion',['duracion',{categoria:'puentes_infantil',segundos:20},version,req],['text','jsonb','integer','uuid']);
 await db.exec(await readFile('supabase/feria-puentes-duracion.sql','utf8'));ctx=await rpc('feria_puentes_contexto');assert.equal(ctx.config.find(c=>c.categoria==='puentes_infantil').duracion_segundos,20);
 await actuar('iniciar',{carga_kg:9});r=ctx.rondas.at(-1);assert.equal((Date.parse(r.fin)-Date.parse(r.inicio))/1000,20);
 await identity(3);await assert.rejects(()=>actuar('duracion',{categoria:'puentes_infantil',segundos:15}),/Solo docentes/);
 assert(ctx.rondas.some(r=>r.resultado==='valida'&&r.carga_kg===7));console.log('PASS duración SQL: 10 s iniciales, configuración 20 s, bloqueo de cambio en curso, validación por tiempo del servidor, historial de 5 s intacto, permisos e idempotencia');
}finally{await db.close()}
