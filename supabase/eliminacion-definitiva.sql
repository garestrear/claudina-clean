-- Ejecutar una vez en Supabase SQL Editor. Las funciones comprueban el rol del profesor
-- y borran las relaciones en una sola transacción.
create or replace function public.eliminar_estudiante_definitivamente(ficha uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare rutas text[];
begin
  if not public.es_profesor() then raise exception 'Solo profesores pueden borrar estudiantes'; end if;
  if not exists(select 1 from public.estudiantes where id=ficha) then raise exception 'Estudiante no encontrado'; end if;
  select coalesce(array_agg(path),array[]::text[]) into rutas
    from public.evidencias_aseo_estudiante where estudiante_id=ficha;
  delete from public.evidencias_aseo_estudiante where estudiante_id=ficha;
  delete from public.asignaciones where estudiante_id=ficha;
  delete from public.participaciones where estudiante_id=ficha;
  delete from public.estudiantes where id=ficha;
  return rutas;
end $$;
create or replace function public.eliminar_registro_definitivamente(registro uuid)
returns text[] language plpgsql security definer set search_path = '' as $$
declare rutas text[];
begin
  if not public.es_profesor() then raise exception 'Solo profesores pueden borrar registros'; end if;
  if not exists(select 1 from public.registros_aseo where id=registro) then raise exception 'Registro no encontrado'; end if;
  select coalesce(array_agg(path),array[]::text[]) into rutas
    from public.evidencias where registro_id=registro;
  -- Los reportes estudiantiles conservan su texto y quedan desvinculados.
  update public.reportes set registro_id=null where registro_id=registro;
  delete from public.registros_aseo where id=registro;
  return rutas;
end $$;
revoke all on function public.eliminar_estudiante_definitivamente(uuid) from public;
revoke all on function public.eliminar_registro_definitivamente(uuid) from public;
grant execute on function public.eliminar_estudiante_definitivamente(uuid) to authenticated;
grant execute on function public.eliminar_registro_definitivamente(uuid) to authenticated;
