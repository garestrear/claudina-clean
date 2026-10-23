-- Ejecutar completo después de ingles-crear-canciones.sql e ingles-respuestas-automaticas.sql.
-- Conserva actividades, audios, intentos y puntajes.
begin;
alter table public.ingles_actividades add column if not exists comentario text not null default '' check(length(comentario)<=600);
create or replace function public.ingles_editar_comentario(actividad text,comentario_cancion text)
returns void language plpgsql security definer set search_path='' as $$
declare ruta text;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden editar comentarios';end if;
 if comentario_cancion is null or length(comentario_cancion)>600 then raise exception 'El comentario admite hasta 600 caracteres';end if;
 select audio into ruta from public.ingles_actividades where id=actividad;
 if ruta is null then raise exception 'Canción no encontrada';end if;
 update public.ingles_actividades set comentario=trim(comentario_cancion),updated_at=now() where audio=ruta;
end;
$$;
create or replace function public.ingles_crear_actividad_con_comentario(identificador uuid,titulo_cancion text,letra_marcada text,ruta_audio text,grados_destino integer[],comentario_cancion text)
returns text language plpgsql security definer set search_path='' as $$
declare existente boolean;nuevo text;anterior text;
begin
 if not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden agregar canciones';end if;
 if identificador is null or comentario_cancion is null or length(comentario_cancion)>600 then raise exception 'El comentario admite hasta 600 caracteres';end if;
 perform pg_advisory_xact_lock(hashtextextended(identificador::text,0));
 select exists(select 1 from public.ingles_actividades where id='cancion-'||identificador::text) into existente;
 nuevo:=public.ingles_crear_actividad(identificador,titulo_cancion,letra_marcada,ruta_audio,grados_destino);
 select comentario into anterior from public.ingles_actividades where id=nuevo for update;
 if existente and anterior is distinct from trim(comentario_cancion) then raise exception 'El comentario ya cambió. Revisa la canción publicada antes de volver a enviar';end if;
 if not existente then perform public.ingles_editar_comentario(nuevo,comentario_cancion);end if;
 return nuevo;
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
  'modo_actividad',a.modo_actividad,'duracion_audio',a.duracion_audio,'sincronizacion',a.sincronizacion,'comentario',a.comentario,'id',a.id,'titulo',a.titulo,'instrucciones',a.instrucciones,'audio',a.audio,
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
revoke all on function public.ingles_editar_comentario(text,text),public.ingles_crear_actividad_con_comentario(uuid,text,text,text,integer[],text),public.ingles_contexto() from public,anon;
grant execute on function public.ingles_editar_comentario(text,text),public.ingles_crear_actividad_con_comentario(uuid,text,text,text,integer[],text),public.ingles_contexto() to authenticated;
notify pgrst,'reload schema';
commit;
