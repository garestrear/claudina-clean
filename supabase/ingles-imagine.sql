-- 1. En Storage, crea un bucket PUBLICO llamado ingles-audio.
-- 2. Sube el MP3 proporcionado con el nombre imagine.mp3.
-- 3. Copia la URL publica del MP3 y reemplaza PEGA_AQUI_LA_URL_PUBLICA_DEL_AUDIO.
-- 4. Ejecuta este archivo completo en SQL Editor.
-- Requiere que supabase/ingles-musica.sql ya este activado.
begin;
do $url$
begin
 if 'PEGA_AQUI_LA_URL_PUBLICA_DEL_AUDIO' not like 'https://%' then
  raise exception 'Reemplaza PEGA_AQUI_LA_URL_PUBLICA_DEL_AUDIO por la URL publica del MP3 (en ambas apariciones)';
 end if;
end;
$url$;
do $validar$
begin
 if not exists(select 1 from storage.buckets where id='ingles-audio' and public) then
  raise exception 'Crea primero el bucket publico ingles-audio en Storage';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='ingles-audio' and name='imagine.mp3') then
  raise exception 'Sube primero el audio como imagine.mp3 al bucket ingles-audio';
 end if;
end;
$validar$;
insert into public.ingles_actividades
(id,titulo,instrucciones,audio,contenido,grados,banco,publicada)
values (
'imagine-john-lennon-facil',
'Imagine · John Lennon · Nivel fácil',
'Escucha la canción y escribe la palabra o expresión que falta. Usa cada elemento del banco una sola vez. Puedes pausar, repetir y volver a intentarlo.',
'PEGA_AQUI_LA_URL_PUBLICA_DEL_AUDIO',
$letra$Imagine there's no [[heaven]]
It's easy if you try
No hell below us
Above us only [[sky]]
Imagine all the people
Living for today

Imagine there's no countries
It isn't [[hard to do]]
Nothing to kill or die for
And no religion too
Imagine all the [[people]]
Living life in peace

You may say I'm a dreamer
But [[I'm not the only one]]
I hope someday you'll join us
And the world will be as one

[[Imagine]] no possessions
I wonder if you can
No need for greed or hunger
A brotherhood of [[man]]
Imagine all the people
Sharing all the world

You may say I'm a dreamer
[[But]] I'm not the only one
I hope someday you'll join us
And the world will live as one$letra$,
array[6,7,8],true,true
) on conflict(id) do nothing;
notify pgrst, 'reload schema';
commit;
