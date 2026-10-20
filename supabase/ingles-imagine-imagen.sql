-- Ejecutar completo en Supabase SQL Editor, después de ingles-musica.sql.
-- El MP3 se incluye en la app: no requiere crear un bucket ni subir archivos.
-- Actividad nueva: conserva otras actividades y sus intentos.
begin;
insert into public.ingles_actividades
(id,titulo,instrucciones,audio,contenido,grados,banco,publicada)
values (
'imagine-john-lennon-imagen',
'Imagine · John Lennon · Escucha y completa',
'Escucha la canción y completa los 26 espacios con las palabras del banco al inicio. Algunas palabras se usan más de una vez. Puedes pausar, repetir y volver a intentarlo.',
'/audio/imagine.mp3',
$letra$Imagine there's no [[heaven]]
It's easy if you [[try]]
No hell below [[us]]
Above us only [[sky]]
Imagine all the [[people]]
Living for [[today]]
Imagine there's no [[countries]]
It isn't hard to [[do]]
Nothing to kill or die [[for]]
And no religion [[too]]

Imagine all the [[people]]
Living life in [[peace]]
You may say that I'm a [[dreamer]]
But I'm not the only [[one]]
I hope someday you'll join [[us]]
And the world will be as [[one]]

Imagine no [[possessions]]
I wonder if you [[can]]
No need for greed or [[hunger]]
A brotherhood of [[man]]
Imagine all the [[people]]
Sharing all the [[world]]
You may say that I'm a [[dreamer]]
But I'm not the only [[one]]
I hope someday you'll join [[us]]
And the world will live as [[one]]$letra$,
array[6,7,8],true,true
) on conflict(id) do nothing;
notify pgrst, 'reload schema';
commit;
