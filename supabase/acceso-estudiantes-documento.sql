-- Ejecutar completo después de documentos-estudiantes.sql.
-- Prepara únicamente cuentas de estudiantes activos cuyo correo y documento coincidan.
begin;
create table if not exists public.acudiente_intentos(llave text primary key,inicio timestamptz not null default now(),cantidad integer not null default 1);
alter table public.acudiente_intentos enable row level security;
revoke all on public.acudiente_intentos from public,anon,authenticated;
create or replace function public.acudiente_registrar_intento(clave text)
returns boolean language plpgsql security definer set search_path=public as $$
declare cantidad_actual integer;
begin
 delete from public.acudiente_intentos where inicio<now()-interval '1 day';
 insert into public.acudiente_intentos(llave) values(clave) on conflict(llave) do update
 set cantidad=case when acudiente_intentos.inicio<now()-interval '10 minutes' then 1 else acudiente_intentos.cantidad+1 end,
 inicio=case when acudiente_intentos.inicio<now()-interval '10 minutes' then now() else acudiente_intentos.inicio end returning cantidad into cantidad_actual;
 return cantidad_actual<=12;
end; $$;
revoke all on function public.acudiente_registrar_intento(text) from public,anon,authenticated;
grant execute on function public.acudiente_registrar_intento(text) to service_role;
create or replace function public.preparar_acceso_estudiante(correo text,documento_ingresado text)
returns jsonb language plpgsql security definer set search_path=public,auth as $$
declare ficha public.estudiantes;cuenta uuid;
begin
 select * into ficha from public.estudiantes where email=lower(trim(correo)) and activo and documento=documento_ingresado for update;
 if ficha.id is null then return null;end if;
 if to_regclass('public.invitaciones_profesor') is not null then
  if exists(select 1 from public.invitaciones_profesor i where lower(i.email)=ficha.email) then return null;end if;
 end if;
 select id into cuenta from auth.users where lower(email)=ficha.email;
 if cuenta is null then
  if ficha.auth_user_id is not null then return null;end if;
  return jsonb_build_object('email',ficha.email,'crear',true);
 end if;
 if ficha.auth_user_id is not null and ficha.auth_user_id<>cuenta then return null;end if;
 if exists(select 1 from public.perfiles where id=cuenta and rol::text<>'estudiante') then return null;end if;
 if to_regclass('public.acudientes') is not null then
  if exists(select 1 from public.acudientes where auth_user_id=cuenta) then return null;end if;
 end if;
 if exists(select 1 from public.estudiantes where auth_user_id=cuenta and id<>ficha.id) then return null;end if;
 update public.estudiantes set auth_user_id=cuenta where id=ficha.id;
 insert into public.perfiles(id,nombre,rol) values(cuenta,ficha.nombre,'estudiante') on conflict(id) do update set nombre=excluded.nombre where perfiles.rol='estudiante';
 return jsonb_build_object('email',ficha.email,'id',cuenta,'crear',false);
end; $$;
revoke all on function public.preparar_acceso_estudiante(text,text) from public,anon,authenticated;
grant execute on function public.preparar_acceso_estudiante(text,text) to service_role;
commit;
