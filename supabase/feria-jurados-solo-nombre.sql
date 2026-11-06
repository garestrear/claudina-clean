-- Ejecutar después de feria-jurados-editar-eliminar.sql.
-- Solo el nombre es obligatorio. El acceso sigue usando las cuentas de jurados.
begin;
alter table public.feria_jurados alter column correo drop not null;
alter table public.feria_jurados alter column institucion set default '';
alter table public.feria_jurados alter column profesion set default '';
alter table public.feria_jurados alter column telefono set default '';
create or replace function public.feria_jurado_habilitar(persona uuid,datos jsonb,habilitar boolean)
returns void language plpgsql security definer set search_path='' as $$
declare correo_n text;usuario uuid;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden habilitar jurados';end if;
 perform pg_advisory_xact_lock(20261106,333);
 datos:=jsonb_build_object('areas','[]'::jsonb,'conflictos','[]'::jsonb)||datos;
 correo_n:=nullif(lower(trim(datos->>'correo')),'');
 if habilitar is null or persona is null or (correo_n is not null and correo_n!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') or length(correo_n)>254 or length(trim(coalesce(datos->>'nombre','')))<2 or length(datos->>'nombre')>150 or length(coalesce(datos->>'institucion',''))>150 or length(coalesce(datos->>'profesion',''))>150 or length(coalesce(datos->>'telefono',''))>50 then raise exception 'Completa un nombre válido y revisa el correo si lo incluyes';end if;
 if jsonb_typeof(datos->'areas') is distinct from 'array' or jsonb_typeof(datos->'conflictos') is distinct from 'array' then raise exception 'Áreas y conflictos no válidos';end if;
 if jsonb_array_length(datos->'conflictos')>500 or exists(select 1 from jsonb_array_elements_text(datos->'areas')a where a not in('science','technology','engineering','arts','mathematics','emprendimiento')) then raise exception 'Áreas o conflictos no válidos';end if;
 if exists(select 1 from public.feria_evaluacion_visitas v join public.feria_evaluaciones e on e.visita_id=v.id where v.jurado_id=persona and (not habilitar or (v.origen||':'||v.proyecto_id)=any(array(select jsonb_array_elements_text(datos->'conflictos'))))) then raise exception 'Conserva las visitas que ya tienen notas o borrador; no puedes deshabilitar al jurado ni añadirles un conflicto';end if;
 if exists(select 1 from public.feria_jurados where id=persona and lower(trim(correo)) is distinct from correo_n) then raise exception 'No se puede cambiar el correo del jurado; registra otra cuenta';end if;
 insert into public.feria_jurados(id,nombre,correo,institucion,profesion,telefono,habilitado,areas,conflictos)
 values(persona,trim(datos->>'nombre'),correo_n,coalesce(datos->>'institucion',''),coalesce(datos->>'profesion',''),coalesce(datos->>'telefono',''),habilitar,array(select jsonb_array_elements_text(datos->'areas')),array(select jsonb_array_elements_text(datos->'conflictos')))
 on conflict(id) do update set nombre=excluded.nombre,institucion=excluded.institucion,profesion=excluded.profesion,telefono=excluded.telefono,habilitado=excluded.habilitado,areas=excluded.areas,conflictos=excluded.conflictos;
 update public.feria_evaluacion_config set version=version+1 where id=true;
end $$;


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
 correo_n:=nullif(lower(trim(datos->>'correo')),'');
 if length(trim(coalesce(datos->>'nombre','')))<2 or (correo_n is not null and correo_n !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') then raise exception 'Completa un nombre válido y revisa el correo si lo incluyes';end if;
 if j.correo is not null and correo_n is distinct from lower(trim(j.correo)) and (j.cuenta_id is not null or exists(select 1 from auth.users u where lower(trim(u.email))=lower(trim(j.correo))) or exists(select 1 from public.feria_evaluacion_visitas v join public.feria_evaluaciones e on e.visita_id=v.id where v.jurado_id=j.id)) then raise exception 'Este correo está vinculado a un acceso o evaluación. Puedes editar los demás datos';end if;
 if exists(select 1 from public.feria_jurados where lower(trim(correo))=correo_n and id<>persona) then raise exception 'Ya existe otro jurado con ese correo';end if;
 update public.feria_jurados set nombre=trim(datos->>'nombre'),correo=correo_n,institucion=trim(coalesce(datos->>'institucion','')),profesion=trim(coalesce(datos->>'profesion','')),telefono=trim(coalesce(datos->>'telefono','')) where id=persona;
 if to_regclass('public.feria_participantes') is not null then
  execute 'update public.feria_participantes set nombre=$1,institucion=$2,detalle=$3 where jurado_id=$4' using trim(datos->>'nombre'),trim(coalesce(datos->>'institucion','')),trim(coalesce(datos->>'profesion','')),persona;
 end if;
 if correo_n is distinct from lower(trim(j.correo)) then perform public.feria_asignar_jurados_interno();end if;
end $$;

create or replace function public.feria_jurado_postular(datos jsonb, acepta boolean)
returns void language plpgsql security definer set search_path='' as $$
declare campo text;valor text;limite integer;correo_n text;
begin
 if acepta is distinct from true then raise exception 'Se requiere autorización';end if;
 if jsonb_typeof(datos) is distinct from 'object' then raise exception 'Datos inválidos';end if;
 if length(trim(coalesce(datos->>'nombre','')))<2 then raise exception 'Completa el nombre';end if;
 foreach campo in array array['nombre','institucion','profesion','correo','telefono'] loop
  valor:=trim(coalesce(datos->>campo,''));limite:=case when campo='correo' then 254 when campo='telefono' then 50 else 150 end;
  if length(valor)>limite then raise exception 'El campo % es demasiado largo',campo;end if;
 end loop;
 correo_n:=nullif(lower(trim(datos->>'correo')),'');
 if correo_n is not null and correo_n !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo inválido';end if;
 if length(trim(coalesce(datos->>'telefono','')))>0 and trim(datos->>'telefono') !~ '^[+0-9() .-]{7,50}$' then raise exception 'Teléfono inválido';end if;
 insert into public.feria_jurados(nombre,institucion,profesion,correo,telefono)
 values(trim(datos->>'nombre'),trim(coalesce(datos->>'institucion','')),trim(coalesce(datos->>'profesion','')),correo_n,trim(coalesce(datos->>'telefono',''))) on conflict(correo) do nothing;
end $$;
revoke all on function public.feria_jurado_postular(jsonb,boolean) from public;
grant execute on function public.feria_jurado_postular(jsonb,boolean) to anon,authenticated;
notify pgrst,'reload schema';
commit;
