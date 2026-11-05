import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
const{db,identity,rpc}=await crearFeriaDb();await db.exec('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create schema storage;create table storage.objects(id int);alter table storage.objects enable row level security;');
for(const f of ['feria-invitados','feria-rechazar','feria-jurados','feria-poster','feria-edicion-equipos','feria-familias-estados','feria-participantes-certificados','feria-espacios-programacion'])await db.exec(await readFile(`supabase/${f}.sql`,'utf8'));
let n=2000;const datos={titulo:'Proyecto de lluvia',integrantes:'',propuesta:'Explorar',procedimiento:'Medir',materiales:'',resultados_esperados:'',bibliografia:'',apoyo:'',areas:['science'],asesor_id:uid(1),integrantes_ids:[uuid(7)]};
async function crear(id){await identity(3);await rpc('feria_guardar',[uuid(id),datos,0,true,uuid(n++)],['uuid','jsonb','integer','boolean','uuid']);await identity(1)}
async function aprobar(id){return rpc('feria_revisar',[uuid(id),1,'aprobado','',uuid(n++)],['uuid','integer','text','text','uuid'])}
try{
await crear(800);await aprobar(800);
const saliente=(await rpc('feria_participantes_contexto')).participantes.find(p=>p.estudiante_id===uuid(7)&&p.proyecto_id===uuid(800));
await rpc('feria_certificado_emitir',[saliente.id,true],['uuid','boolean']);
const migration=await readFile('supabase/feria-escarapelas-integrantes.sql','utf8');
// Simular un equipo que ya cambió antes de instalar la corrección.
await db.query('update feria_proyectos set integrantes_ids=$1 where id=$2',[[uuid(8)],uuid(800)]);
await db.exec(migration);await db.exec(migration);
const personas=async()=>(await rpc('feria_participantes_contexto')).participantes.filter(p=>p.proyecto_id===uuid(800));
let p=await personas();assert(p.find(c=>c.estudiante_id===uuid(8)).habilitado);assert(!p.find(c=>c.estudiante_id===uuid(7)).activo);
assert(p.find(c=>c.estudiante_id===uuid(7)).certificado);
const folio=p.find(c=>c.estudiante_id===uuid(7)).folio;
await db.query('update feria_proyectos set integrantes_ids=$1 where id=$2',[[uuid(7)],uuid(800)]);
p=await personas();assert(p.find(c=>c.estudiante_id===uuid(7)).activo);assert.equal(p.find(c=>c.estudiante_id===uuid(7)).folio,folio);assert(!p.find(c=>c.estudiante_id===uuid(8)).activo);
await db.query("update estudiantes set activo=false where id=$1",[uuid(7)]);assert(!(await personas()).find(c=>c.estudiante_id===uuid(7)).activo);
await db.query("update estudiantes set activo=true where id=$1",[uuid(7)]);assert((await personas()).find(c=>c.estudiante_id===uuid(7)).activo);
await db.query("update feria_proyectos set estado='enviado' where id=$1",[uuid(800)]);assert((await personas()).every(c=>!c.activo));
await db.query("update feria_proyectos set estado='aprobado' where id=$1",[uuid(800)]);assert.equal((await personas()).filter(c=>c.activo).length,2);
// Cambiar al responsable también reconcilia la antigua escarapela.
await db.query('update feria_proyectos set estudiante_id=$1 where id=$2',[uuid(9),uuid(800)]);p=await personas();assert(!p.find(c=>c.estudiante_id===uuid(3)).activo);assert(p.find(c=>c.estudiante_id===uuid(9)).activo);
const before=(await personas()).map(c=>[c.id,c.folio,c.activo]);await rpc('feria_actualizar_escarapelas_integrantes');assert.deepEqual((await personas()).map(c=>[c.id,c.folio,c.activo]),before);
await rpc('feria_participante_guardar',[uuid(950),{tipo:'expositor',nombre:'Adulto invitado',proyecto_origen:'claudina',proyecto_id:uuid(800),activo:true}],['uuid','jsonb']);
await db.query("update feria_proyectos set titulo='[Emprendimiento familiar] Familia' where id=$1",[uuid(800)]);p=await personas();assert(p.filter(c=>c.automatico).every(c=>!c.activo));assert(p.find(c=>c.id===uuid(950)).activo);
await identity(3);await assert.rejects(rpc('feria_actualizar_escarapelas_integrantes'),/Solo docentes/);
console.log('PASS sincronización: equipos antiguos, altas, bajas, reingreso sin duplicados, responsable, estado, familias, estudiantes activos y permisos');
}finally{await db.close()}
