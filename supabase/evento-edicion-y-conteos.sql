begin;
create or replace function public.eventos_listar()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare resultado jsonb;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id,'titulo',e.titulo,'descripcion',e.descripcion,
  'estado',e.estado,'grados',e.grados,'roles',e.roles,
  'total_respuestas',case when public.es_profesor() then
    (select count(*) from public.evento_respuestas r where r.evento_id=e.id)
    else null end,
  'respondido',exists(select 1 from public.evento_participantes p
    where p.evento_id=e.id and p.usuario_id=auth.uid())
 ) order by e.created_at desc),'[]'::jsonb)
 into resultado from public.eventos_evaluables e
 where public.es_profesor() or (e.estado<>'borrador' and public.evento_habilitado(e));
 return resultado;
end;
$$;
create or replace function public.evento_editar(
 evento uuid, nombre text, detalle text, destinatarios integer[], tipos text[]
)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null or not public.es_profesor() then
   raise exception 'Solo docentes';
 end if;
 if length(trim(coalesce(nombre,''))) not between 1 and 150
    or length(coalesce(detalle,''))>1000 then
   raise exception 'Datos inválidos';
 end if;
 if tipos is null or cardinality(tipos)=0 or exists(
   select 1 from unnest(tipos) t
   where t is null or t not in ('estudiante','acudiente','profesor')
 ) then raise exception 'Roles inválidos'; end if;
 if destinatarios is null or cardinality(destinatarios)=0 or exists(
   select 1 from unnest(destinatarios) g where g is null or g not between 0 and 8
 ) then raise exception 'Grados inválidos'; end if;
 update public.eventos_evaluables
 set titulo=trim(nombre),descripcion=coalesce(detalle,''),
     grados=destinatarios,roles=tipos
 where id=evento;
 if not found then raise exception 'Evento inexistente'; end if;
end;
$$;
revoke all on function public.eventos_listar(),
 public.evento_editar(uuid,text,text,integer[],text[]) from public,anon;
grant execute on function public.eventos_listar(),
 public.evento_editar(uuid,text,text,integer[],text[]) to authenticated;
commit;
