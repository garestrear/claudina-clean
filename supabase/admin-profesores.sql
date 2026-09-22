-- Claudina Clean · invitaciones seguras para nuevos profesores administradores
-- Ejecutar UNA VEZ en Supabase > SQL Editor.

create table if not exists public.invitaciones_profesor (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(trim(email))),
  nombre text not null,
  invitado_por uuid not null references auth.users(id),
  usada boolean not null default false,
  created_at timestamptz not null default now(),
  usada_en timestamptz
);

alter table public.invitaciones_profesor enable row level security;

drop policy if exists "profesor consulta invitaciones" on public.invitaciones_profesor;
create policy "profesor consulta invitaciones"
on public.invitaciones_profesor
for select to authenticated
using (public.es_profesor());

-- La función registra la invitación y, si la cuenta ya existe, le concede
-- inmediatamente el rol profesor (administrador).
create or replace function public.invitar_profesor(
  correo text,
  nombre_profesor text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  correo_normalizado text := lower(trim(correo));
  usuario_id uuid;
begin
  if not public.es_profesor() then
    raise exception 'Solo un profesor administrador puede invitar docentes';
  end if;

  if correo_normalizado = '' or trim(nombre_profesor) = '' then
    raise exception 'Nombre y correo son obligatorios';
  end if;

  insert into public.invitaciones_profesor(email, nombre, invitado_por)
  values (correo_normalizado, trim(nombre_profesor), auth.uid())
  on conflict (email) do update
    set nombre = excluded.nombre,
        invitado_por = auth.uid(),
        usada = false,
        usada_en = null;

  select id into usuario_id
  from auth.users
  where lower(email) = correo_normalizado
  limit 1;

  if usuario_id is not null then
    insert into public.perfiles(id, nombre, rol)
    values (usuario_id, trim(nombre_profesor), 'profesor')
    on conflict (id) do update
      set nombre = excluded.nombre,
          rol = 'profesor';

    update public.invitaciones_profesor
    set usada = true, usada_en = now()
    where email = correo_normalizado;
  end if;
end;
$$;

revoke all on function public.invitar_profesor(text,text) from public;
grant execute on function public.invitar_profesor(text,text) to authenticated;

-- Al crearse una cuenta desde el enlace enviado por correo, esta función
-- comprueba que exista una invitación previa antes de conceder permisos.
create or replace function public.procesar_invitacion_profesor()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  invitacion record;
begin
  select * into invitacion
  from public.invitaciones_profesor
  where email = lower(new.email)
    and usada = false
  order by created_at desc
  limit 1;

  if invitacion.id is not null then
    insert into public.perfiles(id, nombre, rol)
    values (new.id, invitacion.nombre, 'profesor')
    on conflict (id) do update
      set nombre = excluded.nombre,
          rol = 'profesor';

    update public.invitaciones_profesor
    set usada = true, usada_en = now()
    where id = invitacion.id;
  end if;

  return new;
end;
$$;

drop trigger if exists al_crear_usuario_procesar_invitacion on auth.users;
create trigger al_crear_usuario_procesar_invitacion
after insert on auth.users
for each row execute function public.procesar_invitacion_profesor();
