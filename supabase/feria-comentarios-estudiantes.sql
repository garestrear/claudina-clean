-- Ejecutar después de feria-evaluacion-jurados.sql y feria-edicion-equipos.sql.
-- Conserva evaluaciones y permisos de acceso al proyecto.
begin;
create or replace function public.feria_comentarios_jurados(proyecto uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 -- Reutiliza la autorización vigente: responsable, integrantes, acudientes y docentes.
 perform public.feria_proyecto(proyecto);
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',v.id,'jurado',j.nombre,'destacado',e.destacado,'sugerencia',e.sugerencia
 ) order by j.nombre,v.id)
 from public.feria_evaluacion_visitas v
 join public.feria_evaluaciones e on e.visita_id=v.id
 join public.feria_jurados j on j.id=v.jurado_id
 where v.origen='claudina' and v.proyecto_id=proyecto and e.enviada
 and (length(trim(e.destacado))>0 or length(trim(e.sugerencia))>0)),'[]'::jsonb);
end $$;
revoke all on function public.feria_comentarios_jurados(uuid) from public,anon;
grant execute on function public.feria_comentarios_jurados(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
