import {generarGruposCarrusel} from '../src/carruselFeria.js';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table perfiles(id uuid primary key,nombre text,rol text);create function public.es_profesor() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='profesor')$$;create table feria_proyectos(id uuid primary key,titulo text,grado integer,estado text);create table feria_proyectos_externos(id uuid primary key,datos jsonb,estado text);`);
await db.query("insert into perfiles values($1,'Docente','profesor'),($2,'Estudiante','estudiante')",[uid(1),uid(2)]);


await db.exec(`create table estudiantes(id uuid primary key,nombre text,grado integer,activo boolean);alter table feria_proyectos add column estudiante_id uuid;alter table feria_proyectos add column integrantes_ids uuid[] not null default '{}';`);
for(let n=3;n<10;n++)await db.query("insert into perfiles values($1,$2,'profesor')",[uid(n),'Docente '+n]);
for(let n=101;n<115;n++)await db.query("insert into estudiantes values($1,$2,6,true)",[uid(n),'Estudiante '+n]);
await db.exec(await readFile('supabase/feria-espacios-programacion.sql','utf8'));
const sql=await readFile('supabase/feria-carrusel.sql','utf8');await db.exec(sql);await db.exec(sql);
await db.query("select set_config('test.uid',$1,false)",[uid(1)]);
for(let n=20;n<23;n++)await db.query("insert into feria_proyectos(id,titulo,grado,estado,estudiante_id,integrantes_ids) values($1,$2,6,'aprobado',$3,$4)",[uid(n),'Proyecto '+n,uid(n+81),n===20?[uid(104)]:[]]);
const aulas=(await db.query("select id from feria_espacios where codigo in('salon-1','salon-2') order by codigo")).rows;
for(let n=20;n<23;n++)await db.query("select feria_programacion_guardar($1,$2,0)",[uid(n+300),{tipo:'proyecto',origen:'claudina',proyecto_id:uid(n),fecha:'2026-11-06',inicio:'08:00',fin:'10:00',espacio_id:aulas[n===22?1:0].id}]);
try{
for(const f of ['feria-asignacion-automatica','feria-puestos-automaticos','feria-agenda-general','feria-dos-franjas','feria-carrusel-segunda-franja','feria-carrusel-segunda-franja'])await db.exec(await readFile('supabase/'+f+'.sql','utf8'));
await db.exec("update feria_espacios set cupos=20;update feria_programacion set activo=false where tipo='proyecto'");
for(const [g,n] of [[0,3],[1,5],[2,2],[3,4],[4,7],[5,6],[7,2],[8,2]])for(let i=0;i<n;i++)await db.query('insert into estudiantes values($1,$2,$3,true)',[uid(1000+g*30+i),'Grado '+g+' estudiante '+i,g]);
await db.query('update estudiantes set grado=2 where id=any($1::uuid[])',[[uid(101),uid(104)]]);
const lugares=(await db.query("select id from feria_espacios where codigo in('salon-1','salon-2','salon-3','salon-4','salon-5') order by codigo")).rows;
await db.query("select feria_programacion_guardar($1,$2,0)",[uid(500),{tipo:'proyecto',origen:'claudina',proyecto_id:uid(20),fecha:'2026-11-06',inicio:'10:15',fin:'11:40',espacio_id:lugares[0].id}]);
await db.query("select feria_programacion_guardar($1,$2,0)",[uid(501),{tipo:'proyecto',origen:'claudina',proyecto_id:uid(21),fecha:'2026-11-06',inicio:'08:00',fin:'10:00',espacio_id:lugares[0].id}]);
for(let i=1;i<5;i++){
 await db.query("insert into feria_proyectos_externos values($1,$2,'aprobado')",[uid(600+i),{titulo:'Invitado '+i}]);
 await db.query('update feria_programacion set espacio_id=$1 where proyecto_id=$2',[lugares[i].id,uid(600+i)]);
}
const contexto=(desde,hasta)=>db.query("select feria_carrusel_contexto('2026-11-06',$1,$2) d",[desde,hasta]).then(r=>r.rows[0].d);
const primera=await contexto('08:00','10:00');assert(primera.visitantes.some(e=>e.grado===0));assert(primera.visitantes.some(e=>e.id===uid(101)));
let c=await contexto('10:15','11:40');assert(c.segunda_franja);assert.equal(c.aulas.length,5);assert(!c.visitantes.some(e=>e.grado===0));assert(!c.visitantes.some(e=>e.id===uid(101)||e.id===uid(104)));assert(c.visitantes.some(e=>e.id===uid(102)));
const plan=generarGruposCarrusel(c);const guardar=p=>db.query("select feria_carrusel_guardar('2026-11-06','10:15','11:40',$1,$2,$3)",[p,c.firma,c.version]);
await assert.rejects(guardar({...plan,max_rotaciones:5}),/cuatro rotaciones/);
await assert.rejects(guardar({...plan,minutos:5}),/cuatro rotaciones/);
await guardar(plan);c=await contexto('10:15','11:40');assert.equal(c.plan.max_rotaciones,4);assert.equal(c.plan.grupos.length,5);
const alterado=structuredClone(c.plan),bach=alterado.grupos.find(g=>g.descripcion.startsWith('Bachillerato'));
alterado.grupos.find(g=>g!==bach).estudiantes_ids.push(bach.estudiantes_ids.pop());await assert.rejects(guardar(alterado),/Bachillerato/);
// Simular la actualización desde la versión anterior de cinco minutos.
const anterior=(await db.query("select pg_get_functiondef('public.feria_carrusel_guardar(date,time,time,jsonb,text,integer)'::regprocedure) d")).rows[0].d.replaceAll('veinte minutos','cinco minutos').replace("(datos->>'minutos')::integer is distinct from 20","(datos->>'minutos')::integer is distinct from 5").replace("interval '80 minutes'","interval '20 minutes'");
await db.exec(anterior);
await db.exec("update feria_planes_carrusel set datos=jsonb_set(datos,'{minutos}','5'::jsonb)");
const antes=await contexto('10:15','11:40');
const actualizacion=await readFile('supabase/feria-carrusel-segunda-franja.sql','utf8');await db.exec(actualizacion);await db.exec(actualizacion);
c=await contexto('10:15','11:40');assert.equal(c.plan.minutos,20);assert.deepEqual(c.plan.grupos,antes.plan.grupos);assert.equal(c.version,antes.version+1);
await assert.rejects(guardar({...c.plan,minutos:5}),/cuatro rotaciones/);
await guardar(c.plan);
console.log('PASS segunda franja SQL: preescolar, expositores de segundo, primera franja libre, cinco grupos, guardado y límites');
}finally{await db.close()}
