import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {generarRecorrido} from '../src/evaluacionJurados.js';
const db=new PGlite();const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table perfiles(id uuid primary key,nombre text,rol text);
create function public.es_profesor() returns boolean language sql stable security definer as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='profesor')$$;
create table feria_proyectos(id uuid primary key,titulo text,grado integer,estado text,integrantes text,propuesta text,procedimiento text,resultados_esperados text,areas text[],asesor_id uuid,autor uuid);
create table feria_proyectos_externos(id uuid primary key,datos jsonb,estado text,autor uuid);
create table feria_placas(origen text,proyecto_id uuid,categoria text,numero_categoria integer,numero_general integer);
insert into perfiles values('${uid(1)}','Organizador','profesor');
insert into auth.users values('${uid(1)}','profe@ejemplo.co',now()),('${uid(2)}','jurado1@ejemplo.co',now()),('${uid(3)}','jurado2@ejemplo.co',now()),('${uid(4)}','jurado3@ejemplo.co',now()),('${uid(5)}','jurado4@ejemplo.co',now()),('${uid(6)}','otro@ejemplo.co',now()),('${uid(7)}','sinverificar@ejemplo.co',null);`);
for(const archivo of ['feria-jurados.sql','feria-espacios-programacion.sql','feria-evaluacion-jurados.sql'])await db.exec(await readFile('supabase/'+archivo,'utf8'));
await db.exec(await readFile('supabase/feria-evaluacion-jurados.sql','utf8'));
const actor=async n=>db.query("select set_config('test.uid',$1,false)",[n?uid(n):'']);
const rpc=async(name,args=[],types=[])=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)+'::'+types[i]).join(',')}) d`,args)).rows[0].d;
const ctx=()=>rpc('feria_evaluacion_contexto');
await actor(1);

for(let n=10;n<16;n++)await db.query("insert into feria_proyectos values($1,$2,6,'aprobado','Ana y Luis','Investigar','Probar','Aprender',array['science'],$3,$4)",[uid(n),'Proyecto '+n,uid(1),uid(90)]);
await db.query("insert into feria_proyectos values($1,'[Emprendimiento familiar] Abono',6,'aprobado','','','','',array[]::text[],null,null)",[uid(19)]);
await db.query("insert into feria_proyectos_externos values($1,$2,'aprobado',null)",[uid(20),{titulo:'Entidad invitada',areas:[]}]);
for(let n=1;n<=2;n++)await rpc('feria_jurado_habilitar',[uid(100+n),{nombre:'Jurado '+n,correo:`jurado${n}@ejemplo.co`,areas:['science'],conflictos:[]},true],['uuid','jsonb','boolean']);
const aula=(await db.query("select id from feria_espacios where codigo='salon-1'")).rows[0].id;
for(let n=10;n<16;n++)await db.query("insert into feria_programacion(espacio_id,fecha,inicio,fin,tipo,origen,proyecto_id,titulo)values($1,'2026-11-06','08:00','10:00','proyecto','claudina',$2,$3)",[aula,uid(n),'Proyecto '+n]);
const migracion=await readFile('supabase/feria-jurados-asignacion-automatica.sql','utf8');await db.exec(migracion);
let visitas=(await ctx()).visitas;assert.equal(visitas.length,12,'dos inscritos actuales reciben dos visitas por proyecto');
await actor(null);await rpc('feria_jurado_postular',[{nombre:'Jurado nuevo',institucion:'Colegio',profesion:'Docente',correo:'nuevo@ejemplo.co',telefono:'3001234567'},true],['jsonb','boolean']);
await actor(1);visitas=(await ctx()).visitas;assert.equal(visitas.length,18,'tercera inscripción completa tres jurados de inmediato');assert(!visitas.some(v=>[uid(19),uid(20)].includes(v.proyecto_id)));
const fijada=visitas[0];await db.query("insert into feria_evaluaciones(visita_id,solicitud) values($1,$2)",[fijada.id,uid(999)]);
await rpc('feria_jurado_postular',[{nombre:'Otro jurado',institucion:'Colegio',profesion:'Artista',correo:'otro-nuevo@ejemplo.co',telefono:'3001234567'},true],['jsonb','boolean']);
visitas=(await ctx()).visitas;assert.equal(visitas.length,18);assert(visitas.find(v=>v.id===fijada.id&&v.jurado_id===fijada.jurado_id),'conserva borrador y visita');
const cargas=Object.values(Object.groupBy(visitas,v=>v.jurado_id)).map(v=>v.length);assert.equal(cargas.length,4,'el nuevo jurado recibe trabajo aunque antes se cubrieran todos');assert(Math.max(...cargas)<=10);assert(Math.max(...cargas)-Math.min(...cargas)<=1,'cargas equilibradas con cuatro jurados');
await rpc('feria_jurado_postular',[{nombre:'Profesor asesor',institucion:'Colegio',profesion:'Docente',correo:'profe@ejemplo.co',telefono:'3001234567'},true],['jsonb','boolean']);
const asesor=(await ctx()).jurados.find(j=>j.correo==='profe@ejemplo.co');assert(!(await ctx()).visitas.some(v=>v.jurado_id===asesor.id),'el asesor no evalúa sus proyectos');
const libre=(await ctx()).jurados.find(j=>j.id!==fijada.jurado_id&&j.id!==asesor.id);
await rpc('feria_jurado_habilitar',[libre.id,{...libre,conflictos:['claudina:'+uid(10)]},true],['uuid','jsonb','boolean']);assert(!(await ctx()).visitas.some(v=>v.jurado_id===libre.id&&v.proyecto_id===uid(10)),'se permite configurar conflictos y se redistribuye');
const resumen=await rpc('feria_jurados_asignar_automaticamente');assert.equal(resumen.pendientes,0);
await db.exec(migracion);assert.equal((await ctx()).visitas.length,18,'migración repetible');
await actor(null);await assert.rejects(rpc('feria_jurados_asignar_automaticamente'),/Solo docentes/);
await db.exec('set role anon');await assert.rejects(db.query('select public.feria_asignar_jurados_interno()'),/permission denied/);await db.exec('reset role');
console.log('PASS asignación SQL: inscritos actuales, alta pública inmediata, redistribución, borradores intactos, familias/invitados excluidos, idempotencia y permisos');


