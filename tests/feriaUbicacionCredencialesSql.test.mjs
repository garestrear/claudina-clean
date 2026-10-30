import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
const{db,identity,rpc}=await crearFeriaDb();await db.exec('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create schema storage;create table storage.objects(id int);alter table storage.objects enable row level security;');
for(const f of ['feria-invitados','feria-rechazar','feria-jurados','feria-poster','feria-edicion-equipos','feria-familias-estados','feria-participantes-certificados','feria-espacios-programacion'])await db.exec(await readFile(`supabase/${f}.sql`,'utf8'));
let n=2000;const datos={titulo:'Proyecto de lluvia',integrantes:'',propuesta:'Explorar',procedimiento:'Medir',materiales:'',resultados_esperados:'',bibliografia:'',apoyo:'',areas:['science'],asesor_id:uid(1),integrantes_ids:[uuid(7)]};
async function crear(id){await identity(3);await rpc('feria_guardar',[uuid(id),datos,0,true,uuid(n++)],['uuid','jsonb','integer','boolean','uuid']);await identity(1)}
async function aprobar(id){return rpc('feria_revisar',[uuid(id),1,'aprobado','',uuid(n++)],['uuid','integer','text','text','uuid'])}
await crear(800);await aprobar(800);
const sql=await readFile('supabase/feria-ubicacion-credenciales.sql','utf8');await db.exec(sql);await db.exec(sql);
let p=(await rpc('feria_placas_contexto')).placas[0];assert.deepEqual(p.ubicaciones,[]);
let asegurar=()=>rpc('feria_asegurar_ubicacion_proyecto',['claudina',uuid(800)],['text','uuid']);assert.equal((await asegurar()).asignado,false);
await db.exec("update feria_espacios set tipo='otro',cupos=4 where codigo='salon-1'");const aula=(await rpc('feria_espacios_contexto')).espacios.find(a=>a.codigo==='salon-1');
await rpc('feria_programacion_guardar',[uuid(901),{tipo:'actividad',espacio_id:aula.id,fecha:'2026-11-06',inicio:'07:30',fin:'08:00',titulo:'Apertura',exclusivo:true},0],['uuid','jsonb','integer']);
await db.exec(sql); // repairs approved-before-install project; opening no longer blocks it.
p=(await rpc('feria_placas_contexto')).placas[0];assert.equal(p.ubicaciones[0].espacio_nombre,aula.nombre);assert.equal(p.ubicaciones[0].inicio,'08:00:00');assert.equal(p.ubicaciones[0].fin,'10:00:00');
const personas=(await rpc('feria_participantes_contexto')).participantes;assert(personas.length);assert(personas.every(p=>p.ubicaciones[0].espacio_nombre===aula.nombre));
const reserva=(await rpc('feria_espacios_contexto')).programacion.find(r=>r.proyecto_id===uuid(800));const destino=(await rpc('feria_espacios_contexto')).espacios.find(a=>a.codigo==='salon-2');
await rpc('feria_programacion_guardar',[reserva.id,{...reserva,espacio_id:destino.id},reserva.version],['uuid','jsonb','integer']);await db.exec(sql);
assert.equal((await asegurar()).ubicaciones[0].espacio_nombre,destino.nombre);assert.equal((await rpc('feria_participantes_contexto')).participantes[0].ubicaciones[0].espacio_nombre,destino.nombre);
await identity(3);assert.equal((await rpc('feria_placas_contexto')).placas[0].ubicaciones[0].espacio_nombre,destino.nombre);await assert.rejects(asegurar(),/Solo docentes/);
await identity(4);assert.equal((await rpc('feria_placas_contexto')).placas.length,0);assert.equal((await rpc('feria_participantes_contexto')).participantes.length,0);
await identity(1);await db.exec('update feria_espacios set cupos=1');await crear(801);await assert.rejects(aprobar(801),/No se pudo aprobar y asignar/);assert.equal((await db.query('select estado from feria_proyectos where id=$1',[uuid(801)])).rows[0].estado,'enviado');
// Agenda-defined interval is respected without requiring the agenda module to install first.
await db.exec("create table feria_agenda_general(codigo text,fecha date,inicio time,fin time,reserva_id uuid);insert into feria_agenda_general values('exposiciones','2026-11-06','09:00','10:00',null);update feria_espacios set cupos=4 where codigo='salon-1'");
await aprobar(801);const nueva=(await rpc('feria_placas_contexto')).placas.find(p=>p.proyecto_id===uuid(801));assert.equal(nueva.ubicaciones[0].inicio,'09:00:00');
await db.exec('set role authenticated');await assert.rejects(db.query("select feria_ubicaciones_proyecto('claudina',$1)",[uuid(800)]),/permission denied/);await db.exec('reset role');
await db.close();console.log('PASS ubicación: reparación repetible, espacios compartidos de otro tipo, horario real, aprobación atómica, aula viva en placas/escarapelas y permisos');
