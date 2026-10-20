-- Soporte para actividades de elección entre dos palabras.
-- Ejecutar después de ingles-musica.sql. No agrega Imagine sin su ejercicio y audio.
-- Conserva todas las canciones, respuestas e intentos existentes.
begin;
alter table public.ingles_actividades add column if not exists opciones jsonb not null default '{}'::jsonb;
create or replace function public.ingles_contexto() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha public.estudiantes;salida jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if not docente then
  select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
  if ficha.id is null then raise exception 'Esta actividad es para estudiantes con ficha activa';end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'opciones',a.opciones,'id',a.id,'titulo',a.titulo,'instrucciones',a.instrucciones,'audio',a.audio,
  'contenido',regexp_replace(a.contenido,'\[\[[^]]+\]\]','_____','g'),
  'banco',case when a.banco then (select jsonb_agg(palabra order by palabra) from (select distinct m[1] palabra from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m) x) else '[]'::jsonb end,
  'banco_activo',a.banco,'publicada',a.publicada,'grados',a.grados,'updated_at',a.updated_at,
  'mi_progreso',(select to_jsonb(p)-'usuario_id'-'estudiante_id'-'solicitud_id' from public.ingles_progreso p where p.actividad_id=a.id and p.usuario_id=auth.uid()),
  'ultima_respuesta',case when docente then(select max(p.updated_at) from public.ingles_progreso p where p.actividad_id=a.id) else null end,
  'total_respuestas',case when docente then(select count(*) from public.ingles_progreso p where p.actividad_id=a.id) else null end
 ) order by a.titulo),'[]'::jsonb) into salida from public.ingles_actividades a where docente or(a.publicada and ficha.grado=any(a.grados));
 return salida;
end;
$$;

revoke all on function public.ingles_contexto() from public,anon;
grant execute on function public.ingles_contexto() to authenticated;
notify pgrst, 'reload schema';
commit;
