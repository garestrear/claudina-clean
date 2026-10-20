import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite();
try{
 const source=await readFile(new URL('./inglesSql.test.mjs',import.meta.url),'utf8');
 await db.exec(source.split('await db.exec(`')[1].split('`);')[0]);
 await db.exec(await readFile(new URL('../supabase/ingles-musica.sql',import.meta.url),'utf8'));
 const migration=await readFile(new URL('../supabase/ingles-clasificacion.sql',import.meta.url),'utf8');
 await db.exec(migration);await db.exec(migration);
 const identity=async n=>db.query("select set_config('test.uid',$1,false)",[n?'00000000-0000-0000-0000-'+String(n).padStart(12,'0'):'']);
 const ranking=async()=> (await db.query("select ingles_clasificacion('lemon-tree') value")).rows[0].value;
 for(const n of [0,1,3,4]){await identity(n);await assert.rejects(ranking());}
 const words=['room','time','waiting','car','waiting','wonder','lemon tree'];
 for(const n of [2,5,6]){
  await identity(n);const answers=Object.fromEntries(words.map((w,i)=>[i+1,n===6&&i===0?'wrong':w]));
  await db.query("select ingles_responder('lemon-tree',$1::jsonb,$2::uuid)",[answers,'20000000-0000-0000-0000-'+String(n).padStart(12,'0')]);
 }
 await identity(2);let rows=await ranking();
 assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.puesto),[1,1,2]);
 assert.deepEqual(Object.keys(rows[0]).sort(),['id','nombre','grado','intentos','aciertos','total','mejor_aciertos','puesto'].sort());
 await db.exec("update estudiantes set activo=false where grado=7");
 rows=await ranking();assert.equal(rows.length,2);
 await identity(5);await assert.rejects(ranking());
 await identity(2);await db.exec("set role authenticated");
 assert.equal((await ranking()).length,2);await assert.rejects(db.query('select respuestas from ingles_progreso'));
 await db.exec('reset role');await db.exec("update ingles_actividades set publicada=false where id='lemon-tree'");
 await assert.rejects(ranking());
 console.log('PASS: clasificación por mejor puntaje, empates, múltiples grados, sin respuestas privadas, anónimos/acudientes/inactivos/grados ajenos y actividades cerradas bloqueados');
}finally{await db.close()}
