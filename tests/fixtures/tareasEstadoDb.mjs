import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
export const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
export const tarea=n=>'10000000-0000-0000-0000-'+String(n).padStart(12,'0');
export async function crearDbTareasEstado(){
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table estudiantes(id uuid primary key,nombre text,grado integer,activo boolean,auth_user_id uuid);
 create table avisos(id uuid primary key,tipo text,titulo text,contenido text,grado integer,fecha_evento date,publicado boolean,foto_path text);`);
 for(const [n,grado,activo] of [[1,6,true],[2,6,true],[3,7,true],[4,6,false],[7,0,true]])await db.query('insert into estudiantes values($1,$2,$3,$4,$1)',[id(n),'Estudiante '+n,grado,activo]);
 for(const [n,grado,publicado,tipo,fecha] of [[1,6,true,'tarea','2026-10-22'],[2,null,true,'tarea','2026-10-21'],[3,7,true,'tarea',null],[4,6,false,'tarea',null],[5,6,true,'evento',null],[6,0,true,'tarea','2026-10-20']])await db.query('insert into avisos values($1,$2,$3,$4,$5,$6,$7,null)',[tarea(n),tipo,'Tarea '+n,'Realizar actividad '+n,grado,fecha,publicado]);
 const sql=await readFile(new URL('../../supabase/tareas-estado-estudiante.sql',import.meta.url),'utf8');
 await db.exec(sql);await db.exec(sql);
 return db;
}
