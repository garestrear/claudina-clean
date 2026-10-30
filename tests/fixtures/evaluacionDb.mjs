import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {generarRecorrido} from '../../src/evaluacionJurados.js';
export async function crearEvaluacionDb(){
const db=new PGlite();const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table perfiles(id uuid primary key,nombre text,rol text);
create function public.es_profesor() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='profesor')$$;
create table feria_proyectos(id uuid primary key,titulo text,grado integer,estado text,integrantes text,propuesta text,procedimiento text,resultados_esperados text,areas text[],asesor_id uuid,autor uuid);
create table feria_proyectos_externos(id uuid primary key,datos jsonb,estado text,autor uuid);
create table feria_placas(origen text,proyecto_id uuid,categoria text,numero_categoria integer,numero_general integer);
insert into perfiles values('${uid(1)}','Organizador','profesor');
insert into auth.users values('${uid(1)}','profe@ejemplo.co',now()),('${uid(2)}','jurado1@ejemplo.co',now()),('${uid(3)}','jurado2@ejemplo.co',now()),('${uid(4)}','jurado3@ejemplo.co',now()),('${uid(5)}','jurado4@ejemplo.co',now()),('${uid(6)}','otro@ejemplo.co',now()),('${uid(7)}','sinverificar@ejemplo.co',null);`);
for(const archivo of ['feria-jurados.sql','feria-espacios-programacion.sql','feria-evaluacion-jurados.sql'])await db.exec(await readFile('supabase/'+archivo,'utf8'));
await db.exec(await readFile('supabase/feria-evaluacion-jurados.sql','utf8'));
const actor=async n=>db.query("select set_config('test.uid',$1,false)",[n?uid(n):'']);
const rpc=async(name,args=[],types=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)+'::'+types[i]).join(',')}) d`,args)).rows[0].d;
const ctx=()=>rpc('feria_evaluacion_contexto');
await actor(1);
for(let n=10;n<15;n++)await db.query("insert into feria_proyectos values($1,$2,6,'aprobado','Ana y Luis','Investigar','Probar','Aprender',array['science'],$3,$4)",[uid(n),'Proyecto '+n,uid(1),uid(90)]);
await db.query("insert into feria_proyectos_externos values($1,$2,'aprobado',$3)",[uid(15),{titulo:'Proyecto externo',areas:['arts'],integrantes:'Equipo invitado',propuesta:'Arte con reciclaje'},uid(91)]);
let c=await ctx();assert.equal(c.proyectos.length,6);
for(let n=1;n<=4;n++)await rpc('feria_jurado_habilitar',[uid(100+n),{nombre:'Jurado '+n,correo:`jurado${n}@ejemplo.co`,areas:['science'],conflictos:[]},true],['uuid','jsonb','boolean']);
await rpc('feria_jurado_habilitar',[uid(107),{nombre:'Sin verificar',correo:'sinverificar@ejemplo.co',areas:[],conflictos:[]},true],['uuid','jsonb','boolean']);
// Organizador también como jurado: no puede evaluar sus propios asesorados.
await rpc('feria_jurado_habilitar',[uid(108),{nombre:'Profe',correo:'profe@ejemplo.co',areas:[],conflictos:[]},true],['uuid','jsonb','boolean']);
for(const p of c.proyectos){const aula=(await db.query("select id from feria_espacios where codigo='salon-1'")).rows[0].id;await db.query("insert into feria_programacion(espacio_id,fecha,inicio,fin,tipo,origen,proyecto_id,titulo)values($1,'2026-11-06','08:00','10:00','proyecto',$2,$3,$4)",[aula,p.origen,p.id,p.titulo])}
c=await ctx();const plan=generarRecorrido(c.proyectos,c.jurados.filter(j=>j.id!==uid(107)&&j.id!==uid(108)),{fecha:'2026-11-06',inicio:'08:00',fin:'10:00'});
const guardarPlan=(vs=plan,version=c.config.version)=>rpc('feria_evaluacion_plan',['2026-11-06','08:00','10:00',vs,version],['date','time','time','jsonb','integer']);
return {db,actor,rpc,ctx,uid,plan,guardarPlan};
}