await actor(1);
// Añade dos aulas; una ruta sintética alterna A-B-A-B antes de optimizar.
await db.exec(`insert into feria_espacios(codigo,nombre,tipo,cupos) values('ruta-a','Aula A','salon',10),('ruta-b','Aula B','salon',10)`);
const salas=(await db.query("select id,codigo from feria_espacios where codigo in('ruta-a','ruta-b') order by codigo")).rows;
for(let n=10;n<16;n++)await db.query('update feria_programacion set espacio_id=$1 where proyecto_id=$2',[salas[n%2].id,uid(n)]);
await db.exec('delete from feria_evaluaciones;delete from feria_evaluacion_visitas;');
for(let k=0;k<4;k++)await db.query("insert into feria_evaluacion_visitas(id,jurado_id,origen,proyecto_id,ronda,fecha,inicio,fin)values($1,$2,'claudina',$3,$4::integer,'2026-11-06',('08:00'::time+$4::integer*interval '11 minutes'),('08:10'::time+$4::integer*interval '11 minutes'))",[uid(900+k),uid(101),uid(10+k),k]);
const migracionRuta=await readFile('supabase/feria-jurados-recorrido-por-aula.sql','utf8');await db.exec(migracionRuta);
assert.equal((await db.query('select feria_costo_recorrido_aulas($1) c',[uid(101)])).rows[0].c,1,'dos bloques de aulas consecutivas');
assert.equal((await db.query('select count(*) n from feria_evaluacion_visitas')).rows[0].n,4,'conserva visitas y jurado');
const fija=(await db.query('select * from feria_evaluacion_visitas order by ronda limit 1')).rows[0];await db.query('insert into feria_evaluaciones(visita_id,solicitud) values($1,$2)',[fija.id,uid(998)]);
await db.exec(migracionRuta);const despues=(await db.query('select * from feria_evaluacion_visitas where id=$1',[fija.id])).rows[0];assert.equal(despues.ronda,fija.ronda);assert.equal(despues.inicio,fija.inicio);
await rpc('feria_jurados_asignar_automaticamente');assert((await ctx()).visitas.find(v=>v.id===fija.id),'el reparto automático también conserva la evaluación');
await db.exec('set role anon');await assert.rejects(db.query('select feria_optimizar_recorridos_aulas()'),/permission denied/);await db.exec('reset role');
console.log('PASS recorridos: agrupa aulas, conserva ids y evaluaciones, repetición segura y optimización en futuros repartos');

