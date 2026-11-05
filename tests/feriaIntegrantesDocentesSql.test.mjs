import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{crearFeriaDb,uid,uuid}from'./fixtures/feriaDb.mjs';
const{db,identity,rpc}=await crearFeriaDb();
await db.exec("create role service_role;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text);create schema storage;create table storage.objects(id int);alter table storage.objects enable row level security;");
for(const f of ['feria-invitados','feria-rechazar','feria-jurados','feria-poster','feria-edicion-equipos','feria-familias-estados','feria-rechazados-solo-lectura','feria-correcciones-docentes'])await db.exec(await readFile('supabase/'+f+'.sql','utf8'));
await db.exec(await readFile('supabase/mejoras-feria-accesos.sql','utf8'));
await db.exec(await readFile('supabase/mejoras-feria-accesos.sql','utf8'));
try{
for(const f of ['feria-cierre-inscripciones','feria-integrantes-docentes','feria-integrantes-docentes'])await db.exec(await readFile('supabase/'+f+'.sql','utf8'));
await identity(3);
await rpc('feria_guardar',[uuid(800),{titulo:'Equipo de prueba',propuesta:'Explorar',procedimiento:'Medir',materiales:'',resultados_esperados:'',apoyo:'',areas:['science'],asesor_id:uid(1),integrantes_ids:[uuid(7)]},0,true,uuid(900)],['uuid','jsonb','integer','boolean','uuid']);
const cambiar=(equipo,v=1,s=uuid(901))=>rpc('feria_docente_integrantes',[uuid(800),equipo,v,s],['uuid','uuid[]','integer','uuid']);
await assert.rejects(cambiar([uuid(8)]),/Solo los docentes/);
await identity(1);await rpc('feria_inscripciones_configurar',[true,null],['boolean','timestamptz']);
await assert.rejects(cambiar([]),/Selecciona/);
await assert.rejects(cambiar([uuid(6)]),/activos/);
let ctx=await cambiar([uuid(3),uuid(8),uuid(8)]);
assert.deepEqual(ctx.proyecto.integrantes_ids,[uuid(3),uuid(8)]);assert.equal(ctx.proyecto.version,2);assert.equal(ctx.proyecto.estado,'enviado');assert.equal(ctx.proyecto.asesor_id,uid(1));assert.match(ctx.proyecto.integrantes,/Séptimo/);assert.doesNotMatch(ctx.proyecto.integrantes,/Compañero Sexto/);
await cambiar([uuid(3),uuid(8)]);assert.equal((await db.query('select count(*)::int n from feria_correcciones_docentes')).rows[0].n,1);
await assert.rejects(cambiar([uuid(9)],1,uuid(902)),/cambió/);
ctx=await cambiar([uuid(8)],2,uuid(903));assert.deepEqual(ctx.proyecto.integrantes_ids,[uuid(8)]);
assert.equal((await db.query('select estudiante_id from feria_proyectos where id=$1',[uuid(800)])).rows[0].estudiante_id,uuid(3));
console.log('PASS integrantes docentes: altas y bajas entre grados, cierre, permisos, versiones e historial');
}finally{await db.close()}
