import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
const {db,identity,rpc}=await crearFeriaDb();
try{
 await db.exec('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create schema storage;create table storage.objects(id int);alter table storage.objects enable row level security;');
 for(const f of ['feria-invitados','feria-rechazar','feria-jurados','feria-poster','feria-edicion-equipos','feria-familias-estados','feria-espacios-programacion','feria-asignacion-automatica','feria-revision-aula'])await db.exec(await readFile(`supabase/${f}.sql`,'utf8'));
 await db.exec(await readFile('supabase/feria-revision-aula.sql','utf8'));
 await identity(1);
 await db.exec("update feria_espacios set cupos=2 where codigo in('salon-1','salon-2')");
 const aulas=(await db.query("select id from feria_espacios where codigo in('salon-1','salon-2') order by codigo")).rows;
 for(const n of [800,801,802]){
  await identity(3);await rpc('feria_guardar',[uuid(n),{titulo:'Proyecto '+n,integrantes:'',materiales:'',resultados_esperados:'',bibliografia:'',apoyo:'',propuesta:'Explorar',procedimiento:'Medir',areas:['science'],asesor_id:uid(1),integrantes_ids:[]},0,true,uuid(n+100)],['uuid','jsonb','integer','boolean','uuid']);
 }
 await identity(1);
 const types=['text','uuid','integer','text','text','uuid','uuid','uuid','integer'];
 const args=['claudina',uuid(800),1,'aprobado','Excelente',uuid(950),aulas[1].id,null,null];
 await rpc('feria_revision_con_aula',args,types);
 let reserva=(await db.query('select * from feria_programacion where proyecto_id=$1',[uuid(800)])).rows[0];
 assert.equal(reserva.espacio_id,aulas[1].id);
 await rpc('feria_revision_con_aula',args,types);
 assert.equal((await db.query('select count(*)::int n from feria_programacion where proyecto_id=$1',[uuid(800)])).rows[0].n,1);
 await rpc('feria_revision_con_aula',['claudina',uuid(801),1,'aprobado','',uuid(951),aulas[1].id,null,null],types);
 await assert.rejects(rpc('feria_revision_con_aula',['claudina',uuid(802),1,'aprobado','',uuid(952),aulas[1].id,null,null],types),/máximo de puestos/);
 assert.equal((await db.query('select estado from feria_proyectos where id=$1',[uuid(802)])).rows[0].estado,'enviado','Fallo del aula revierte aprobación');
 assert.equal((await db.query('select count(*)::int n from feria_revisiones where proyecto_id=$1',[uuid(802)])).rows[0].n,0);
 await assert.rejects(rpc('feria_revision_con_aula',['claudina',uuid(800),2,null,'',uuid(953),aulas[0].id,reserva.id,reserva.version-1],types),/ubicación cambió/);
 await rpc('feria_revision_con_aula',['claudina',uuid(800),2,null,'',uuid(954),aulas[0].id,reserva.id,reserva.version],types);
 await rpc('feria_revision_con_aula',args,types);
 assert.equal((await db.query('select espacio_id from feria_programacion where id=$1',[reserva.id])).rows[0].espacio_id,aulas[0].id,'Reintentar solicitud vieja no deshace traslado posterior');
 await identity(3);
 await assert.rejects(rpc('feria_revision_con_aula',args,types),/Solo docentes/);
 await assert.rejects(rpc('feria_revision_aulas_contexto'),/Solo docentes/);
 console.log('PASS revisión con aula: aprobación atómica, cupos, traslado, versiones, reintentos y permisos');
}finally{await db.close()}
