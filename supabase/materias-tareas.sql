-- Materias para tareas. Ejecutar completo DESPUÉS de tareas-estudiantes.sql. Repetible.
begin;
create table if not exists public.propuestas_tareas(
 id uuid primary key default gen_random_uuid(),autor uuid not null references auth.users(id),
 estudiante_id uuid not null references public.estudiantes(id) on delete cascade,
 grado integer not null check(grado between 1 and 8),
 titulo text not null check(length(trim(titulo)) between 1 and 120),
 contenido text not null check(length(trim(contenido)) between 1 and 1000),
 fecha_entrega date not null,estado text not null default 'pendiente' check(estado in('pendiente','publicada','rechazada')),
 aviso_id uuid references public.avisos(id) on delete set null,revisado_por uuid references auth.users(id),created_at timestamptz not null default now()
);
alter table public.propuestas_tareas add column if not exists materia text;
alter table public.propuestas_tareas enable row level security;
drop function if exists public.tarea_proponer(text,text,date);
drop function if exists public.tarea_revisar(uuid,text,text,date,integer,boolean);
revoke all on public.propuestas_tareas from public,anon,authenticated;
create or replace function public.tareas_propuestas_listar()
returns jsonb language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) from (
 select p.*,e.nombre from public.propuestas_tareas p join public.estudiantes e on e.id=p.estudiante_id
 where public.es_profesor() or (p.autor=auth.uid() and e.auth_user_id=auth.uid() and e.activo)
 ) x;
$$;
create or replace function public.tarea_proponer(titulo text,contenido text,fecha date,materia_asignada text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare ficha public.estudiantes;creada uuid;
begin
 if materia_asignada is not null and materia_asignada not in ('Matemáticas','Inglés','Tecnología, informática y emprendimiento','Español','Ciencias Naturales','Ciencias Sociales','Educación Ética','Educación Religiosa') then raise exception 'Selecciona una materia válida.';end if;
 select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo;
 if ficha.id is null then raise exception 'Solo estudiantes activos pueden proponer tareas.';end if;
 if fecha is null or fecha<(now() at time zone 'America/Bogota')::date then raise exception 'Selecciona una fecha de entrega de hoy o posterior.';end if;
 insert into public.propuestas_tareas(autor,estudiante_id,grado,titulo,contenido,fecha_entrega,materia) values(auth.uid(),ficha.id,ficha.grado,trim(titulo),trim(contenido),fecha,materia_asignada) returning id into creada;
 return creada;
end; $$;
create or replace function public.tarea_revisar(propuesta uuid,titulo text,contenido text,fecha date,grado_destino integer,publicar boolean,materia_asignada text default null)
returns void language plpgsql security definer set search_path=public as $$
declare ficha public.propuestas_tareas;aviso uuid;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo profesores pueden revisar tareas.';end if;
 select * into ficha from public.propuestas_tareas where id=propuesta for update;
 if ficha.id is null or ficha.estado<>'pendiente' then raise exception 'La propuesta ya fue revisada o no existe.';end if;
 if publicar is null then raise exception 'Selecciona publicar o rechazar.';end if;
 if publicar then
  if materia_asignada is not null and materia_asignada not in ('Matemáticas','Inglés','Tecnología, informática y emprendimiento','Español','Ciencias Naturales','Ciencias Sociales','Educación Ética','Educación Religiosa') then raise exception 'Selecciona una materia válida.';end if;
  if fecha is null or grado_destino is null or grado_destino not between 1 and 8 then raise exception 'Revisa fecha y grado.';end if;
  insert into public.avisos(tipo,titulo,contenido,grado,fecha_evento,creado_por,publicado) values('tarea',case when materia_asignada is null then trim(titulo) else materia_asignada||' · '||trim(titulo) end,trim(contenido),grado_destino,fecha,auth.uid(),true) returning id into aviso;
  update public.propuestas_tareas set materia=materia_asignada,titulo=trim(tarea_revisar.titulo),contenido=trim(tarea_revisar.contenido),fecha_entrega=fecha,grado=grado_destino,estado='publicada',aviso_id=aviso,revisado_por=auth.uid() where id=propuesta;
 else
  update public.propuestas_tareas set estado='rechazada',revisado_por=auth.uid() where id=propuesta;
 end if;
end; $$;
revoke all on function public.tareas_propuestas_listar(),public.tarea_proponer(text,text,date,text),public.tarea_revisar(uuid,text,text,date,integer,boolean,text) from public,anon;
grant execute on function public.tareas_propuestas_listar(),public.tarea_proponer(text,text,date,text),public.tarea_revisar(uuid,text,text,date,integer,boolean,text) to authenticated;
commit;
