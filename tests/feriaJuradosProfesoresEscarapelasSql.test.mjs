import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
const{db,identity,rpc}=await crearFeriaDb();await db.exec('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create schema storage;create table storage.objects(id int);alter table storage.objects enable row level security;');
for(const f of ['feria-invitados','feria-rechazar','feria-jurados','feria-poster','feria-edicion-equipos','feria-familias-estados','feria-participantes-certificados','feria-espacios-programacion'])await db.exec(await readFile(`supabase/${f}.sql`,'utf8'));
let n=2000;const datos={titulo:'Proyecto de lluvia',integrantes:'',propuesta:'Explorar',procedimiento:'Medir',materiales:'',resultados_esperados:'',bibliografia:'',apoyo:'',areas:['science'],asesor_id:uid(1),integrantes_ids:[uuid(7)]};
async function crear(id){await identity(3);await rpc('feria_guardar',[uuid(id),datos,0,true,uuid(n++)],['uuid','jsonb','integer','boolean','uuid']);await identity(1)}
async function aprobar(id){return rpc('feria_revisar',[uuid(id),1,'aprobado','',uuid(n++)],['uuid','integer','text','text','uuid'])}
try{
await crear(800);await aprobar(800);
await db.exec(await readFile('supabase/feria-ubicacion-credenciales.sql','utf8'));
await db.query("update feria_proyectos set titulo='Weather Scientists: Análisis climático y prevención de riesgos.',areas=array['emprendimiento','science'] where id=$1",[uuid(800)]);
await rpc('feria_placa_cambiar_categoria',['claudina',uuid(800),'emprendimiento'],['text','uuid','text']);
await db.exec("update feria_espacios set cupos=20 where codigo='salon-1'");
await crear(801);await aprobar(801);
await db.query("update feria_proyectos set titulo='[Emprendimiento familiar] Abono familiar' where id=$1",[uuid(801)]);
await rpc('feria_participante_guardar',[uuid(950),{tipo:'expositor',nombre:'Mamá participante',proyecto_origen:'claudina',proyecto_id:uuid(801),activo:true}],['uuid','jsonb']);
let participantes=(await rpc('feria_participantes_contexto')).participantes;assert(participantes.some(p=>p.proyecto_id===uuid(801)&&p.automatico&&p.habilitado));
const migracion=await readFile('supabase/feria-escarapelas-jurados-profesores.sql','utf8');await db.exec(migracion);await db.exec(migracion);
participantes=(await rpc('feria_participantes_contexto')).participantes;
const weather=participantes.filter(p=>p.proyecto_id===uuid(800));assert(weather.every(p=>p.categoria==='stem'&&p.proyecto_codigo.startsWith('STEM-')&&p.habilitado));
assert(!participantes.some(p=>p.proyecto_id===uuid(801)&&p.automatico&&(p.activo||p.habilitado)));
assert(participantes.find(p=>p.id===uuid(950)).habilitado);
await db.exec("update feria_espacios set cupos=20 where codigo='salon-1'");
await rpc('feria_asegurar_ubicacion_proyecto',['claudina',uuid(800)],['text','uuid']);
const reserva=(await db.query('select id from feria_programacion where proyecto_id=$1 and activo',[uuid(800)])).rows[0];
await db.query("update feria_programacion set puesto='Puesto 3' where id=$1",[reserva.id]);
participantes=(await rpc('feria_participantes_contexto')).participantes;assert.equal(participantes.find(p=>p.proyecto_id===uuid(800)).ubicaciones[0].puesto,'Puesto 3');
await crear(802);await db.query("update feria_proyectos set titulo='[Emprendimiento familiar] Nuevo emprendimiento' where id=$1",[uuid(802)]);await aprobar(802);
assert.equal((await db.query('select count(*)::int n from feria_participantes where proyecto_id=$1 and automatico',[uuid(802)])).rows[0].n,0);
await db.query("insert into feria_jurados(id,nombre,institucion,profesion,correo,telefono) values($1,'Isabel Osorio','Artes','Artista','isabel@example.com','3210000000')",[uuid(990)]);
await rpc('feria_participante_guardar',[uuid(991),{tipo:'evaluador',nombre:'Isabel Osorio',institucion:'Artes',detalle:'Artista',activo:true}],['uuid','jsonb']);
let sync=await rpc('feria_sincronizar_jurados_profesores');
assert.equal(sync.participantes.filter(p=>p.jurado_id===uuid(990)).length,1);assert.equal(sync.participantes.find(p=>p.jurado_id===uuid(990)).id,uuid(991));
const profesores=(await db.query("select id from perfiles where rol='profesor' and length(trim(nombre))>=2")).rows;
assert.equal(sync.participantes.filter(p=>p.tipo==='profesor'&&p.profesor_id).length,profesores.length);
const ids=sync.participantes.map(p=>p.id).sort();sync=await rpc('feria_sincronizar_jurados_profesores');assert.deepEqual(sync.participantes.map(p=>p.id).sort(),ids);
await rpc('feria_participante_guardar',[uuid(992),{tipo:'profesor',nombre:'Profesora invitada',activo:true}],['uuid','jsonb']);
await identity(3);await assert.rejects(rpc('feria_sincronizar_jurados_profesores'),/Solo docentes/);
console.log('PASS jurados y profesores: incorporación sin duplicados, registro manual y permisos');
console.log('PASS escarapelas: Weather STEM, sin estudiantes automáticos familiares, adultos conservados y salón/puesto vivos');
}finally{await db.close()}
