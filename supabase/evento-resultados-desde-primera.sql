create or replace function public.evento_resultados(evento uuid)
returns jsonb
language plpgsql security definer
set search_path=''
as $$
declare
  resultado jsonb;
begin
  if auth.uid() is null or not public.es_profesor() then
    raise exception 'Solo docentes';
  end if;
  if not exists (
    select 1 from public.eventos_evaluables where id=evento
  ) then
    raise exception 'Evento inexistente';
  end if;
  select jsonb_build_object(
    'total',count(*),
    'promedio',round(avg(nota)::numeric,2),
    'distribucion',coalesce(
      (
        select jsonb_object_agg(nota,cantidad)
        from (
          select nota,count(*) cantidad
          from public.evento_respuestas
          where evento_id=evento
          group by nota
        ) t
      ),
      '{}'::jsonb
    ),
    'comentarios',coalesce(
      jsonb_agg(comentario) filter (where trim(comentario)<>''),
      '[]'::jsonb
    )
  )
  into resultado
  from public.evento_respuestas
  where evento_id=evento;
  return resultado;
end;
$$;
revoke all on function public.evento_resultados(uuid) from public,anon;
grant execute on function public.evento_resultados(uuid) to authenticated;
