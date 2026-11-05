-- Ejecutar completo en Supabase > SQL Editor. Conserva todos los proyectos.
begin;
create table if not exists public.feria_inscripciones (
 id boolean primary key default true check(id),
 cerrada boolean not null default false,
 fecha_limite timestamptz
);
insert into public.feria_inscripciones(id) values(true) on conflict do nothing;
alter table public.feria_inscripciones enable row level security;
revoke all on public.feria_inscripciones from public,anon,authenticated;
create or replace function public.feria_inscripciones_estado() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('cerrada',cerrada,'fecha_limite',fecha_limite,'abierta',not cerrada and (fecha_limite is null or statement_timestamp()<fecha_limite)) from public.feria_inscripciones where id;
$$;
create or replace function public.feria_inscripciones_configurar(cerrar boolean,limite timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo los docentes pueden cambiar el plazo';end if;
 if cerrar is null then raise exception 'Indica si deseas cerrar las inscripciones';end if;
 update public.feria_inscripciones set cerrada=cerrar,fecha_limite=limite where id;
 return public.feria_inscripciones_estado();
end;$$;
create or replace function public.feria_exigir_inscripciones_abiertas() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- La organización docente mantiene sus permisos existentes.
 if coalesce(public.es_profesor(),false) then
  if TG_OP='DELETE' then return old;else return new;end if;
 end if;
 -- Bloqueo compartido para serializar el cierre con escrituras en curso.
 perform 1 from public.feria_inscripciones where id for share;
 if not coalesce((public.feria_inscripciones_estado()->>'abierta')::boolean,false) then
  raise exception 'Las inscripciones y modificaciones de proyectos están cerradas. Puedes consultar tu proyecto o comunicarte con un docente.';
 end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end;$$;
drop trigger if exists feria_control_inscripciones on public.feria_proyectos;
create trigger feria_control_inscripciones before insert or update or delete on public.feria_proyectos
for each row execute function public.feria_exigir_inscripciones_abiertas();
revoke all on function public.feria_inscripciones_estado(),public.feria_inscripciones_configurar(boolean,timestamptz),public.feria_exigir_inscripciones_abiertas() from public,anon;
grant execute on function public.feria_inscripciones_estado(),public.feria_inscripciones_configurar(boolean,timestamptz) to authenticated;
commit;
