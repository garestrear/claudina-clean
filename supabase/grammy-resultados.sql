-- Actualiza únicamente la consulta de resultados. Conserva votos y cierre.
-- El conteo agregado solo se entrega a profesores o tras publicar.
begin;
create or replace function public.grammy_contexto()
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare profesor boolean:=public.es_profesor();config jsonb;conteo jsonb;ganadores jsonb;
begin
 if auth.uid() is null or not(profesor or public.grammy_puede_participar()) then
  raise exception 'Esta votación es para estudiantes activos de 6°, 7° y 8° y profesores.';
 end if;
 select to_jsonb(c) into config from public.grammy_config c where id=1;
 if profesor or (config->>'resultados_publicados')::boolean then
  conteo:=public.grammy_conteo();
  select coalesce(jsonb_agg(x),'[]'::jsonb) into ganadores
  from jsonb_array_elements(conteo) x
  where (x->>'votos')::integer=(select max((y->>'votos')::integer) from jsonb_array_elements(conteo)y where y->>'categoria_id'=x->>'categoria_id');
 end if;
 return jsonb_build_object(
 'profesor',profesor,'config',config,
 'categorias',coalesce((select jsonb_agg(to_jsonb(c) order by orden) from public.grammy_categorias c where profesor or habilitada),'[]'::jsonb),
 'candidatos',coalesce((select jsonb_agg(to_jsonb(e) order by nombre) from (select id,nombre,grado from public.estudiantes where activo and grado in(6,7,8)) e),'[]'::jsonb),
 'mis_votos',coalesce((select jsonb_object_agg(categoria_id::text,candidato_id::text) from public.grammy_votos where autor=auth.uid()),'{}'::jsonb),
 'conteo',conteo,
 'ganadores',ganadores,
 'votantes',case when profesor then (select count(distinct autor) from public.grammy_votos v where exists(select 1 from public.estudiantes e where e.auth_user_id=v.autor and e.activo and e.grado in(6,7,8))) else null end
 );
end;
$$;
revoke all on function public.grammy_contexto() from public;
grant execute on function public.grammy_contexto() to authenticated;

commit;
