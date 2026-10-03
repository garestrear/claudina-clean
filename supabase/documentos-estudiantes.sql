-- Claudina Clean: documento y actualización de estudiantes desde Excel.
-- Ejecutar completo en Supabase > SQL Editor. Puede repetirse.
begin;
alter table public.estudiantes add column if not exists documento text;
alter table public.estudiantes drop constraint if exists estudiantes_documento_formato;
alter table public.estudiantes add constraint estudiantes_documento_formato
 check(documento is null or (documento=upper(trim(documento)) and documento ~ '^[A-Z0-9-]{3,30}$'));
create unique index if not exists estudiantes_documento_unico on public.estudiantes(documento) where documento is not null;

create or replace function public.importar_estudiantes(filas jsonb)
returns jsonb language plpgsql security definer set search_path=public,auth,pg_temp as $$
declare fila jsonb;v_correo text;v_nombre text;v_documento text;grado_n integer;ficha_id uuid;
 resueltas jsonb:='[]'::jsonb;solo_documento boolean;creados integer:=0;actualizados integer:=0;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo profesores administradores pueden importar estudiantes.';end if;
 if jsonb_typeof(filas) is distinct from 'array' then raise exception 'Se requieren entre 1 y 500 filas.';end if;
 if jsonb_array_length(filas) not between 1 and 500 then raise exception 'Se requieren entre 1 y 500 filas.';end if;
 -- Serializar cargas para que todas sus validaciones correspondan al mismo lote.
 perform pg_advisory_xact_lock(824601);
 if exists(select 1 from jsonb_array_elements(filas)x group by lower(trim(x->>'email')) having count(*)>1) then raise exception 'Hay correos repetidos en el archivo.';end if;
 if exists(select 1 from jsonb_array_elements(filas)x where nullif(trim(x->>'documento'),'') is not null group by upper(trim(x->>'documento')) having count(*)>1) then raise exception 'Hay documentos repetidos en el archivo.';end if;
 for fila in select value from jsonb_array_elements(filas) loop
  v_nombre:=trim(fila->>'nombre');v_correo:=lower(trim(fila->>'email'));v_documento:=nullif(upper(trim(fila->>'documento')),'');
  solo_documento:=coalesce((fila->>'solo_documento')::boolean,false);
  if v_nombre is null or length(v_nombre)<3 or v_correo is null or v_correo !~ '^[^@ ]+@[^@ ]+\.[^@ ]+$' or coalesce(fila->>'grado','') !~ '^[1-8]$' then raise exception 'Fila inválida: revisa nombre, correo y grado (1–8).';end if;
  if v_documento is not null and v_documento !~ '^[A-Z0-9-]{3,30}$' then raise exception 'Documento inválido para %.',v_nombre;end if;
  ficha_id:=nullif(fila->>'id','')::uuid;
  if ficha_id is null then select id into ficha_id from public.estudiantes where email=v_correo;end if;
  if solo_documento and (ficha_id is null or v_documento is null) then raise exception 'Para actualizar documentos selecciona una ficha existente y un documento: %.',v_nombre;end if;
  if ficha_id is not null then
   perform 1 from public.estudiantes where id=ficha_id for update;
   if not found then raise exception 'La ficha seleccionada ya no existe: %.',v_nombre;end if;
  end if;
  if exists(select 1 from public.estudiantes where email=v_correo and id is distinct from ficha_id) then raise exception 'Correo ya asignado a otro estudiante: %.',v_correo;end if;
  if v_documento is not null and exists(select 1 from public.estudiantes where documento=v_documento and id is distinct from ficha_id) then raise exception 'El documento ya está asignado a otro estudiante: %.',v_nombre;end if;
  if ficha_id is not null and exists(select 1 from jsonb_array_elements(resueltas)x where x->>'id'=ficha_id::text) then raise exception 'Dos filas intentan actualizar la misma ficha: %.',v_nombre;end if;
  resueltas:=resueltas||jsonb_build_array(fila||jsonb_build_object('id',ficha_id));
 end loop;
 -- Una excepción revierte el lote completo, sin importaciones parciales.
 for fila in select value from jsonb_array_elements(resueltas) loop
  v_nombre:=trim(fila->>'nombre');v_correo:=lower(trim(fila->>'email'));grado_n:=(fila->>'grado')::integer;
  v_documento:=nullif(upper(trim(fila->>'documento')),'');ficha_id:=nullif(fila->>'id','')::uuid;
  solo_documento:=coalesce((fila->>'solo_documento')::boolean,false);
  if ficha_id is null then
   insert into public.estudiantes(nombre,grado,email,documento) values(v_nombre,grado_n,v_correo,v_documento);creados:=creados+1;
  elsif solo_documento then
   update public.estudiantes set documento=v_documento where id=ficha_id;actualizados:=actualizados+1;
  else
   update public.estudiantes set nombre=v_nombre,grado=grado_n,email=v_correo,documento=coalesce(v_documento,documento) where id=ficha_id;actualizados:=actualizados+1;
  end if;
 end loop;
 return jsonb_build_object('creados',creados,'actualizados',actualizados);
end;
$$;
revoke all on function public.importar_estudiantes(jsonb) from public,anon;
grant execute on function public.importar_estudiantes(jsonb) to authenticated;
commit;
