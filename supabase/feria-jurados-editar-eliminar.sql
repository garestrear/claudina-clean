-- Ejecutar después de feria-jurados-asignacion-automatica.sql.
begin;
alter table public.feria_jurados add column if not exists eliminado_en timestamptz;
create or replace function public.feria_jurado_editar(persona uuid,datos jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare j public.feria_jurados;correo_n text;campo text;limite integer;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden editar jurados';end if;
 perform pg_advisory_xact_lock(20261106,333);
 select * into j from public.feria_jurados where id=persona and eliminado_en is null for update;
 if j.id is null then raise exception 'El jurado ya no está disponible. Actualiza la lista';end if;
 if jsonb_typeof(datos) is distinct from 'object' then raise exception 'Datos inválidos';end if;
 foreach campo in array array['nombre','institucion','profesion','correo','telefono'] loop
  limite:=case when campo='correo' then 254 when campo='telefono' then 50 else 150 end;
  if length(trim(coalesce(datos->>campo,'')))>limite then raise exception 'El campo % es demasiado largo',campo;end if;
 end loop;
 correo_n:=lower(trim(datos->>'correo'));
 if length(trim(coalesce(datos->>'nombre','')))<2 or correo_n is null or correo_n !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Completa nombre y correo válidos';end if;
 if correo_n<>lower(trim(j.correo)) and (j.cuenta_id is not null or exists(select 1 from auth.users u where lower(trim(u.email))=lower(trim(j.correo))) or exists(select 1 from public.feria_evaluacion_visitas v join public.feria_evaluaciones e on e.visita_id=v.id where v.jurado_id=j.id)) then raise exception 'Este correo está vinculado a un acceso o evaluación. Puedes editar los demás datos';end if;
 if exists(select 1 from public.feria_jurados where lower(trim(correo))=correo_n and id<>persona) then raise exception 'Ya existe otro jurado con ese correo';end if;
 update public.feria_jurados set nombre=trim(datos->>'nombre'),correo=correo_n,institucion=trim(coalesce(datos->>'institucion','')),profesion=trim(coalesce(datos->>'profesion','')),telefono=trim(coalesce(datos->>'telefono','')) where id=persona;
 if to_regclass('public.feria_participantes') is not null then
  execute 'update public.feria_participantes set nombre=$1,institucion=$2,detalle=$3 where jurado_id=$4' using trim(datos->>'nombre'),trim(coalesce(datos->>'institucion','')),trim(coalesce(datos->>'profesion','')),persona;
 end if;
 if correo_n<>lower(trim(j.correo)) then perform public.feria_asignar_jurados_interno();end if;
end $$;

-- Retiro recuperable: conserva el registro y las evaluaciones históricas.
create or replace function public.feria_jurado_eliminar(persona uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden eliminar jurados';end if;
 perform pg_advisory_xact_lock(20261106,333);
 update public.feria_jurados set eliminado_en=now(),habilitado=false where id=persona and eliminado_en is null;
 if not found then raise exception 'El jurado ya no está disponible. Actualiza la lista';end if;
 -- El trigger redistribuye las visitas sin notas y conserva las evaluadas.
 if to_regclass('public.feria_participantes') is not null then
  execute 'update public.feria_participantes set activo=false where jurado_id=$1' using persona;
 end if;
end $$;
revoke all on function public.feria_jurado_editar(uuid,jsonb),public.feria_jurado_eliminar(uuid) from public,anon;
grant execute on function public.feria_jurado_editar(uuid,jsonb),public.feria_jurado_eliminar(uuid) to authenticated;

-- Oculta retirados de las listas; el historial conserva su identidad.
do $$declare d text;begin
 select pg_get_functiondef('public.feria_evaluacion_contexto()'::regprocedure) into d;
 if position('eliminado_en' in d)=0 then
  d:=replace(d,'lower(trim(j.correo)))x)','lower(trim(j.correo)) where j.eliminado_en is null)x)');
  execute d;
 end if;
 select pg_get_functiondef('public.feria_evaluacion_contexto()'::regprocedure) into d;
 if position('jurados_retirados' in d)=0 then
  d:=replace(d,'''visitas'',coalesce','''jurados_retirados'',case when docente then (select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''nombre'',nombre)),''[]''::jsonb) from public.feria_jurados where eliminado_en is not null) else ''[]''::jsonb end,''visitas'',coalesce');execute d;
 end if;
 if to_regprocedure('public.feria_sincronizar_jurados_profesores()') is not null then
  select pg_get_functiondef('public.feria_sincronizar_jurados_profesores()'::regprocedure) into d;
  d:=replace(d,'from public.feria_jurados order by id','from public.feria_jurados where eliminado_en is null order by id');execute d;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
