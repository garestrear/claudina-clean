-- Ejecutar una vez en Supabase SQL Editor, después de ingles-musica.sql.
-- Habilita la creación desde Aprende Inglés para docentes autenticados.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ingles-audios','ingles-audios',true,26214400,array['audio/mpeg'])
on conflict(id) do update set public=true,file_size_limit=26214400,allowed_mime_types=array['audio/mpeg'];
drop policy if exists ingles_docente_subir on storage.objects;
create policy ingles_docente_subir on storage.objects for insert to authenticated
with check(bucket_id='ingles-audios' and coalesce(public.es_profesor(),false)
 and (storage.foldername(name))[1]=auth.uid()::text
 and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.mp3$');

create or replace function public.ingles_crear_actividad(
 identificador uuid,titulo_cancion text,letra_marcada text,ruta_audio text,grados_destino integer[]
) returns text language plpgsql security definer set search_path='' as $$
declare cantidad integer;limpia text;existente public.ingles_actividades;nuevo_id text;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden agregar canciones';end if;
 if identificador is null or titulo_cancion is null or length(trim(titulo_cancion)) not between 1 and 250
  or letra_marcada is null or length(letra_marcada) not between 1 and 25000 then raise exception 'Revisa el título y la letra';end if;
 if grados_destino is null or cardinality(grados_destino)=0 or cardinality(grados_destino)>3
  or array_position(grados_destino,null) is not null or not(grados_destino <@ array[6,7,8]) then raise exception 'Selecciona grados entre 6 y 8';end if;
 if ruta_audio is distinct from auth.uid()::text||'/'||identificador::text||'.mp3' then raise exception 'Ruta de audio inválida';end if;
 if not exists(select 1 from storage.objects where bucket_id='ingles-audios' and name=ruta_audio) then raise exception 'Carga primero el audio MP3';end if;
 select count(*) into cantidad from regexp_matches(letra_marcada,'\[\[([^]]+)\]\]','g');
 limpia:=regexp_replace(letra_marcada,'\[\[([^]]+)\]\]','','g');
 if cantidad not between 1 and 100 or limpia ~ '(\[\[|\]\]|_{3,})'
  or exists(select 1 from regexp_matches(letra_marcada,'\[\[([^]]+)\]\]','g') m where length(m[1])>80 or length(public.ingles_normalizar(m[1]))=0 or m[1] ~ '[\[\]\n\r]') then raise exception 'Marca entre 1 y 100 palabras válidas';end if;
 nuevo_id:='cancion-'||identificador::text;
 insert into public.ingles_actividades(id,titulo,instrucciones,audio,contenido,grados,banco,publicada)
 values(nuevo_id,trim(titulo_cancion),'Escucha la canción y completa los '||cantidad||' espacios con las palabras del banco. Algunas palabras se usan más de una vez. Puedes pausar y repetir.',
 'storage:ingles-audios/'||ruta_audio,letra_marcada,grados_destino,true,true)
 on conflict(id) do nothing;
 select * into existente from public.ingles_actividades where id=nuevo_id;
 if existente.audio is distinct from 'storage:ingles-audios/'||ruta_audio
  or existente.contenido is distinct from letra_marcada or existente.titulo is distinct from trim(titulo_cancion)
  or existente.grados is distinct from grados_destino then raise exception 'Esta solicitud ya publicó una versión distinta. Actualiza la página para crear otra canción';end if;
 return nuevo_id;
end;
$$;
revoke all on function public.ingles_crear_actividad(uuid,text,text,text,integer[]) from public,anon;
grant execute on function public.ingles_crear_actividad(uuid,text,text,text,integer[]) to authenticated;
notify pgrst,'reload schema';
commit;
