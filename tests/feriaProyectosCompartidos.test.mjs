import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
const {db,identity,rpc}=await crearFeriaDb();
try {
 await db.query(`insert into perfiles values($1,'Integrante','estudiante'),($2,'Acudiente integrante','acudiente')`,[uid(7),uid(17)]);
 await db.query('update estudiantes set auth_user_id=$1 where id=$2',[uid(7),uuid(7)]);
 await db.query('insert into acudientes values($1,$2)',[uid(17),uuid(7)]);
 const datos={titulo:'Equipo STEAM',integrantes:'',propuesta:'Explorar',procedimiento:'Medir',materiales:'',resultados_esperados:'',apoyo:'',areas:['science'],asesor_id:uid(1),integrantes_ids:[uuid(7)]};
 const save=(d,v,enviar,n)=>rpc('feria_guardar',[uuid(800),d,v,enviar,uuid(n)],['uuid','jsonb','integer','boolean','uuid']);
 await identity(3);await save(datos,0,false,900);
 // La migración es repetible y permite consultar proyectos inscritos antes de ejecutarla.
 const sql=await readFile(new URL('../supabase/feria-proyectos-compartidos.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
 for(const actor of [7,17]){
  await identity(actor);await db.exec('set role authenticated');
  assert.equal((await rpc('feria_contexto')).proyectos[0].id,uuid(800));
  const p=await rpc('feria_proyecto',[uuid(800)],['uuid']);assert.equal(p.puede_editar,false);assert.equal(p.proyecto.estado,'borrador');
  await assert.rejects(save(datos,1,true,901));await db.exec('reset role');
 }
 await identity(4);assert.equal((await rpc('feria_contexto')).proyectos.length,0);await assert.rejects(rpc('feria_proyecto',[uuid(800)],['uuid']));
 await identity(1);assert.equal((await rpc('feria_contexto')).proyectos.length,0);
 await identity(3);assert.equal((await rpc('feria_proyecto',[uuid(800)],['uuid'])).puede_editar,true);await save(datos,1,true,902);
 await identity(1);await rpc('feria_revisar',[uuid(800),2,'ajustes','Completar medidas',uuid(903)],['uuid','integer','text','text','uuid']);
 await identity(7);assert.equal((await rpc('feria_proyecto',[uuid(800)],['uuid'])).revisiones[0].observacion,'Completar medidas');
 await identity(3);await save({...datos,integrantes_ids:[]},3,true,904);
 for(const actor of [7,17]){await identity(actor);assert.equal((await rpc('feria_contexto')).proyectos.length,0);await assert.rejects(rpc('feria_proyecto',[uuid(800)],['uuid']));}
 await identity(0);await assert.rejects(rpc('feria_contexto'));await assert.rejects(rpc('feria_proyecto',[uuid(800)],['uuid']));
 console.log('PASS: integrantes y acudientes ven inscripción y revisiones, sin duplicados; edición del responsable, terceros excluidos y acceso revocado al quitar integrante');
}finally{await db.close()}
