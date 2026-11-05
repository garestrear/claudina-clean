import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function public.es_profesor() returns boolean language sql as $$select auth.uid()='00000000-0000-0000-0000-000000000001'::uuid$$;
 create table feria_planes_carrusel(fecha date,inicio time,fin time);
 create function feria_espacios_contexto() returns jsonb language sql as $$select '{"espacios":[],"programacion":[],"docentes":[]}'::jsonb$$;
 create function feria_agenda_contexto() returns jsonb language sql as $$select '{"actividades":[{"titulo":"Apertura"}]}'::jsonb$$;
 create function feria_carrusel_contexto(date,time,time) returns jsonb language sql as $$select jsonb_build_object('plan',jsonb_build_object('minutos',20),'inicio',$2)$$;
 insert into feria_planes_carrusel values('2026-11-06','10:15','11:40'),('2026-11-06','08:00','10:00'),('2026-11-07','09:00','10:00');`);
 const sql=await readFile('supabase/feria-programacion-imprimir.sql','utf8');await db.exec(sql);await db.exec(sql);
 await assert.rejects(db.query("select feria_programacion_impresion('2026-11-06')"),/Solo docentes/);
 await db.exec("select set_config('test.uid','00000000-0000-0000-0000-000000000001',false)");
 const d=(await db.query("select feria_programacion_impresion('2026-11-06') d")).rows[0].d;
 assert.equal(d.carruseles.length,2);assert.equal(d.carruseles[0].inicio,'08:00:00');assert.equal(d.agenda[0].titulo,'Apertura');assert.deepEqual(d.espacios,[]);
 await assert.rejects(db.query('select feria_programacion_impresion(null)'),/Selecciona/);
 console.log('PASS impresión completa: permisos, fecha, todas las franjas guardadas y agenda');
}finally{await db.close()}
