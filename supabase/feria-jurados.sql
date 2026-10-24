-- Ejecutar completo en SQL Editor. Conserva los proyectos existentes.
begin;
create table if not exists public.feria_jurados (
 id uuid primary key default gen_random_uuid(),
 nombre text not null, institucion text not null, profesion text not null,
 correo text not null unique, telefono text not null,
 consentimiento_en timestamptz not null default now(), creado_en timestamptz not null default now()
);
alter table public.feria_jurados enable row level security;
revoke all on public.feria_jurados from public,anon,authenticated;
grant select on public.feria_jurados to authenticated;
drop policy if exists jurados_lectura_docente on public.feria_jurados;
create policy jurados_lectura_docente on public.feria_jurados for select to authenticated using (public.es_profesor());
create or replace function public.feria_jurado_postular(datos jsonb, acepta boolean)
returns void language plpgsql security definer set search_path='' as $$
declare campo text; valor text; limite int;
begin
 if acepta is distinct from true then raise exception 'Se requiere autorización';end if;
 if datos is null or jsonb_typeof(datos)<>'object' then raise exception 'Datos inválidos';end if;
 foreach campo in array array['nombre','institucion','profesion','correo','telefono'] loop
  valor:=trim(datos->>campo);limite:=case when campo='correo' then 254 when campo='telefono' then 50 else 150 end;
  if valor is null or length(valor)<2 or length(valor)>limite then raise exception 'Completa correctamente %',campo;end if;
 end loop;
 if trim(datos->>'correo') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or trim(datos->>'telefono') !~ '^[+0-9() .-]{7,50}$' then raise exception 'Correo o teléfono inválido';end if;
 -- Una postulación por correo; repetir no revela si ya estaba registrado ni sobrescribe datos.
 insert into public.feria_jurados(nombre,institucion,profesion,correo,telefono)
 values(trim(datos->>'nombre'),trim(datos->>'institucion'),trim(datos->>'profesion'),lower(trim(datos->>'correo')),trim(datos->>'telefono')) on conflict(correo) do nothing;
end $$;
revoke all on function public.feria_jurado_postular(jsonb,boolean) from public;
grant execute on function public.feria_jurado_postular(jsonb,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
