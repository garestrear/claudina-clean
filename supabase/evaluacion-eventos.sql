-- Ejecutar en Supabase SQL Editor antes de activar la interfaz.
begin;
create table if not exists public.eventos_evaluables (
 id uuid primary key default gen_random_uuid(),
 titulo text not null check (length(trim(titulo)) between 1 and 150),
 descripcion text not null default '',
 grados integer[] not null default array[1,2,3,4,5,6,7,8],
 roles text[] not null default array['estudiante','acudiente','profesor']::text[],
 estado text not null default 'borrador' check (estado in ('borrador','abierto','cerrado')),
 creado_por uuid not null default auth.uid(),
 created_at timestamptz not null default now()
);
create table if not exists public.evento_participantes (
 evento_id uuid not null references public.eventos_evaluables(id) on delete cascade,
 usuario_id uuid not null,
 primary key(evento_id,usuario_id)
);
create table if not exists public.evento_respuestas (
 id uuid primary key default gen_random_uuid(),
 evento_id uuid not null references public.eventos_evaluables(id) on delete cascade,
 nota integer not null check(nota between 1 and 10),
 comentario text not null default '' check(length(comentario)<=1000),
 created_at timestamptz not null default now()
);
alter table public.eventos_evaluables enable row level security;
alter table public.evento_participantes enable row level security;
alter table public.evento_respuestas enable row level security;
revoke all on public.eventos_evaluables,public.evento_participantes,public.evento_respuestas from anon,authenticated;
create or replace function public.evento_habilitado(ficha public.eventos_evaluables)
returns boolean language sql stable security definer set search_path='' as $
 select (('estudiante'=any(ficha.roles) and exists(select 1 from public.estudiantes s where s.auth_user_id=auth.uid() and s.activo and s.grado=any(ficha.grados)))
 or ('acudiente'=any(ficha.roles) and exists(select 1 from public.acudientes a join public.estudiantes s on s.id=a.estudiante_id where a.auth_user_id=auth.uid() and s.activo and s.grado=any(ficha.grados)))
 or ('profesor'=any(ficha.roles) and public.es_profesor()));
$;
create or replace function public.eventos_listar()
returns jsonb language plpgsql security definer set search_path='' as $$
declare resultado jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'titulo',e.titulo,'descripcion',e.descripcion,'estado',e.estado,'grados',e.grados,'respondido',exists(select 1 from public.evento_participantes p where p.evento_id=e.id and p.usuario_id=auth.uid())) order by e.created_at desc),'[]'::jsonb)
 into resultado from public.eventos_evaluables e
 where public.es_profesor() or (e.estado<>'borrador' and public.evento_habilitado(e));
 return resultado;
end $$;
create or replace function public.evento_crear(nombre text, detalle text, destinatarios integer[], tipos text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare nuevo uuid;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo docentes'; end if;
 if length(trim(coalesce(nombre,''))) not between 1 and 150 or length(coalesce(detalle,''))>1000 then raise exception 'Datos inválidos'; end if;
 if tipos is null or cardinality(tipos)=0 or exists(select 1 from unnest(tipos) t where t not in ('estudiante','acudiente','profesor')) then raise exception 'Roles inválidos'; end if;
 if destinatarios is null or cardinality(destinatarios)=0 or exists(select 1 from unnest(destinatarios) g where g not between 1 and 8) then raise exception 'Grados inválidos'; end if;
 insert into public.eventos_evaluables(titulo,descripcion,grados,roles) values(trim(nombre),coalesce(detalle,''),destinatarios,tipos) returning id into nuevo;
 return nuevo;
end $$;
create or replace function public.evento_estado(evento uuid, nuevo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo docentes'; end if;
 if nuevo not in ('abierto','cerrado') then raise exception 'Estado inválido'; end if;
 update public.eventos_evaluables set estado=nuevo where id=evento and (estado='borrador' and nuevo='abierto' or estado='abierto' and nuevo='cerrado');
 if not found then raise exception 'Cambio de estado no permitido'; end if;
end $$;
create or replace function public.evento_responder(evento uuid, calificacion integer, opinion text default '')
returns void language plpgsql security definer set search_path='' as $$
declare ficha public.eventos_evaluables;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 select * into ficha from public.eventos_evaluables where id=evento for share;
 if ficha.id is null or ficha.estado<>'abierto' then raise exception 'Evaluación no disponible'; end if;
 if not public.evento_habilitado(ficha) then raise exception 'No estás habilitado para responder'; end if;
 if calificacion not between 1 and 10 or length(coalesce(opinion,''))>1000 then raise exception 'Respuesta inválida'; end if;
 insert into public.evento_participantes(evento_id,usuario_id) values(evento,auth.uid());
 insert into public.evento_respuestas(evento_id,nota,comentario) values(evento,calificacion,trim(coalesce(opinion,'')));
end $$;
create or replace function public.evento_resultados(evento uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare resultado jsonb;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo docentes'; end if;
 if not exists(select 1 from public.eventos_evaluables where id=evento) then raise exception 'Evento inexistente'; end if;
 select jsonb_build_object('total',count(*),'promedio',case when count(*)>=5 then round(avg(nota)::numeric,2) else null end,'distribucion',case when count(*)>=5 then coalesce((select jsonb_object_agg(nota,cantidad) from (select nota,count(*) cantidad from public.evento_respuestas where evento_id=evento group by nota) t),'{}'::jsonb) else '{}'::jsonb end,
 'comentarios',case when count(*)>=5 then coalesce(jsonb_agg(comentario) filter(where comentario<>''),'[]'::jsonb) else '[]'::jsonb end)
 into resultado from public.evento_respuestas where evento_id=evento;
 return resultado;
end $$;
revoke all on function public.evento_habilitado(public.eventos_evaluables) from public,anon,authenticated;
revoke all on function public.eventos_listar(),public.evento_crear(text,text,integer[],text[]),public.evento_estado(uuid,text),public.evento_responder(uuid,integer,text),public.evento_resultados(uuid) from public,anon;
grant execute on function public.eventos_listar(),public.evento_crear(text,text,integer[]),public.evento_estado(uuid,text),public.evento_responder(uuid,integer,text),public.evento_resultados(uuid) to authenticated;
commit;
