-- Ejecutar completo DESPUÉS de nombres-y-tratamiento.sql. Repetible.
begin;
alter table public.estudiantes add column if not exists genero text;
alter table public.estudiantes drop constraint if exists estudiantes_genero_valido;
alter table public.estudiantes add constraint estudiantes_genero_valido check(genero in('M','F','NB'));
-- Conservar las elecciones que ya habían hecho las familias.
update public.estudiantes set genero=case tratamiento_familiar when 'hijo' then 'M' when 'hija' then 'F' end where genero is null and tratamiento_familiar is not null;
create or replace function public.estudiante_genero(ficha uuid,valor text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Ingresa a tu cuenta.';end if;
 if valor is not null and valor not in('M','F','NB') then raise exception 'Selecciona M, F o NB.';end if;
 update public.estudiantes s set genero=valor,tratamiento_familiar=case valor when 'M' then 'hijo' when 'F' then 'hija' end
 where s.id=ficha and (
  public.es_profesor() or (s.activo and (s.auth_user_id=auth.uid() or exists(select 1 from public.acudientes a where a.estudiante_id=s.id and a.auth_user_id=auth.uid())))
 );
 if not found then raise exception 'No puedes modificar esta ficha.';end if;
end; $$;
revoke all on function public.estudiante_genero(uuid,text) from public,anon;
grant execute on function public.estudiante_genero(uuid,text) to authenticated;
-- Compatibilidad con una sesión familiar que conserve la versión anterior.
create or replace function public.acudiente_tratamiento(valor text)
returns void language plpgsql security definer set search_path=public as $$
declare ficha uuid;
begin
 if valor is null or valor not in('hijo','hija') then raise exception 'Escoge Mi hijo o Mi hija.';end if;
 select estudiante_id into ficha from public.acudientes where auth_user_id=auth.uid();
 perform public.estudiante_genero(ficha,case valor when 'hijo' then 'M' else 'F' end);
end; $$;
create or replace function public.acudiente_contexto()
returns jsonb language plpgsql security definer set search_path=public as $$
declare datos jsonb;estudiante public.estudiantes;
begin
 datos:=public.acudiente_contexto_base();
 select s.* into estudiante from public.estudiantes s join public.acudientes a on a.estudiante_id=s.id where a.auth_user_id=auth.uid() and s.activo;
 datos:=jsonb_set(datos,'{estudiante,genero}',coalesce(to_jsonb(estudiante.genero),'null'::jsonb));
 return jsonb_set(datos,'{estudiante,tratamiento_familiar}',coalesce(to_jsonb(estudiante.tratamiento_familiar),'null'::jsonb));
end; $$;
revoke all on function public.acudiente_contexto() from public,anon;
grant execute on function public.acudiente_contexto() to authenticated;
commit;
