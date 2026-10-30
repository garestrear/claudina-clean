import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const sql=await readFile('supabase/feria-puentes-inscripcion.sql','utf8');
async function preparar(upgrade=false){
 const f=await crearFeriaDb();const {db}=f;
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete,update on storage.objects to authenticated;`);
 if(upgrade){await db.exec(`create function feria_evaluacion_proyectos() returns jsonb language sql as $$select '[]'::jsonb$$;`);await db.exec(await readFile('supabase/feria-puentes.sql','utf8'));await db.exec(`insert into feria_puentes(id,origen,proyecto_id,categoria,titulo,integrantes,masa_g,largo_cm,ancho_cm,creado_por) values('${uuid(90)}','claudina','${uuid(91)}','puentes_infantil','Anterior','Equipo anterior',10,20,5,'${uid(1)}');insert into feria_puentes_rondas(puente_id,numero,carga_kg,inicio,fin,operador,resultado) values('${uuid(90)}',1,2,now(),now()+interval '5 seconds','${uid(1)}','valida');`)}
 await db.exec(sql);await db.exec(sql);return f;
}
const{db,identity,rpc}=await preparar();
const contexto=()=>rpc('feria_puentes_inscripcion_contexto');
const guardar=(id,datos,version=0,request=crypto.randomUUID())=>rpc('feria_puentes_guardar',[id,datos,version,request],['uuid','jsonb','integer','uuid']);
const base={titulo:'El puente independiente',categoria:'puentes_juvenil',integrantes_ids:[uuid(7),uuid(8)],masa_g:'',foto_path:null};
await identity(null);await db.exec('set role anon');await assert.rejects(contexto,/permission denied/);await db.exec('reset role');
await identity(6);await assert.rejects(contexto,/estudiante activo/);
await identity(5);await assert.rejects(contexto,/estudiante activo/);
await identity(3);await db.exec('set role authenticated');
assert((await contexto()).companeros.some(e=>e.id===uuid(7)));
const otros=await rpc('feria_puentes_estudiantes_grado',[8],['integer']);assert.deepEqual(otros.map(e=>e.id),[uuid(9)]);assert.deepEqual(Object.keys(otros[0]).sort(),['grado','id','nombre']);
const id=uuid(50),req=crypto.randomUUID();let c=await guardar(id,base,0,req);assert.equal(c.puentes.length,1);let p=c.puentes[0];assert.equal(p.proyecto_id,null);assert.equal(p.masa_g,null);assert.equal(p.largo_cm,null);assert.deepEqual(new Set(p.integrantes_ids),new Set([uuid(3),uuid(7),uuid(8)]));assert(p.integrantes.includes('Compañero Séptimo'));assert.equal(p.version,1);
await guardar(id,base,0,req);assert.equal((await contexto()).puentes.length,1);
await assert.rejects(()=>guardar(id,{...base,titulo:'Otro'},0,req),/ya usado/);
await assert.rejects(()=>guardar(id,base,0),/cambió/);
await assert.rejects(()=>guardar(uuid(51),{...base,integrantes_ids:[uuid(10)]}),/activos/);
await assert.rejects(()=>guardar(uuid(51),{...base,integrantes_ids:[uuid(7),uuid(7)]}),/repetir/);
await assert.rejects(()=>guardar(uuid(51),{...base,categoria:'otra'}),/categoría/);
await assert.rejects(()=>guardar(uuid(51),{...base,masa_g:'NaN'}),/peso/);
await assert.rejects(()=>guardar(uuid(51),{...base,foto_path:'ajeno/foto.jpg'}),/foto/);
await assert.rejects(()=>rpc('feria_puentes_contexto'),/Solo docentes/);
await assert.rejects(()=>db.query('select * from feria_puentes'),/permission denied/);
// El integrante escogido ve y puede editar la misma inscripción, sin duplicarla.
await db.exec('reset role');await db.query('update estudiantes set auth_user_id=$1 where id=$2',[uid(8),uuid(8)]);await identity(8);await db.exec('set role authenticated');assert.equal((await contexto()).puentes[0].id,id);
await guardar(id,{...base,integrantes_ids:p.integrantes_ids,titulo:'Editado por el equipo'},1);
await identity(4);assert.equal((await contexto()).puentes.length,0);await assert.rejects(()=>guardar(id,base,2),/Solo el equipo/);
// Fotos privadas, lectura del equipo y docentes; sin sobrescritura ni borrado en uso.
await identity(3);const ruta=`${uid(3)}/${id}/foto.jpg`;
await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['feria-puentes-fotos',ruta]);
await assert.rejects(()=>db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['feria-puentes-fotos',`${uid(4)}/${id}/ajena.jpg`]),/row-level security/);
c=await guardar(id,{...base,integrantes_ids:p.integrantes_ids,foto_path:ruta},2);assert.equal(c.puentes[0].foto_path,ruta);
assert.equal((await db.query('delete from storage.objects where name=$1 returning *',[ruta])).rows.length,0);
assert.equal((await db.query('update storage.objects set name=$1 where name=$2 returning *',['cambiada.jpg',ruta])).rows.length,0);
await identity(4);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
await identity(8);assert.equal((await db.query('select * from storage.objects')).rows.length,1);
// Cualquier docente registra estudiantes de otros grupos y opera sin proyectos.
await identity(2);assert.equal((await contexto()).puentes.length,1);
await assert.rejects(()=>guardar(uuid(52),{...base,integrantes_ids:[]}),/al menos/);
c=await guardar(uuid(52),{...base,titulo:'Registrado por docente',integrantes_ids:[uuid(4),uuid(9)],categoria:'puentes_infantil'});
assert.equal(c.puentes.length,2);await identity(4);assert.equal((await contexto()).puentes[0].id,uuid(52));
await identity(1);let control=await rpc('feria_puentes_contexto');assert(!('proyectos' in control));
const act=async(accion,datos={})=>{control=await rpc('feria_puentes_accion',[accion,datos,control.mesa.version,crypto.randomUUID()],['text','jsonb','integer','uuid']);return control};
await act('configurar',{categoria:'puentes_juvenil',inicial:1,incremento:1,limite:3,separacion:50});await act('seleccionar',{puente_id:id});await assert.rejects(()=>act('iniciar'),/peso/);
await act('medir',{puente_id:id,masa_g:80,largo_cm:'',ancho_cm:'',prediccion_kg:''});await act('iniciar');await assert.rejects(()=>act('validar'),/cinco segundos/);
await identity(3);await assert.rejects(()=>guardar(id,{...base,integrantes_ids:p.integrantes_ids},4),/ya tiene rondas/);assert((await contexto()).puentes[0].bloqueado);
await db.exec('reset role');await db.close();
const upgraded=await preparar(true);await upgraded.identity(1);const old=(await upgraded.rpc('feria_puentes_contexto'));assert.equal(old.puentes[0].id,uuid(90));assert.equal(old.rondas[0].carga_kg,2);await upgraded.db.close();
console.log('PASS inscripción independiente: estudiantes, compañeros de otros grupos, docente sin restricciones de grupo, campos opcionales, permisos, fotos privadas, idempotencia, versiones, mesa y conservación de resultados anteriores');
