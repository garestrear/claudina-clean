import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
await db.exec(`create role anon;create role authenticated;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table perfiles(id uuid primary key,nombre text,rol text);create function public.es_profesor() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='profesor')$$;create table feria_proyectos(id uuid primary key,titulo text,grado integer,estado text);create table feria_proyectos_externos(id uuid primary key,datos jsonb,estado text);`);
await db.query("insert into perfiles values($1,'Docente','profesor'),($2,'Estudiante','estudiante')",[uid(1),uid(2)]);

await db.exec(await readFile('supabase/feria-espacios-programacion.sql','utf8'));
await db.query("select set_config('test.uid',$1,false)",[uid(1)]);
const aulas=(await db.query("select id from feria_espacios order by orden,nombre limit 2")).rows;
await db.exec('update feria_espacios set cupos=20');
for(let n=10;n<16;n++)await db.query("insert into feria_proyectos values($1,$2,6,'aprobado')",[uid(n),'Proyecto '+n]);
await db.query("insert into feria_proyectos_externos values($1,$2,'aprobado')",[uid(20),{titulo:'Invitado'}]);
const crear=(n,aula,puesto='',inicio='08:00',fin='10:00',externo=false)=>db.query('select feria_programacion_guardar($1,$2,0)',[uid(n+100),{tipo:'proyecto',origen:externo?'invitados':'claudina',proyecto_id:uid(n),titulo:'Proyecto '+n,espacio_id:aula,fecha:'2026-11-06',inicio,fin,puesto}]);
await crear(10,aulas[0].id,'Mesa 2');await crear(11,aulas[0].id);await crear(12,aulas[0].id);await crear(20,aulas[0].id,'', '08:00','10:00',true);
const sql=await readFile('supabase/feria-puestos-automaticos.sql','utf8');await db.exec(sql);
const leer=async n=>(await db.query('select * from feria_programacion where id=$1',[uid(n+100)])).rows[0];
assert.equal((await leer(10)).puesto,'Mesa 2');assert.equal((await leer(10)).puesto_automatico,false);
assert.deepEqual((await Promise.all([11,12,20].map(leer))).map(r=>r.puesto),['Mesa 1','Mesa 3','Mesa 4']);
const antes=await leer(11);await db.exec(sql);assert.equal((await leer(11)).version,antes.version);
await crear(13,aulas[0].id,'','10:00','11:00');assert.equal((await leer(13)).puesto,'Mesa 1','Reutiliza mesa sin cruce horario');
await crear(14,aulas[1].id);assert.equal((await leer(14)).puesto,'Mesa 1');
let r=await leer(11);
await db.query('select feria_programacion_guardar($1,$2,$3)',[r.id,{...r,espacio_id:aulas[1].id},r.version]);
assert.equal((await leer(11)).puesto,'Mesa 2','Renumerar al mover al aula con mesa ocupada');
r=await leer(11);await db.query('select feria_programacion_guardar($1,$2,$3)',[r.id,{...r,puesto:'Ventana'},r.version]);
assert.equal((await leer(11)).puesto_automatico,false);
r=await leer(11);await db.query('select feria_programacion_guardar($1,$2,$3)',[r.id,{...r,espacio_id:aulas[0].id},r.version]);assert.equal((await leer(11)).puesto,'Ventana');
await assert.rejects(crear(15,aulas[0].id,'Mesa 2'),/ya está ocupado/);
await db.exec(await readFile('supabase/feria-asignacion-automatica.sql','utf8'));
await db.query("insert into feria_proyectos values($1,'Nuevo aprobado',6,'aprobado')",[uid(30)]);
assert.match((await db.query('select puesto from feria_programacion where proyecto_id=$1',[uid(30)])).rows[0].puesto,/^Mesa \d+$/);

const fix=await readFile('supabase/feria-liberar-puestos.sql','utf8');
// Dos proyectos homónimos en lugares diferentes; uno rechazado antes de instalar.
await db.query("update feria_proyectos set titulo='Barco Solar' where id=any($1::uuid[])",[[uid(10),uid(14)]]);
await db.query("update feria_proyectos set estado='rechazado' where id=$1",[uid(10)]);
await db.exec(fix);
assert.equal((await leer(10)).activo,false);
assert.equal((await leer(14)).activo,true);
assert.match((await leer(14)).puesto,/^Puesto /);
assert.equal((await leer(11)).puesto,'Ventana');
const version=(await leer(14)).version;await db.exec(fix);assert.equal((await leer(14)).version,version);
// Rechazar el otro homónimo libera únicamente su ubicación.
await db.query("update feria_proyectos set estado='rechazado' where id=$1",[uid(14)]);
assert.equal((await leer(14)).activo,false);
assert.equal((await leer(12)).activo,true);
// Reaprobar genera una ubicación vigente y conserva la anterior cancelada.
await db.query("update feria_proyectos set estado='aprobado' where id=$1",[uid(14)]);
assert.equal((await db.query('select count(*)::int n from feria_programacion where proyecto_id=$1 and activo',[uid(14)])).rows[0].n,1);
await db.query("update feria_proyectos set titulo='Barco Solar corregido' where id=$1",[uid(14)]);
assert.equal((await db.query('select titulo from feria_programacion where proyecto_id=$1 and activo',[uid(14)])).rows[0].titulo,'Barco Solar corregido');
// Invitados también liberan cupo y las actividades independientes permanecen.
await db.query("update feria_proyectos_externos set estado='rechazado' where id=$1",[uid(20)]);
assert.equal((await leer(20)).activo,false);
await crear(15,aulas[0].id,'Mesa 1A');assert.equal((await leer(15)).puesto,'Mesa 1A');
await db.exec(fix);assert.equal((await leer(15)).puesto,'Mesa 1A');
await db.query("insert into feria_proyectos values($1,'Nuevo puesto',6,'aprobado')",[uid(40)]);
assert.match((await db.query('select puesto from feria_programacion where proyecto_id=$1 and activo',[uid(40)])).rows[0].puesto,/^Puesto /);
await db.query('delete from feria_proyectos where id=$1',[uid(40)]);
assert.equal((await db.query('select count(*)::int n from feria_programacion where proyecto_id=$1 and activo',[uid(40)])).rows[0].n,0);
console.log('PASS liberar reservas: homónimos, rechazados históricos/nuevos, reaprobar, invitados, títulos, puestos y etiquetas personalizadas');await db.close();
