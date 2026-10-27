-- Ejecutar completo en Supabase SQL Editor. Conserva proyectos y permisos existentes.
begin;
alter table public.feria_proyectos add column if not exists poster_url text not null default '' check(length(poster_url)<=2000 and (poster_url='' or poster_url ~* '^https?://[^[:space:]]+$'));
-- Amplía la función instalada sin reemplazar las mejoras anteriores de equipos y revisión.
do $migration$
declare definicion text;
begin
 select pg_get_functiondef('public.feria_guardar(uuid,jsonb,integer,boolean,uuid)'::regprocedure) into definicion;
 if position('poster_url' in definicion)=0 then
  if position('update public.feria_proyectos set ' in definicion)=0 or position('apoyo,bibliografia,estado,ultimo_guardado)' in definicion)=0 or position('if datos-array[' in definicion)=0 then
   raise exception 'La función feria_guardar cambió. No se aplicaron cambios; revisa su definición antes de actualizar.';
  end if;
  definicion:=replace(definicion,'if datos-array[','if datos-array[''poster_url'',');
  definicion:=replace(definicion,'update public.feria_proyectos set ','update public.feria_proyectos set poster_url=case when datos?''poster_url'' then trim(datos->>''poster_url'') else poster_url end,');
  definicion:=replace(definicion,'apoyo,bibliografia,estado,ultimo_guardado)','apoyo,bibliografia,poster_url,estado,ultimo_guardado)');
  definicion:=replace(definicion,'coalesce(trim(datos->>''bibliografia''),''''),case when enviar','coalesce(trim(datos->>''bibliografia''),''''),coalesce(trim(datos->>''poster_url''),''''),case when enviar');
  definicion:=replace(definicion,'if datos?''bibliografia'' and',E'if datos?''poster_url'' and (jsonb_typeof(datos->''poster_url'') is distinct from ''string'' or length(datos->>''poster_url'')>2000 or (trim(datos->>''poster_url'')<>'''' and trim(datos->>''poster_url'')!~* ''^https?://[^[:space:]]+$'')) then raise exception ''Revisa el enlace al póster: usa http:// o https:// (máximo 2000 caracteres)'';end if;\n if datos?''bibliografia'' and');
  execute definicion;
 end if;
 -- Los proyectos externos almacenan los campos en JSON; conservar el enlace al normalizarlos.
 if to_regprocedure('public.feria_externa_guardar(uuid,jsonb,integer,boolean,uuid)') is not null then
  select pg_get_functiondef('public.feria_externa_guardar(uuid,jsonb,integer,boolean,uuid)'::regprocedure) into definicion;
  if position('poster_url' in definicion)=0 then
   if position('foreach campo in array array[' in definicion)=0 then raise exception 'Revisa la definición de feria_externa_guardar antes de actualizar';end if;
   definicion:=replace(definicion,'foreach campo in array array[','foreach campo in array array[''poster_url'',');
   definicion:=replace(definicion,'d:=d||jsonb_build_object(campo,trim(coalesce(datos->>campo,'''')));',E'if campo=''poster_url'' and (length(coalesce(datos->>campo,''''))>2000 or (trim(coalesce(datos->>campo,''''))<>'''' and trim(datos->>campo)!~* ''^https?://[^[:space:]]+$'')) then raise exception ''Revisa el enlace al póster: usa http:// o https:// (máximo 2000 caracteres)'';end if;\n  d:=d||jsonb_build_object(campo,trim(coalesce(datos->>campo,'''')));');
   execute definicion;
  end if;
 end if;
end $migration$;
notify pgrst,'reload schema';
commit;
