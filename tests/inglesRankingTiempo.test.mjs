import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 const fixture=await readFile(new URL('./inglesSql.test.mjs',import.meta.url),'utf8');
 await db.exec(fixture.split('await db.exec(`')[1].split('`);')[0]);
 await db.exec(await readFile(new URL('../supabase/ingles-musica.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../supabase/ingles-ranking-tiempo.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
 const token=n=>'20000000-0000-0000-0000-'+String(n).padStart(12,'0');
 const identity=async n=>db.query("select set_config('test.uid',$1,false)",[n?uid(n):'']);
 const start=n=>db.query("select ingles_iniciar_intento('lemon-tree',$1)",[token(n)]);
 const words=['room','time','waiting','car','waiting','wonder','lemon tree'];
 const answers=Object.fromEntries(words.map((w,i)=>[i+1,w]));
 const respond=async(n,a=answers)=>(await db.query("select ingles_responder('lemon-tree',$1::jsonb,$2) value",[a,token(n)])).rows[0].value;
 const list=async(name='ingles_clasificacion')=>(await db.query(`select ${name}('lemon-tree') value`)).rows[0].value;
 for(const n of [0,1,3,4]){await identity(n);await assert.rejects(start(n));await assert.rejects(list());}
 await identity(2);await start(2);
 const initial=(await db.query('select iniciada_at from ingles_intentos_tiempo')).rows[0].iniciada_at;
 await start(2);assert.deepEqual((await db.query('select iniciada_at from ingles_intentos_tiempo')).rows[0].iniciada_at,initial,'reanudar no reinicia el reloj');
 await db.query("update ingles_intentos_tiempo set iniciada_at=clock_timestamp()-interval '120 seconds' where solicitud_id=$1",[token(2)]);
 let result=await respond(2);assert.ok(result.mejor_tiempo_segundos>=120);assert.ok(result.mejor_logrado_at);assert.equal(result.intentos,1);
 const duration=result.mejor_tiempo_segundos;
 result=await respond(2);assert.equal(result.intentos,1);assert.equal(result.mejor_tiempo_segundos,duration,'reintento de red idempotente');
 await start(20);await respond(20,{...answers,1:'wrong'});
 result=(await db.query('select * from ingles_progreso')).rows[0];assert.equal(Number(result.mejor_tiempo_segundos),duration,'un resultado inferior no reemplaza el tiempo del mejor');
 await assert.rejects(respond(2),'no se reutiliza una sesión ya finalizada');
 await start(21);result=await respond(21);assert.equal(result.intentos,3);assert.ok(result.mejor_tiempo_segundos<duration,'a igual máximo se conserva el intento más rápido');
 await identity(5);await assert.rejects(start(21),'otro alumno no puede reutilizar la sesión');
 // Twelve participants, including historical results with no measured time.
 for(let n=10;n<22;n++){
  await db.query('insert into perfiles values($1,$2)',[uid(n),'estudiante']);
  await db.query('insert into estudiantes values($1,$2,6,true,$3)',['10000000-0000-0000-0000-'+String(n).padStart(12,'0'),'Alumno '+n,uid(n)]);
  await identity(n);await respond(n+100);
 }
 await db.exec("update ingles_progreso set intentos=1,mejor_tiempo_segundos=60,mejor_logrado_at='2026-01-01 12:00:00+00'");
 await db.query('update ingles_progreso set mejor_aciertos=6 where usuario_id=$1',[uid(10)]);
 await db.query('update ingles_progreso set intentos=2 where usuario_id=$1',[uid(11)]);
 await db.query('update ingles_progreso set mejor_tiempo_segundos=90 where usuario_id=$1',[uid(12)]);
 await db.query("update ingles_progreso set mejor_logrado_at='2026-01-02 12:00:00+00' where usuario_id=$1",[uid(13)]);
 await db.query('update ingles_progreso set mejor_tiempo_segundos=null,mejor_logrado_at=null where usuario_id=$1',[uid(14)]);
 await identity(2);const top=await list();assert.equal(top.length,10);assert.deepEqual(top.map(r=>r.puesto),[1,2,3,4,5,6,7,8,9,10]);
 assert.ok(top.every(r=>r.puntos===100));
 assert.ok(!JSON.stringify(top).includes('respuestas'));assert.ok(!JSON.stringify(top).includes('usuario_id'));
 await identity(1);const all=await list('ingles_resultados');assert.equal(all.length,13);
 assert.deepEqual(all.slice(-5).map(r=>r.nombre),['Alumno 13','Alumno 12','Alumno 14','Alumno 11','Alumno 10']);
 assert.equal(all.at(-1).puntos,85.71);
 await identity(2);await db.exec('set role authenticated');await assert.rejects(db.query("select ingles_tabla_clasificacion('lemon-tree')"));await assert.rejects(db.query('select * from ingles_intentos_tiempo'));await db.exec('reset role');
 await db.exec("update ingles_actividades set publicada=false where id='lemon-tree'");await assert.rejects(list());
 console.log('PASS: tiempo del servidor, recarga sin reinicio, idempotencia, mejor intento, orden puntos/intentos/tiempo/fecha, top 10 en servidor, lista docente completa y permisos');
}finally{await db.close()}
