-- Ejecutar después de acudientes.sql. Repetible; conserva documentos y cuentas.
begin;
alter table public.estudiantes add column if not exists tratamiento_familiar text;
alter table public.estudiantes drop constraint if exists estudiantes_tratamiento_familiar;
alter table public.estudiantes add constraint estudiantes_tratamiento_familiar check(tratamiento_familiar in('hijo','hija'));
-- Solo reordena cuando el correo confirma nombre + primer apellido + inicial
-- del segundo apellido. Los casos ambiguos se conservan para revisión docente.
create or replace function public.nombre_primero(nombre_original text,correo text)
returns text language plpgsql immutable set search_path=public as $$
declare palabras text[];normalizadas text[];usuario text;partes text[];
begin
 if nombre_original is null then return null;end if;
 if position(',' in nombre_original)>0 then
  partes:=string_to_array(nombre_original,',');
  if array_length(partes,1)=2 and trim(partes[1])<>'' and trim(partes[2])<>'' then return trim(partes[2])||' '||trim(partes[1]);end if;
 end if;
 palabras:=regexp_split_to_array(trim(nombre_original),'\s+');
 if array_length(palabras,1)<3 or correo is null then return nombre_original;end if;
 normalizadas:=regexp_split_to_array(translate(lower(trim(nombre_original)),'áéíóúüñ','aeiouun'),'\s+');
 usuario:=split_part(lower(correo),'@',1);
 if usuario=normalizadas[3]||normalizadas[1]||left(normalizadas[2],1) then
  return array_to_string(palabras[3:array_length(palabras,1)],' ')||' '||palabras[1]||' '||palabras[2];
 end if;
 return nombre_original;
end; $$;
create or replace function public.ordenar_nombre_estudiante()
returns trigger language plpgsql set search_path=public as $$
begin new.nombre:=public.nombre_primero(new.nombre,new.email);return new;end; $$;
drop trigger if exists a_ordenar_nombre_estudiante on public.estudiantes;
create trigger a_ordenar_nombre_estudiante before insert or update of nombre,email on public.estudiantes for each row execute function public.ordenar_nombre_estudiante();
update public.estudiantes set nombre=public.nombre_primero(nombre,email) where nombre is distinct from public.nombre_primero(nombre,email);
update public.perfiles p set nombre=e.nombre from public.estudiantes e where e.auth_user_id=p.id and p.rol='estudiante' and p.nombre is distinct from e.nombre;
-- La cuenta familiar puede elegir únicamente el tratamiento de su propio hijo.
create or replace function public.acudiente_tratamiento(valor text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if valor is null or valor not in('hijo','hija') then raise exception 'Escoge Mi hijo o Mi hija.';end if;
 update public.estudiantes s set tratamiento_familiar=valor from public.acudientes a where a.estudiante_id=s.id and a.auth_user_id=auth.uid() and s.activo;
 if not found then raise exception 'No hay un estudiante activo vinculado.';end if;
end; $$;
revoke all on function public.acudiente_tratamiento(text) from public,anon;
grant execute on function public.acudiente_tratamiento(text) to authenticated;
-- Envolver el contexto conserva las restricciones de privacidad y todos sus datos.
do $$ begin
 if to_regprocedure('public.acudiente_contexto_base()') is null then
  alter function public.acudiente_contexto() rename to acudiente_contexto_base;
 end if;
end; $$;
revoke all on function public.acudiente_contexto_base() from public,anon,authenticated;
create or replace function public.acudiente_contexto()
returns jsonb language plpgsql security definer set search_path=public as $$
declare datos jsonb;tratamiento text;
begin
 datos:=public.acudiente_contexto_base();
 select s.tratamiento_familiar into tratamiento from public.estudiantes s join public.acudientes a on a.estudiante_id=s.id where a.auth_user_id=auth.uid() and s.activo;
 return jsonb_set(datos,'{estudiante,tratamiento_familiar}',coalesce(to_jsonb(tratamiento),'null'::jsonb));
end; $$;
revoke all on function public.acudiente_contexto() from public,anon;
grant execute on function public.acudiente_contexto() to authenticated;
commit;
