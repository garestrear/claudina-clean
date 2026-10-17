begin;
alter table public.evento_respuestas
add column if not exists tipo_participante text
check (tipo_participante in ('estudiante','acudiente','profesor'));
create or replace function public.evento_responder(
  evento uuid, calificacion integer, opinion text default ''
)
returns void language plpgsql security definer set search_path=''
as $$
declare
  ficha public.eventos_evaluables;
  tipo text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into ficha from public.eventos_evaluables where id=evento for share;
  if ficha.id is null or ficha.estado<>'abierto' then
    raise exception 'Evaluación no disponible';
  end if;
  if not public.evento_habilitado(ficha) then
    raise exception 'No estás habilitado para responder';
  end if;
  select rol into tipo from public.perfiles where id=auth.uid();
  if tipo is null or tipo not in ('estudiante','acudiente','profesor')
     or not (tipo=any(ficha.roles)) then
    raise exception 'Tu perfil no está habilitado para este evento';
  end if;
  if calificacion is null or calificacion not between 1 and 10
     or length(coalesce(opinion,''))>1000 then
    raise exception 'Respuesta inválida';
  end if;
  insert into public.evento_participantes(evento_id,usuario_id)
  values(evento,auth.uid());
  insert into public.evento_respuestas(evento_id,nota,comentario,tipo_participante)
  values(evento,calificacion,trim(coalesce(opinion,'')),tipo);
end;
$$;
create or replace function public.evento_resultados(evento uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  resultado jsonb;
  grupos jsonb;
begin
  if auth.uid() is null or not public.es_profesor() then
    raise exception 'Solo docentes';
  end if;
  if not exists(select 1 from public.eventos_evaluables where id=evento) then
    raise exception 'Evento inexistente';
  end if;
  select jsonb_build_object(
    'total',count(*),
    'promedio',round(avg(nota)::numeric,2),
    'distribucion',coalesce((
      select jsonb_object_agg(nota,cantidad)
      from (select nota,count(*) cantidad from public.evento_respuestas
            where evento_id=evento group by nota) t
    ),'{}'::jsonb),
    'comentarios',coalesce(
      jsonb_agg(comentario) filter(where trim(comentario)<>''),
      '[]'::jsonb)
  ) into resultado
  from public.evento_respuestas where evento_id=evento;
  select coalesce(jsonb_agg(jsonb_build_object(
    'tipo',g.tipo,
    'total',g.total,
    'promedio',g.promedio,
    'comentarios',g.comentarios
  ) order by g.tipo),'[]'::jsonb) into grupos
  from (
    select coalesce(tipo_participante,'sin_clasificar') tipo,
           count(*) total,
           round(avg(nota)::numeric,2) promedio,
           coalesce(jsonb_agg(comentario)
             filter(where trim(comentario)<>''),'[]'::jsonb) comentarios
    from public.evento_respuestas
    where evento_id=evento
    group by tipo_participante
  ) g;
  return resultado || jsonb_build_object('grupos',grupos);
end;
$$;
revoke all on function public.evento_responder(uuid,integer,text),
 public.evento_resultados(uuid) from public,anon;
grant execute on function public.evento_responder(uuid,integer,text),
 public.evento_resultados(uuid) to authenticated;
commit;
