-- Ejecutar en el SQL Editor de Supabase.
begin;

create table if not exists public.aseo_configuracion_promedio (
  id boolean primary key default true check (id),
  mejores_notas integer check (mejores_notas > 0)
);
insert into public.aseo_configuracion_promedio (id) values (true) on conflict do nothing;
alter table public.aseo_configuracion_promedio enable row level security;
revoke all on public.aseo_configuracion_promedio from public, anon, authenticated;

create or replace function public.aseo_mejores_notas()
returns integer language sql stable security definer set search_path='' as $$
  select mejores_notas from public.aseo_configuracion_promedio where id;
$$;

create or replace function public.aseo_guardar_mejores_notas(cantidad integer)
returns integer language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(public.es_profesor(),false) then
    raise exception 'Solo los docentes pueden cambiar el cálculo del promedio de aseo' using errcode='42501';
  end if;
  update public.aseo_configuracion_promedio set mejores_notas=cantidad where id;
  return cantidad;
end;
$$;

revoke all on function public.aseo_mejores_notas(), public.aseo_guardar_mejores_notas(integer) from public, anon;
grant execute on function public.aseo_mejores_notas(), public.aseo_guardar_mejores_notas(integer) to authenticated;

commit;
