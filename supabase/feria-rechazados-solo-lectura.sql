-- Ejecutar completo: los rechazados quedan solo para consulta de participantes.
-- Conserva contenidos, revisiones y la libertad del docente para cambiar el estado.
begin;
create or replace function public.feria_proteger_rechazado()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.estado='rechazado' and not coalesce(public.es_profesor(),false) then
  raise exception 'Este proyecto fue rechazado y no admite cambios. Un docente debe cambiar su estado para habilitar la edición';
 end if;
 return new;
end $$;
revoke all on function public.feria_proteger_rechazado() from public,anon,authenticated;
drop trigger if exists feria_proteger_rechazado on public.feria_proyectos;
create trigger feria_proteger_rechazado before update on public.feria_proyectos for each row execute function public.feria_proteger_rechazado();
drop trigger if exists feria_proteger_rechazado on public.feria_proyectos_externos;
create trigger feria_proteger_rechazado before update on public.feria_proyectos_externos for each row execute function public.feria_proteger_rechazado();
do $$declare definicion text;begin
 definicion:=pg_get_functiondef('public.feria_proyecto(uuid)'::regprocedure);
 if position('''puede_editar'',coalesce(' in definicion)>0 then
  definicion:=replace(definicion,'''puede_editar'',coalesce(','''puede_editar'',(p.estado<>''rechazado'') and coalesce(');
  execute definicion;
 elsif position('''puede_editar'',(p.estado<>''rechazado'') and coalesce(' in definicion)=0 then
  raise exception 'Revisa la definición de feria_proyecto antes de aplicar el permiso de solo lectura';
 end if;
end $$;
notify pgrst,'reload schema';
commit;
