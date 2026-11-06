import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uuid,uid} from './fixtures/feriaDb.mjs';
import {clasificacionPuentes} from '../src/puentes.js';
const {db,identity,rpc}=await crearFeriaDb();
try{
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;`);
 for(const f of ['inscripcion','tres-intentos','registro-y-eliminacion','descalificacion','duracion','orden-turnos','corregir-masa','gran-final','gran-final'])await db.exec(await readFile(`supabase/feria-puentes-${f}.sql`,'utf8'));
 await identity(1);
 for(const categoria of ['puentes_juvenil','puentes_infantil'])for(let i=0;i<8;i++){
  const id=uuid((categoria==='puentes_juvenil'?100:200)+i);
  await db.query(`insert into feria_puentes(id,origen,categoria,titulo,integrantes,integrantes_ids,masa_g,estado,creado_por) values($1,'claudina',$2,$3,'Equipo de prueba',$4,80,'finalizado',$5)`,[id,categoria,'Puente '+i,[uuid(3)],uid(1)]);
  for(let n=1;n<=3;n++)await db.query(`insert into feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,resultado,operador,cuenta_intento) values($1,$2,$3,now()-interval '30 seconds',now()-interval '20 seconds','valida',$4,true)`,[id,n,20-i,uid(1)]);
 }
 await db.query("update feria_puentes set estado='descalificado' where id=$1",[uuid(100)]);
 let ctx=await rpc('feria_puentes_contexto');
 const act=async(a,d={},v=ctx.mesa.version,sol=crypto.randomUUID())=>ctx=await rpc('feria_puentes_accion',[a,d,v,sol],['text','jsonb','integer','uuid']);

 await identity(3);await assert.rejects(()=>act('preparar-final'),/Solo docentes/);await identity(1);
 await db.query("insert into feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,operador) values($1,4,1,now(),now()+interval '10 seconds',$2)",[uuid(207),uid(1)]);
 await assert.rejects(()=>act('preparar-final'),/curso/);
 await db.query("delete from feria_puentes_rondas where resultado='pendiente'");
 // Empate exacto en el último cupo: no se decide por nombre.
 await db.query('update feria_puentes_rondas set carga_kg=15 where puente_id=$1',[uuid(206)]);
 await assert.rejects(()=>act('preparar-final'),/empate/);
 assert.equal((await db.query("select count(*)::int n from feria_puentes where fase='final'")).rows[0].n,0);
 await db.query('update feria_puentes set masa_g=90 where id=$1',[uuid(206)]);
 ctx=await rpc('feria_puentes_contexto');const originales=JSON.stringify(ctx.rondas);
 const version=ctx.mesa.version,sol=crypto.randomUUID();await act('preparar-final',{},version,sol);await act('preparar-final',{},version,sol);
 assert.equal(ctx.fase,'final');assert.equal(ctx.puentes.length,11);assert.equal(ctx.rondas.length,0);
 assert.equal(ctx.puentes.filter(p=>p.categoria==='puentes_juvenil').length,5);
 assert.equal(ctx.puentes.filter(p=>p.categoria==='puentes_infantil').length,6);
 assert(!ctx.puentes.some(p=>p.puente_eliminatoria_id===uuid(100)));
 assert(ctx.puentes.every(p=>p.estado==='pendiente'&&p.integrantes==='Equipo de prueba'));
 assert(clasificacionPuentes(ctx.puentes,ctx.rondas,'puentes_juvenil').every(p=>p.total===0&&p.intentos===0));
 await assert.rejects(()=>act('seleccionar',{puente_id:uuid(101)}),/fase activa/);
 const finalista=ctx.puentes.find(p=>p.categoria==='puentes_infantil');
 await act('configurar',{categoria:'puentes_infantil',inicial:1,incremento:1,limite:100,separacion:10}).catch(()=>{});
 // Config ya tiene pruebas eliminatorias; establecer condiciones como preparación del fixture.
 await db.exec("update feria_puentes_config set inicial=1,incremento=1,limite=100,separacion=10 where categoria='puentes_infantil'");
 ctx=await rpc('feria_puentes_contexto');await act('seleccionar',{puente_id:finalista.id});
 await act('iniciar',{carga_kg:10});await assert.rejects(()=>act('fase',{fase:'eliminatoria'}),/curso/);
 await act('fallo',{roto:false});
 for(const carga_kg of [7,9]){await act('iniciar',{carga_kg});await db.exec("update feria_puentes_rondas set inicio=clock_timestamp()-interval '20 seconds',fin=clock_timestamp()-interval '1 second' where resultado='pendiente'");await act('validar')}
 const marca=clasificacionPuentes(ctx.puentes,ctx.rondas,'puentes_infantil').find(p=>p.id===finalista.id);
 assert.equal(marca.total,16);assert.equal(marca.intentos,3);assert.equal(marca.estado,'finalizado');
 await assert.rejects(()=>act('iniciar',{carga_kg:1}),/Selecciona/);
 await act('fase',{fase:'eliminatoria'});assert.equal(ctx.puentes.length,16);assert.equal(JSON.stringify(ctx.rondas),originales);
 await assert.rejects(()=>act('seleccionar',{puente_id:uuid(101)}),/cerrada/);
 await assert.rejects(()=>db.query("update feria_puentes_rondas set carga_kg=1 where puente_id=$1",[uuid(101)]),/cerrada/);
 const ins=await rpc('feria_puentes_inscripcion_contexto');assert.equal(ins.puentes.length,16);
 await act('fase',{fase:'final'});assert.equal(ctx.rondas.length,3);assert.equal(ctx.puentes.length,11);
 await act('preparar-final');assert.equal(ctx.rondas.length,3,'Repetir no borra intentos');
 await db.exec('set role authenticated');await assert.rejects(()=>rpc('feria_puentes_contexto_sin_fases'),/permission denied/);
 console.log('PASS gran final: 5 juveniles, 6 infantiles, exclusión descalificados, empates, 3 intentos desde cero, archivo intacto, fases, permisos e idempotencia');
}finally{await db.close()}
