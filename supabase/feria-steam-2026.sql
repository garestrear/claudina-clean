-- Feria STEAM 2026. Ejecutar en Supabase SQL Editor antes de usar el módulo.
create table if not exists public.feria_steam_proyectos (
 id uuid primary key default gen_random_uuid(),
 autor_id uuid not null references auth.users(id),
 nombre text not null default '',
 grado text not null default '',
 integrantes uuid[] not null default '{}',
 descripcion text not null default '',
 motivacion text not null default '',
 procedimiento text not null default '',
 materiales text not null default '',
 resultados text not null default '',
 estado text not null default 'borrador' check (estado in ('borrador','pendiente','ajustes','aprobado')),
 comentario_docente text not null default '',
 revisado_por uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.feria_steam_proyectos enable row level security;
create or replace function public.feria_steam_es_docente() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and rol='profesor');
$$;
revoke all on function public.feria_steam_es_docente() from public;
grant execute on function public.feria_steam_es_docente() to authenticated;
drop policy if exists "steam leer" on public.feria_steam_proyectos;
create policy "steam leer" on public.feria_steam_proyectos for select to authenticated using (autor_id=auth.uid() or public.feria_steam_es_docente());
drop policy if exists "steam insertar" on public.feria_steam_proyectos;
create policy "steam insertar" on public.feria_steam_proyectos for insert to authenticated with check (
 autor_id=auth.uid() and estado in ('borrador','pendiente') and
 exists(select 1 from public.estudiantes where auth_user_id=auth.uid() and activo=true)
);
-- Actualizaciones se realizan mediante RPC para impedir que estudiantes se autoaprueben.
create or replace function public.feria_steam_guardar(p_id uuid,p_nombre text,p_grado text,p_integrantes uuid[],p_descripcion text,p_motivacion text,p_procedimiento text,p_materiales text,p_resultados text,p_enviar boolean)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_estado text;
begin
 if not exists(select 1 from public.estudiantes where auth_user_id=auth.uid() and activo=true) then raise exception 'Cuenta estudiantil no vinculada'; end if;
 if p_id is not null then
   select estado into v_estado from public.feria_steam_proyectos where id=p_id and autor_id=auth.uid() for update;
   if v_estado is null or v_estado not in ('borrador','ajustes') then raise exception 'Este proyecto no se puede editar'; end if;
 end if;
 if p_enviar and (length(trim(coalesce(p_nombre,'')))<3 or length(trim(coalesce(p_descripcion,'')))<10 or length(trim(coalesce(p_procedimiento,'')))<10) then
  raise exception 'Completa el nombre, la descripción y el procedimiento antes de enviar';
 end if;
 if p_id is null then
 insert into public.feria_steam_proyectos(autor_id,nombre,grado,integrantes,descripcion,motivacion,procedimiento,materiales,resultados,estado)
 values(auth.uid(),p_nombre,p_grado,coalesce(p_integrantes,'{}'),p_descripcion,p_motivacion,p_procedimiento,p_materiales,p_resultados,case when p_enviar then 'pendiente' else 'borrador' end) returning id into v_id;
 else
 update public.feria_steam_proyectos set nombre=p_nombre,grado=p_grado,integrantes=coalesce(p_integrantes,'{}'),descripcion=p_descripcion,motivacion=p_motivacion,procedimiento=p_procedimiento,materiales=p_materiales,resultados=p_resultados,estado=case when p_enviar then 'pendiente' else 'borrador' end,comentario_docente='',updated_at=now() where id=p_id returning id into v_id;
 end if;
 return v_id;
end $$;
revoke all on function public.feria_steam_guardar(uuid,text,text,uuid[],text,text,text,text,text,boolean) from public;
grant execute on function public.feria_steam_guardar(uuid,text,text,uuid[],text,text,text,text,text,boolean) to authenticated;
create or replace function public.feria_steam_revisar(p_id uuid,p_aprobar boolean,p_comentario text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.feria_steam_es_docente() then raise exception 'Solo docentes'; end if;
 update public.feria_steam_proyectos set estado=case when p_aprobar then 'aprobado' else 'ajustes' end,
 comentario_docente=coalesce(p_comentario,''), revisado_por=auth.uid(),updated_at=now()
 where id=p_id and estado='pendiente';
 if not found then raise exception 'El proyecto ya no está pendiente'; end if;
end $$;
revoke all on function public.feria_steam_revisar(uuid,boolean,text) from public;
grant execute on function public.feria_steam_revisar(uuid,boolean,text) to authenticated;
