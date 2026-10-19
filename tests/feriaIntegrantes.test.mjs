import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
const{db,identity,rpc}=await crearFeriaDb();const datos={titulo:'Proyecto con compañeros',integrantes:'Nombre inventado',propuesta:'Explorar',procedimiento:'Probar',materiales:'',resultados_esperados:'',apoyo:'',areas:['science'],asesor_id:uid(1),integrantes_ids:[uuid(7)]};
await identity(3);let ctx=await rpc('feria_contexto');assert.deepEqual(ctx.companeros.map(e=>e.id),[uuid(7)]);assert.deepEqual(Object.keys(ctx.companeros[0]).sort(),['grado','id','nombre']);
const guardar=(d=datos,v=0,n=1)=>rpc('feria_guardar',[uuid(500),d,v,true,uuid(600+n)],['uuid','jsonb','integer','boolean','uuid']);
for(const integrantes_ids of [[uuid(4)],[uuid(8)],[uuid(10)],[uuid(999)],[uuid(7),uuid(7)],[null],['invalido'],{},null])await assert.rejects(guardar({...datos,integrantes_ids}));
const sinIds={...datos};delete sinIds.integrantes_ids;await assert.rejects(guardar(sinIds));
let p=await guardar();assert.deepEqual(p.proyecto.integrantes_ids,[uuid(3),uuid(7)]);assert.match(p.proyecto.integrantes,/Estudiante Sexto/);assert.match(p.proyecto.integrantes,/Compañero Sexto/);assert.ok(!p.proyecto.integrantes.includes('Nombre inventado'));
p=await guardar({...datos,integrantes_ids:[]},1,2);assert.deepEqual(p.proyecto.integrantes_ids,[uuid(3)],'proyecto individual incluye a quien registra');
await identity(4);ctx=await rpc('feria_contexto');assert.deepEqual(ctx.companeros,[],'TS/JR no recibe otros grados');
await db.query('update public.estudiantes set grado=7 where id=$1',[uuid(4)]);ctx=await rpc('feria_contexto');assert.deepEqual(new Set(ctx.companeros.map(e=>e.id)),new Set([uuid(8),uuid(9)]),'7 y 8 comparten grupo');
const compartido=await rpc('feria_guardar',[uuid(501),{...datos,integrantes_ids:[uuid(8),uuid(9)]},0,true,uuid(610)],['uuid','jsonb','integer','boolean','uuid']);assert.equal(compartido.proyecto.integrantes_ids.length,3);
await identity(1);assert.deepEqual((await rpc('feria_contexto')).companeros,[]);await assert.rejects(guardar());await identity(5);await assert.rejects(rpc('feria_contexto'));
// Actualizar una base anterior conserva los nombres escritos y el historial.
await identity(3);await db.exec('alter table public.feria_proyectos drop column integrantes_ids;');const textoAntes=(await db.query('select integrantes from feria_proyectos where id=$1',[uuid(500)])).rows[0].integrantes;const sql=await readFile(new URL('../supabase/feria-integrantes.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);p=await rpc('feria_proyecto',[uuid(500)],['uuid']);assert.equal(p.proyecto.integrantes,textoAntes);assert.deepEqual(p.proyecto.integrantes_ids,[]);assert.equal(p.proyecto.version,2);
await db.query('update estudiantes set activo=false where id=$1',[uuid(7)]);ctx=await rpc('feria_contexto');assert.deepEqual(ctx.companeros,[]);await assert.rejects(guardar(datos,2,3));
console.log('PASS: compañeros del grupo, privacidad, inactivos, IDs válidos, nombres del servidor, autor automático, equipos individuales, salón 7/8 y migración sin pérdida');await db.close();
