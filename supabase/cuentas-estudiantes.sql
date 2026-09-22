-- Ejecutar en Supabase SQL Editor antes de activar el acceso estudiantil.
-- El profesor asigna previamente un correo a cada ficha; el correo autenticado
-- debe coincidir exactamente. Nunca se aceptan nombres o roles enviados por el navegador.
alter table public.estudiantes add column if not exists email text;
alter table public.estudiantes add constraint estudiantes_email_normalizado
  check (email is null or (email = lower(trim(email)) and email ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'));
create unique index if not exists estudiantes_email_unico on public.estudiantes (email) where email is not null;
create unique index if not exists estudiantes_auth_unico on public.estudiantes (auth_user_id) where auth_user_id is not null;

create or replace function public.vincular_estudiante_por_correo()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare ficha record;
begin
  if new.email is null or new.email_confirmed_at is null then return new; end if;
  select id,nombre,auth_user_id into ficha from public.estudiantes
    where email = lower(trim(new.email)) and activo = true limit 1;
  if ficha.id is null or (ficha.auth_user_id is not null and ficha.auth_user_id <> new.id) then return new; end if;
  -- No alterar cuentas docentes existentes.
  if exists (select 1 from public.perfiles where id = new.id and rol = 'profesor') then return new; end if;
  update public.estudiantes set auth_user_id = new.id where id = ficha.id;
  insert into public.perfiles(id,nombre,rol) values(new.id,ficha.nombre,'estudiante')
    on conflict(id) do update set nombre=excluded.nombre where public.perfiles.rol='estudiante';
  return new;
end; $$;

-- El trigger de profesores existente conserva su comportamiento.
drop trigger if exists vincular_cuenta_estudiante on auth.users;
create trigger vincular_cuenta_estudiante after insert or update of email,email_confirmed_at on auth.users
for each row execute function public.vincular_estudiante_por_correo();

create or replace function public.vincular_ficha_estudiante()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare usuario_id uuid;
begin
  if new.email is null or not new.activo then
    new.auth_user_id := null;
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email is distinct from new.email then new.auth_user_id := null; end if;
  select id into usuario_id from auth.users
    where lower(email)=new.email and email_confirmed_at is not null limit 1;
  if usuario_id is not null and not exists
    (select 1 from public.perfiles where id=usuario_id and rol='profesor') then
    new.auth_user_id := usuario_id;
    insert into public.perfiles(id,nombre,rol) values(usuario_id,new.nombre,'estudiante')
      on conflict(id) do update set nombre=excluded.nombre where public.perfiles.rol='estudiante';
  end if;
  return new;
end; $$;
drop trigger if exists vincular_ficha_estudiante on public.estudiantes;
create trigger vincular_ficha_estudiante before insert or update of email,activo,nombre on public.estudiantes
for each row execute function public.vincular_ficha_estudiante();

-- Los alumnos solo consultan su propia ficha y turno.
drop policy if exists "estudiantes lectura autenticada" on public.estudiantes;
create policy "estudiante lee ficha propia" on public.estudiantes
for select to authenticated using (auth_user_id=auth.uid());
drop policy if exists "asignaciones lectura autenticada" on public.asignaciones;
create policy "estudiante lee turno propio" on public.asignaciones
for select to authenticated using (exists(select 1 from public.estudiantes e
  where e.id=estudiante_id and e.auth_user_id=auth.uid()));
