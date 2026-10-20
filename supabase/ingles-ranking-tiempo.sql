-- Ejecutar completo después de ingles-musica.sql. Repetible; conserva intentos.
-- Los resultados históricos sin tiempo medido muestran «Sin registro».
begin;
alter table public.ingles_progreso add column if not exists mejor_tiempo_segundos numeric;
alter table public.ingles_progreso add column if not exists mejor_logrado_at timestamptz;
create table if not exists public.ingles_intentos_tiempo (
 solicitud_id uuid primary key,
 usuario_id uuid not null references public.perfiles(id) on delete cascade,
 actividad_id text not null references public.ingles_actividades(id) on delete cascade,
 iniciada_at timestamptz not null default clock_timestamp(),
 finalizada_at timestamptz
);
alter table public.ingles_intentos_tiempo enable row level security;
revoke all on public.ingles_intentos_tiempo from anon,authenticated;
create or replace function public.ingles_iniciar_intento(actividad text,solicitud uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or coalesce(public.es_profesor(),false) or solicitud is null then raise exception 'Ingresa como estudiante';end if;
 if not exists(select 1 from public.estudiantes e join public.ingles_actividades a on a.id=actividad where e.auth_user_id=auth.uid() and e.activo and a.publicada and e.grado=any(a.grados)) then raise exception 'Actividad no disponible';end if;
 insert into public.ingles_intentos_tiempo(solicitud_id,usuario_id,actividad_id) values(solicitud,auth.uid(),actividad) on conflict(solicitud_id) do nothing;
 if not exists(select 1 from public.ingles_intentos_tiempo where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad) then raise exception 'Intento no válido';end if;
end;
$$;
create or replace function public.ingles_responder(actividad text,elecciones jsonb,solicitud uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.ingles_actividades;ficha public.estudiantes;correctas text[];revision jsonb:='{}'::jsonb;puntos integer:=0;cantidad integer;i integer;salida public.ingles_progreso;inicio timestamptz;duracion numeric;fecha timestamptz:=clock_timestamp();
begin
 if auth.uid() is null or coalesce(public.es_profesor(),false) then raise exception 'Ingresa como estudiante para guardar el intento';end if;
 select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
 select * into a from public.ingles_actividades where id=actividad for share;
 if ficha.id is null or a.id is null or not a.publicada or not(ficha.grado=any(a.grados)) then raise exception 'La actividad no está disponible para tu grado';end if;
 if solicitud is null or jsonb_typeof(elecciones) is distinct from 'object' or octet_length(elecciones::text)>10000 then raise exception 'Revisa tus respuestas';end if;
 select array_agg(m[1]) into correctas from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m;
 cantidad:=coalesce(array_length(correctas,1),0);
 if cantidad=0 or (select count(*) from jsonb_object_keys(elecciones))<>cantidad then raise exception 'Completa todos los espacios';end if;
 for i in 1..cantidad loop
  if jsonb_typeof(elecciones->i::text) is distinct from 'string' or length(trim(elecciones->>i::text))=0 or length(elecciones->>i::text)>80 then raise exception 'Completa todos los espacios';end if;
  revision:=revision||jsonb_build_object(i::text,public.ingles_normalizar(elecciones->>i::text)=public.ingles_normalizar(correctas[i]));
  if (revision->>i::text)::boolean then puntos:=puntos+1;end if;
 end loop;
 select iniciada_at,coalesce(finalizada_at,fecha) into inicio,fecha from public.ingles_intentos_tiempo where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad for update;
 if inicio is null then fecha:=clock_timestamp();end if;
 if exists(select 1 from public.ingles_intentos_tiempo t where t.solicitud_id=solicitud and t.finalizada_at is not null) and not exists(select 1 from public.ingles_progreso p where p.actividad_id=actividad and p.usuario_id=auth.uid() and p.solicitud_id=solicitud) then raise exception 'Inicia otro intento';end if;
 duracion:=case when inicio is not null then greatest(0,extract(epoch from (fecha-inicio))) end;
 insert into public.ingles_progreso as p(actividad_id,usuario_id,estudiante_id,respuestas,correccion,aciertos,total,mejor_aciertos,solicitud_id,mejor_tiempo_segundos,mejor_logrado_at)
 values(a.id,auth.uid(),ficha.id,elecciones,revision,puntos,cantidad,puntos,solicitud,duracion,case when duracion is not null then fecha end)
 on conflict(actividad_id,usuario_id) do update set respuestas=excluded.respuestas,correccion=excluded.correccion,aciertos=excluded.aciertos,total=excluded.total,intentos=p.intentos+1,mejor_aciertos=greatest(p.mejor_aciertos,excluded.aciertos),solicitud_id=excluded.solicitud_id,updated_at=now(),
 mejor_tiempo_segundos=case when excluded.aciertos>p.mejor_aciertos or (excluded.aciertos=p.mejor_aciertos and excluded.mejor_tiempo_segundos is not null and (p.mejor_tiempo_segundos is null or excluded.mejor_tiempo_segundos<p.mejor_tiempo_segundos)) then excluded.mejor_tiempo_segundos else p.mejor_tiempo_segundos end,
 mejor_logrado_at=case when excluded.aciertos>p.mejor_aciertos or (excluded.aciertos=p.mejor_aciertos and excluded.mejor_tiempo_segundos is not null and (p.mejor_tiempo_segundos is null or excluded.mejor_tiempo_segundos<p.mejor_tiempo_segundos)) then excluded.mejor_logrado_at else p.mejor_logrado_at end
 where p.solicitud_id<>excluded.solicitud_id returning * into salida;
 if salida.actividad_id is null then select * into salida from public.ingles_progreso where actividad_id=a.id and usuario_id=auth.uid();end if;
 update public.ingles_intentos_tiempo set finalizada_at=coalesce(finalizada_at,fecha) where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad;
 return to_jsonb(salida)-'usuario_id'-'estudiante_id'-'solicitud_id';
end;
$$;
create or replace function public.ingles_tabla_clasificacion(actividad text)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.puesto),'[]'::jsonb) from (
  select e.id,e.nombre,e.grado,p.intentos,p.aciertos,p.total,p.mejor_aciertos,
   round(100*p.mejor_aciertos::numeric/nullif(p.total,0),2) as puntos,
   p.mejor_tiempo_segundos,p.mejor_logrado_at,
   row_number() over(order by p.mejor_aciertos::numeric/nullif(p.total,0) desc nulls last,
    p.intentos asc,p.mejor_tiempo_segundos asc nulls last,p.mejor_logrado_at asc nulls last,e.id) as puesto
  from public.ingles_progreso p join public.estudiantes e on e.id=p.estudiante_id
  join public.ingles_actividades a on a.id=p.actividad_id
  where p.actividad_id=actividad and e.activo and e.grado=any(a.grados)
 ) r;
$$;
revoke all on function public.ingles_tabla_clasificacion(text) from public,anon,authenticated;
create or replace function public.ingles_clasificacion(actividad text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.estudiantes e join public.ingles_actividades a on a.id=actividad where e.auth_user_id=auth.uid() and e.activo and a.publicada and e.grado=any(a.grados)) then raise exception 'Clasificación no disponible para tu cuenta';end if;
 return (select coalesce(jsonb_agg(fila order by (fila->>'puesto')::integer),'[]'::jsonb) from jsonb_array_elements(public.ingles_tabla_clasificacion(actividad)) fila where (fila->>'puesto')::integer<=10);
end;
$$;
create or replace function public.ingles_resultados(actividad text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden consultar resultados';end if;
 return public.ingles_tabla_clasificacion(actividad);
end;
$$;
revoke all on function public.ingles_iniciar_intento(text,uuid),public.ingles_clasificacion(text),public.ingles_resultados(text) from public,anon;
grant execute on function public.ingles_iniciar_intento(text,uuid),public.ingles_clasificacion(text),public.ingles_resultados(text) to authenticated;
notify pgrst, 'reload schema';
commit;
