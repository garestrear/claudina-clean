-- Corrección específica del banco: una entrada por cada espacio, sin DISTINCT.
-- Ejecutar completo después de ingles-respuestas-automaticas.sql. No borra intentos.
begin;
alter table public.ingles_sesiones add column if not exists numero_intento integer;
create or replace function public.ingles_preparar(actividad text,solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.ingles_actividades;s public.ingles_sesiones;
begin
 if auth.uid() is null or solicitud is null then raise exception 'Inicia sesión';end if;
 select * into a from public.ingles_actividades where id=actividad for share;
 if a.id is null or (not coalesce(public.es_profesor(),false) and not exists(select 1 from public.estudiantes e where e.auth_user_id=auth.uid() and e.activo and a.publicada and e.grado=any(a.grados))) then raise exception 'Actividad no disponible';end if;
 if a.modo_actividad='evaluacion' and (a.duracion_audio is null or a.duracion_audio<=0) then raise exception 'El docente debe registrar la duración del audio';end if;
 insert into public.ingles_sesiones(solicitud_id,usuario_id,actividad_id,modo_actividad,duracion_audio,numero_intento) values(solicitud,auth.uid(),actividad,a.modo_actividad,a.duracion_audio,1+coalesce((select p.intentos from public.ingles_progreso p where p.usuario_id=auth.uid() and p.actividad_id=actividad),0)) on conflict do nothing;
 select * into s from public.ingles_sesiones where solicitud_id=solicitud and usuario_id=auth.uid() and actividad_id=actividad;
 if s.solicitud_id is null then raise exception 'Intento no válido';end if;
 if s.modo_actividad<>a.modo_actividad then raise exception 'El docente cambió el modo; inicia otro intento';end if;
 if not coalesce(public.es_profesor(),false) then perform public.ingles_iniciar_intento(actividad,solicitud);end if;
 if s.numero_intento is null then
  update public.ingles_sesiones set numero_intento=1+coalesce((select p.intentos from public.ingles_progreso p where p.usuario_id=auth.uid() and p.actividad_id=actividad),0) where solicitud_id=solicitud returning * into s;
 end if;
 return jsonb_build_object('modo',s.modo_actividad,'numero_intento',s.numero_intento,'banco',case when a.banco and (coalesce(public.es_profesor(),false) or s.numero_intento>=3) then (select jsonb_agg(m[1] order by m[1]) from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m) else '[]'::jsonb end);
end;
$$;
create or replace function public.ingles_contexto() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare docente boolean:=coalesce(public.es_profesor(),false);ficha public.estudiantes;salida jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if not docente then
  select * into ficha from public.estudiantes where auth_user_id=auth.uid() and activo limit 1;
  if ficha.id is null then raise exception 'Esta actividad es para estudiantes con ficha activa';end if;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'modo_actividad',a.modo_actividad,'duracion_audio',a.duracion_audio,'sincronizacion',a.sincronizacion,'id',a.id,'titulo',a.titulo,'instrucciones',a.instrucciones,'audio',a.audio,
  'contenido',regexp_replace(a.contenido,'\[\[[^]]+\]\]','_____','g'),
  'banco',case when a.banco and (docente or coalesce((select p.intentos from public.ingles_progreso p where p.actividad_id=a.id and p.usuario_id=auth.uid()),0)>=2) then (select jsonb_agg(palabra order by palabra) from (select m[1] palabra from regexp_matches(a.contenido,'\[\[([^]]+)\]\]','g') m) x) else '[]'::jsonb end,
  'banco_activo',a.banco,'publicada',a.publicada,'grados',a.grados,'updated_at',a.updated_at,
  'mi_progreso',(select to_jsonb(p)-'usuario_id'-'estudiante_id'-'solicitud_id' from public.ingles_progreso p where p.actividad_id=a.id and p.usuario_id=auth.uid()),
  'ultima_respuesta',case when docente then(select max(p.updated_at) from public.ingles_progreso p where p.actividad_id=a.id) else null end,
  'total_respuestas',case when docente then(select count(*) from public.ingles_progreso p where p.actividad_id=a.id) else null end
 ) order by a.titulo),'[]'::jsonb) into salida from public.ingles_actividades a where docente or(a.publicada and ficha.grado=any(a.grados));
 return salida;
end;
$$;

revoke all on function public.ingles_preparar(text,uuid),public.ingles_contexto() from public,anon;
grant execute on function public.ingles_preparar(text,uuid),public.ingles_contexto() to authenticated;
notify pgrst,'reload schema';
commit;
