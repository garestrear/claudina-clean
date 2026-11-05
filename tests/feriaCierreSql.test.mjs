import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
const{db,identity,rpc}=await crearFeriaDb();
try{
 const sql=await readFile('supabase/feria-cierre-inscripciones.sql','utf8');await db.exec(sql);await db.exec(sql);
 await identity(3);
 const guardar=id=>rpc('feria_guardar',[uuid(id),{titulo:'Proyecto de prueba',integrantes:'Equipo',integrantes_ids:[],materiales:'',resultados_esperados:'',apoyo:'',propuesta:'Investigar',procedimiento:'Medir',areas:['science'],asesor_id:uid(1)},0,false,uuid(id+100)],['uuid','jsonb','integer','boolean','uuid']);
 await guardar(800);
 await assert.rejects(rpc('feria_inscripciones_configurar',[true,null],['boolean','timestamptz']),/Solo los docentes/);
 await identity(1);await rpc('feria_inscripciones_configurar',[true,null],['boolean','timestamptz']);
 await identity(3);assert.equal((await rpc('feria_inscripciones_estado')).abierta,false);
 await assert.rejects(guardar(801),/cerradas/);
 await assert.rejects(db.query('update feria_proyectos set titulo=$1 where id=$2',['Cambio',uuid(800)]),/cerradas/);
 await assert.rejects(db.query('delete from feria_proyectos where id=$1',[uuid(800)]),/cerradas/);
 await identity(5);await assert.rejects(guardar(802),/cerradas|vinculado/);
 await identity(1);await db.query('update feria_proyectos set titulo=$1 where id=$2',['Cambio docente',uuid(800)]);
 await rpc('feria_inscripciones_configurar',[false,'2020-01-01T00:00:00Z'],['boolean','timestamptz']);
 await identity(3);await assert.rejects(guardar(803),/cerradas/);
 await identity(1);await rpc('feria_inscripciones_configurar',[false,null],['boolean','timestamptz']);
 await identity(3);await guardar(804);
 console.log('PASS cierre manual, fecha límite, reapertura, permisos y bloqueo de escrituras');
}finally{await db.close()}
