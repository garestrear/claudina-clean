-- Ejecutar UNA VEZ antes de habilitar la carga masiva desde Excel.
-- Conserva los registros históricos del grupo 7-8 y separa los nuevos grados.
alter table public.estudiantes drop constraint if exists estudiantes_grado_check;
alter table public.estudiantes add constraint estudiantes_grado_check check (grado between 1 and 8);
alter table public.registros_aseo drop constraint if exists registros_aseo_grupo_check;
alter table public.registros_aseo add constraint registros_aseo_grupo_check
  check (grupo in ('1','2','3','4','5','6','7','8','7-8'));

-- Ajustar las políticas que antes solo reconocían los grupos 6 y 7-8.
drop policy if exists "crear valoracion estudiante activo" on public.valoraciones;
create policy "crear valoracion estudiante activo" on public.valoraciones
for insert to authenticated with check (autor=auth.uid() and exists (
 select 1 from public.estudiantes e join public.registros_aseo r on r.id=registro_id
 where e.auth_user_id=auth.uid() and e.activo
   and (r.grupo=e.grado::text or (e.grado in (7,8) and r.grupo='7-8'))
   and r.fecha between timezone('America/Bogota',now())::date-4
                   and timezone('America/Bogota',now())::date-1
));
drop policy if exists "editar valoracion estudiante activo" on public.valoraciones;
create policy "editar valoracion estudiante activo" on public.valoraciones
for update to authenticated using (autor=auth.uid()) with check (autor=auth.uid() and exists (
 select 1 from public.estudiantes e join public.registros_aseo r on r.id=registro_id
 where e.auth_user_id=auth.uid() and e.activo
   and (r.grupo=e.grado::text or (e.grado in (7,8) and r.grupo='7-8'))
   and r.fecha between timezone('America/Bogota',now())::date-4
                   and timezone('America/Bogota',now())::date-1
));
drop policy if exists "crear reporte estudiante activo" on public.reportes;
create policy "crear reporte estudiante activo" on public.reportes
for insert to authenticated with check (
 autor=auth.uid() and estado='pendiente' and exists (
  select 1 from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo
    and (registro_id is null or exists (
      select 1 from public.registros_aseo r where r.id=registro_id
        and (r.grupo=e.grado::text or (e.grado in (7,8) and r.grupo='7-8'))))
  )
);

-- Importación atómica, accesible solamente para administradores docentes.
create or replace function public.importar_estudiantes(filas jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare fila jsonb; v_correo text; v_nombre text; grado_n int; ficha_id uuid;
  creados int:=0; actualizados int:=0;
begin
 if not public.es_profesor() then raise exception 'Solo profesores administradores pueden importar estudiantes'; end if;
 if jsonb_typeof(filas)<>'array' or jsonb_array_length(filas) not between 1 and 500 then
   raise exception 'Se requieren entre 1 y 500 filas'; end if;
 if exists (select 1 from jsonb_array_elements(filas) as x(value)
   group by lower(trim(x.value->>'email')) having count(*)>1) then
   raise exception 'Hay correos repetidos en el archivo'; end if;
 if exists (select 1 from jsonb_array_elements(filas) as x(value)
   where nullif(x.value->>'id','') is not null
   group by x.value->>'id' having count(*)>1) then
   raise exception 'Una ficha existente aparece más de una vez'; end if;
 -- Se valida el lote completo antes de modificar cualquier ficha.
 for fila in select value from jsonb_array_elements(filas) loop
   v_nombre:=trim(fila->>'nombre'); v_correo:=lower(trim(fila->>'email'));
   if v_nombre is null or length(v_nombre)<3 or v_correo is null or v_correo !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$'
      or (fila->>'grado') !~ '^[1-8]$' then
     raise exception 'Fila inválida: nombre, correo y grado (1–8) son obligatorios'; end if;
   ficha_id:=nullif(fila->>'id','')::uuid;
   if ficha_id is not null and not exists(select 1 from public.estudiantes where id=ficha_id) then
     raise exception 'La ficha seleccionada ya no existe: %',ficha_id; end if;
   if exists(select 1 from public.estudiantes where email=v_correo and id is distinct from ficha_id) then
     raise exception 'Correo ya asignado a otro estudiante: %',v_correo; end if;
 end loop;
 for fila in select value from jsonb_array_elements(filas) loop
   v_nombre:=trim(fila->>'nombre'); v_correo:=lower(trim(fila->>'email'));
   grado_n:=(fila->>'grado')::int; ficha_id:=nullif(fila->>'id','')::uuid;
   if ficha_id is null then
     insert into public.estudiantes(nombre,grado,email) values(v_nombre,grado_n,v_correo);
     creados:=creados+1;
   else
     update public.estudiantes set nombre=v_nombre,grado=grado_n,email=v_correo where id=ficha_id;
     actualizados:=actualizados+1;
   end if;
 end loop;
 return jsonb_build_object('creados',creados,'actualizados',actualizados);
end; $$;
revoke all on function public.importar_estudiantes(jsonb) from public;
grant execute on function public.importar_estudiantes(jsonb) to authenticated;
