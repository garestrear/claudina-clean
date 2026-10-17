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
await db.exec(await readFile(new URL('../supabase/evento-resultados-por-rol.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/evento-resultados-por-rol.sql',import.meta.url),'utf8'));
async function results(){return (await db.query('select evento_resultados($1) d',[event])).rows[0].d}
let data=await results();assert.equal(data.total,0);assert.equal(data.promedio,null);assert.deepEqual(data.grupos,[]);
await db.query('select evento_estado($1,$2)',[event,'abierto']);
await login(student);await db.query('select evento_responder($1,10,$2)',[event,'Excelente']);
await login(teacher);data=await results();assert.equal(data.promedio,10);assert.equal(data.grupos[0].tipo,'estudiante');assert.deepEqual(data.grupos[0].comentarios,['Excelente']);
await db.query('select evento_responder($1,8,$2)',[event,'Buena actividad']);
await login(guardian);await db.query('select evento_responder($1,4,$2)',[event,'Mejorar horario']);
await assert.rejects(()=>db.query('select evento_responder($1,1,$2)',[event,'Duplicada']));
await assert.rejects(()=>results());
await login(teacher);
await db.query("insert into evento_respuestas(evento_id,nota,comentario) values($1,6,'Histórica')",[event]);
data=await results();assert.equal(data.total,4);assert.equal(data.promedio,7);assert.equal(data.grupos.length,4);
for(const [tipo,avg] of [['estudiante',10],['profesor',8],['acudiente',4],['sin_clasificar',6]])assert.equal(data.grupos.find(g=>g.tipo===tipo).promedio,avg);
assert.equal(JSON.stringify(data).includes(student),false);
console.log('PASS: migración repetible; cero y una respuesta; promedio y comentarios de los tres roles; histórico sin clasificar; promedio general; duplicados y acceso docente; sin identidades en resultados');
await db.close();

