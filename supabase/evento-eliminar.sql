-- Ejecutar completo en Supabase SQL Editor. No elimina evaluaciones al instalar.
begin;
create or replace function public.evento_eliminar(evento uuid, confirmacion text, respuestas_esperadas bigint)
returns void language plpgsql security definer set search_path='' as $$
declare ficha public.eventos_evaluables; total bigint;
begin
 if auth.uid() is null or not public.es_profesor() then raise exception 'Solo docentes'; end if;
 select * into ficha from public.eventos_evaluables where id=evento for update;
 if ficha.id is null then raise exception 'La evaluación ya no existe. Actualiza la lista.'; end if;
 if confirmacion is distinct from ficha.titulo then raise exception 'El título no coincide. Revisa la evaluación antes de eliminarla.'; end if;
 select count(*) into total from public.evento_respuestas where evento_id=evento;
 if respuestas_esperadas is null or respuestas_esperadas<>total then
  raise exception 'La cantidad de respuestas cambió. Cancela, actualiza la lista y confirma nuevamente.';
 end if;
 -- Las claves foráneas eliminan respuestas y participantes del mismo evento.
 delete from public.eventos_evaluables where id=evento;
end $$;
revoke all on function public.evento_eliminar(uuid,text,bigint) from public,anon;
grant execute on function public.evento_eliminar(uuid,text,bigint) to authenticated;
commit;
