-- Ejecutar completo en Supabase SQL Editor. Conserva permisos de docentes actuales
-- SOLO en la primera instalación. Las invitaciones posteriores son de docente.
begin;
do $$begin
 if to_regclass('public.administradores_docentes') is null then
  create table public.administradores_docentes(id uuid primary key references public.perfiles(id) on delete cascade);
  insert into public.administradores_docentes(id) select id from public.perfiles where rol='profesor';
 end if;
end $$;
alter table public.administradores_docentes enable row level security;
revoke all on public.administradores_docentes from public,anon,authenticated;
grant select on public.administradores_docentes to service_role;
create or replace function public.es_administrador()
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.administradores_docentes a join public.perfiles p on p.id=a.id where a.id=auth.uid() and p.rol='profesor');
$$;
revoke all on function public.es_administrador() from public,anon;
grant execute on function public.es_administrador() to authenticated;
create or replace function public.docente_administracion()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes';end if;
 return jsonb_build_object('administrador',public.es_administrador(),'docentes',case when public.es_administrador() then
 (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'administrador',a.id is not null) order by p.nombre),'[]'::jsonb) from public.perfiles p left join public.administradores_docentes a on a.id=p.id where p.rol='profesor') else '[]'::jsonb end);
end $$;
create or replace function public.docente_cambiar_administracion(docente uuid,permitir boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(402619,1);
 if not public.es_administrador() then raise exception 'Solo administradores';end if;
 if permitir is null or not exists(select 1 from public.perfiles where id=docente and rol='profesor') then raise exception 'Selecciona un docente válido';end if;
 if permitir then insert into public.administradores_docentes values(docente) on conflict do nothing;
 else
  if exists(select 1 from public.administradores_docentes where id=docente) and
   (select count(*) from public.administradores_docentes a join public.perfiles p on p.id=a.id where p.rol='profesor')<=1 then raise exception 'Debe quedar al menos un administrador';end if;
  delete from public.administradores_docentes where id=docente;
 end if;
end $$;
revoke all on function public.docente_administracion(),public.docente_cambiar_administracion(uuid,boolean) from public,anon;
grant execute on function public.docente_administracion(),public.docente_cambiar_administracion(uuid,boolean) to authenticated;
-- Triggers: también cubren funciones SECURITY DEFINER que escriben estas tablas.
-- Los procesos internos sin una sesión docente (altas de estudiantes, login, etc.)
-- conservan sus validaciones y permisos existentes.
create or replace function public.proteger_administracion_docente()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and coalesce(public.es_profesor(),false) and not public.es_administrador() then
  raise exception 'Esta operación requiere un administrador';
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function public.proteger_administracion_docente() from public,anon,authenticated;
do $$declare tabla text;begin
 foreach tabla in array array['perfiles','estudiantes','asignaciones','invitaciones_profesor'] loop
  if to_regclass('public.'||tabla) is not null then
   execute format('drop trigger if exists proteger_administracion_docente on public.%I',tabla);
   execute format('create trigger proteger_administracion_docente before insert or update or delete on public.%I for each row execute function public.proteger_administracion_docente()',tabla);
  end if;
 end loop;
end $$;
commit;
