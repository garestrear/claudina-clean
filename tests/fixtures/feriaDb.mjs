import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const uid=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
export const uuid=n=>'10000000-0000-0000-0000-'+String(n).padStart(12,'0');
export async function crearFeriaDb(){
 const db=new PGlite();await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table public.perfiles(id uuid primary key,nombre text,rol text);
 create table public.estudiantes(id uuid primary key,nombre text,grado smallint,activo boolean,auth_user_id uuid);
 create table public.acudientes(auth_user_id uuid primary key,estudiante_id uuid not null unique references public.estudiantes(id));
 create function public.es_profesor() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.perfiles where id=auth.uid() and rol='profesor')$$;
 insert into perfiles values('${uid(1)}','Docente Uno','profesor'),('${uid(2)}','Docente Dos','profesor'),('${uid(3)}','Estudiante Sexto','estudiante'),('${uid(4)}','Estudiante TS','estudiante'),('${uid(5)}','Acudiente','acudiente'),('${uid(6)}','Inactivo','estudiante');
 insert into estudiantes values('${uuid(3)}','Estudiante Sexto',6,true,'${uid(3)}'),('${uuid(4)}','Estudiante TS',0,true,'${uid(4)}'),('${uuid(6)}','Inactivo',8,false,'${uid(6)}');`);
 await db.exec(`insert into public.estudiantes values('${uuid(7)}','Compañero Sexto',6,true,null),('${uuid(8)}','Compañero Séptimo',7,true,null),('${uuid(9)}','Compañero Octavo',8,true,null),('${uuid(10)}','Compañero Inactivo',6,false,null);`);
 const sql=await readFile(new URL('../../supabase/feria-ciencia.sql',import.meta.url),'utf8');await db.exec(sql);
 return{db,sql,identity:async n=>db.query("select set_config('test.uid',$1,false)",[n?uid(n):'']),rpc:async(name,args=[],types=[])=> (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)+'::'+types[i]).join(',')}) value`,args)).rows[0].value};
}
