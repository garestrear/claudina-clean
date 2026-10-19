import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
await db.exec(`create schema auth;
create role anon; create role authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table public.perfiles(id uuid primary key,rol text);
create table public.estudiantes(id uuid primary key,auth_user_id uuid,grado int,activo boolean);
create table public.acudientes(id uuid primary key,auth_user_id uuid,estudiante_id uuid);
create function public.es_profesor() returns boolean language sql stable as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='profesor')$$;
`);
await db.exec(await readFile(new URL('../supabase/evaluacion-eventos.sql',import.meta.url),'utf8'));
const teacher='11111111-1111-4111-8111-111111111111',student='22222222-2222-4222-8222-222222222222',guardian='33333333-3333-4333-8333-333333333333',sid='44444444-4444-4444-8444-444444444444';
await db.query("insert into perfiles values ($1,'profesor'),($2,'estudiante'),($3,'acudiente')",[teacher,student,guardian]);
await db.query('insert into estudiantes values($1,$2,6,true)',[sid,student]);
await db.query('insert into acudientes values(gen_random_uuid(),$1,$2)',[guardian,sid]);
async function login(id){await db.query("select set_config('test.uid',$1,false)",[id]);}
await login(teacher);
const created=await db.query("select evento_crear('Prueba','',array[6],array['estudiante','acudiente','profesor']) id");const event=created.rows[0].id;
const migration=await readFile(new URL('../supabase/evento-eliminar.sql',import.meta.url),'utf8');await db.exec(migration);await db.exec(migration);
await db.query("select evento_estado($1,'abierto')",[event]);
const other=(await db.query("select evento_crear('Conservar','',array[6],array['estudiante']) id")).rows[0].id;
async function eliminar(nombre='Prueba',total=0){return db.query('select evento_eliminar($1,$2,$3)',[event,nombre,total])}
for(const id of [student,guardian,'']){await login(id);await assert.rejects(()=>eliminar(),/Solo docentes/)}
await login(teacher);await assert.rejects(()=>eliminar('Otro'),/título no coincide/);
await login(student);await db.query("select evento_responder($1,10,'Comentario')",[event]);
await login(teacher);await assert.rejects(()=>eliminar('Prueba',0),/cantidad de respuestas cambió/);assert.equal((await db.query('select count(*)::int n from evento_respuestas')).rows[0].n,1);
await db.query("insert into perfiles values('55555555-5555-4555-8555-555555555555','profesor')");await login('55555555-5555-4555-8555-555555555555');
await db.exec('set role authenticated');await eliminar('Prueba',1);await db.exec('reset role');
assert.equal((await db.query('select count(*)::int n from evento_respuestas')).rows[0].n,0);assert.equal((await db.query('select count(*)::int n from evento_participantes')).rows[0].n,0);assert.equal((await db.query('select id from eventos_evaluables')).rows[0].id,other);
await assert.rejects(()=>eliminar('Prueba',1),/ya no existe/);await assert.rejects(()=>db.query('select evento_resultados($1)',[event]),/inexistente/);
assert.equal((await db.query('select eventos_listar() d')).rows[0].d.length,1);
await db.exec('set role anon');await assert.rejects(()=>eliminar(),/permission denied/);await db.exec('reset role');
await login(teacher);await db.query("select evento_eliminar($1,'Conservar',0)",[other]);assert.equal((await db.query('select count(*)::int n from eventos_evaluables')).rows[0].n,0);
await db.close();console.log('PASS: eliminación por docentes, confirmación de título, conteo actualizado, cascada de respuestas/participantes, otras evaluaciones intactas, migración repetible y permisos');