await actor(1);const rapido=await readFile('supabase/feria-jurados-rendimiento.sql','utf8');await db.exec(rapido);await db.exec(rapido);
const seguro=await readFile('supabase/feria-jurados-delete-seguro.sql','utf8');await db.exec(seguro);await db.exec(seguro);assert(!/delete\s+from\s+[\w.]+\s*;/i.test(rapido),'sin DELETE sin condición en funciones de rendimiento');
await rpc('feria_jurados_asignar_automaticamente');assert((await ctx()).visitas.some(v=>v.id===fija.id),'el reparto rápido conserva notas e ids');
// Volumen comparable a la feria: 36 proyectos y 12 jurados; no repetir el
// reparto al preparar cada fila de la prueba.
await db.exec('alter table feria_jurados disable trigger user;alter table feria_programacion disable trigger user;alter table feria_proyectos disable trigger user;delete from feria_evaluaciones;delete from feria_evaluacion_visitas;delete from feria_programacion;delete from feria_proyectos;delete from feria_jurados;');
for(let n=0;n<36;n++){
 await db.query("insert into feria_proyectos(id,titulo,grado,estado,areas)values($1,$2,6,'aprobado',array['science'])",[uid(1000+n),'Experiencia '+n]);
 await db.query("insert into feria_programacion(espacio_id,fecha,inicio,fin,tipo,origen,proyecto_id,titulo)values($1,'2026-11-06','08:00','10:00','proyecto','claudina',$2,$3)",[salas[n%2].id,uid(1000+n),'Experiencia '+n]);
}
for(let n=0;n<12;n++)await db.query("insert into feria_jurados(id,nombre,correo,institucion,profesion,telefono,habilitado)values($1,$2,$3,'','','',true)",[uid(2000+n),'Jurado '+n,'carga'+n+'@ejemplo.co']);
await db.exec('alter table feria_jurados enable trigger user;alter table feria_programacion enable trigger user;alter table feria_proyectos enable trigger user;');
let t=performance.now();const r=await rpc('feria_jurados_asignar_automaticamente');const repartoMs=performance.now()-t;assert.equal(r.pendientes,0);assert.equal((await ctx()).visitas.length,108);
t=performance.now();await rpc('feria_jurado_postular',[{nombre:'Jurado adicional',institucion:'Colegio',profesion:'Docente',correo:'adicional@ejemplo.co',telefono:'3001234567'},true],['jsonb','boolean']);const registroMs=performance.now()-t;
let cRapido=await ctx();const nuevo=cRapido.jurados.find(j=>j.correo==='adicional@ejemplo.co');assert(cRapido.visitas.some(v=>v.jurado_id===nuevo.id));assert.equal(cRapido.visitas.length,108);assert(cRapido.jurados.every(j=>cRapido.visitas.filter(v=>v.jurado_id===j.id).length<=10));
await db.exec(await readFile('supabase/feria-jurados-editar-eliminar.sql','utf8'));await db.exec(await readFile('supabase/feria-jurados-solo-nombre.sql','utf8'));
const antesVersion=(await ctx()).config.version;t=performance.now();await rpc('feria_jurado_habilitar',[uid(3000),{nombre:'Jurado solo nombre'},true],['uuid','jsonb','boolean']);const nombreMs=performance.now()-t;
assert.equal((await ctx()).config.version,antesVersion+2,'un solo reparto por UPSERT más la versión del alta');const versionRegistro=(await ctx()).config.version;
await rpc('feria_jurado_habilitar',[uid(3000),{nombre:'Nombre corregido',areas:[],conflictos:[]},true],['uuid','jsonb','boolean']);assert.equal((await ctx()).config.version,versionRegistro+1,'editar datos sin cambios de asignación no repite reparto');
console.log('PASS alta solo nombre: '+Math.round(nombreMs)+' ms, sin reparto duplicado');
console.log('PASS rendimiento: 36 proyectos, 12 jurados y 108 visitas; reparto '+Math.round(repartoMs)+' ms; inscripción y redistribución '+Math.round(registroMs)+' ms');await db.close();
