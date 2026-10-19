import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crearFeriaDb,uid,uuid} from './fixtures/feriaDb.mjs';
import {datosFeria,leerBorradorFeria,validarFeria} from '../src/feriaCiencia.js';
const{db,identity,rpc}=await crearFeriaDb();
const datos={...datosFeria(),integrantes_ids:[],titulo:'Puente de papel',integrantes:'Ana y Luis',propuesta:'Construir un puente',procedimiento:'Probar distintas formas',areas:['engineering','mathematics'],asesor_id:uid(1)};
await identity(3);const contexto=await rpc('feria_contexto');assert.deepEqual(contexto.docentes.map(d=>d.id).sort(),[uid(1),uid(2)]);assert.deepEqual(Object.keys(contexto.docentes[0]).sort(),['id','nombre']);
const guardar=(d=datos,v=0,id=uuid(400),request=uuid(401))=>rpc('feria_guardar',[id,d,v,true,request],['uuid','jsonb','integer','boolean','uuid']);
for(const areas of [[],['foo'],['science','science'],[null],'science',[1],null])await assert.rejects(guardar({...datos,areas}));
for(const asesor_id of ['',uid(3),uid(5),uuid(999),null,'invalido'])await assert.rejects(guardar({...datos,asesor_id}));
let p=await guardar();assert.deepEqual(p.proyecto.areas,['engineering','mathematics']);assert.equal(p.proyecto.asesor_id,uid(1));assert.equal(p.asesor_nombre,'Docente Uno');const lista=(await rpc('feria_contexto')).proyectos;assert.deepEqual(lista[0].areas,['engineering','mathematics']);assert.equal(lista[0].asesor_nombre,'Docente Uno');
p=await guardar({...datos,areas:['science','technology','arts'],asesor_id:uid(2)},1,uuid(400),uuid(402));assert.equal(p.asesor_nombre,'Docente Dos');assert.deepEqual(p.proyecto.areas,['science','technology','arts']);
// Simular la forma anterior del esquema y comprobar la actualización incremental.
await db.exec('alter table public.feria_proyectos drop column areas;alter table public.feria_proyectos drop column asesor_id;');
const migracion=await readFile(new URL('../supabase/feria-areas-asesor.sql',import.meta.url),'utf8');await db.exec(migracion);await db.exec(migracion);
p=await rpc('feria_proyecto',[uuid(400)],['uuid']);assert.equal(p.proyecto.titulo,'Puente de papel');assert.deepEqual(p.proyecto.areas,[]);assert.equal(p.proyecto.asesor_id,null);assert.equal(p.proyecto.version,2);
await guardar(datos,2,uuid(400),uuid(403));assert.equal((await rpc('feria_proyecto',[uuid(400)],['uuid'])).asesor_nombre,'Docente Uno');
const antiguo={proyectoId:uuid(600),versionBase:0,datos:Object.fromEntries(Object.entries(datos).filter(([k])=>!['areas','asesor_id'].includes(k)))};const local=leerBorradorFeria({getItem:()=>JSON.stringify(antiguo)},'draft');assert.deepEqual(local.datos.areas,[]);assert.equal(local.datos.asesor_id,'');assert.match(validarFeria(local.datos,true),/áreas STEAM/);assert.match(validarFeria({...local.datos,areas:['science']},true),/profesor asesor/);
console.log('PASS: múltiples áreas, lista real de docentes, validación de asesor y áreas, cambios, migración repetible sin pérdida y borradores anteriores');await db.close();
