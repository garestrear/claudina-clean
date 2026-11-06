-- Ejecutar en Supabase para permitir evaluar las visitas asignadas sin depender del aula o del horario.
-- Conserva permisos, conflictos, rúbricas, borradores y cierre de evaluaciones.
begin;
do $migracion$
declare definicion text; restriccion text := $restriccion$if not exists(select 1 from public.feria_programacion r join public.feria_espacios s on s.id=r.espacio_id and s.activo where r.origen=v.origen and r.proyecto_id=v.proyecto_id and r.activo and r.fecha=v.fecha and r.inicio<=v.inicio and r.fin>=v.fin) then raise exception 'La ubicación cambió; solicita al comité revisar la visita';end if;$restriccion$;
begin
 select pg_get_functiondef('public.feria_evaluacion_guardar(uuid,jsonb,boolean,integer,uuid)'::regprocedure) into definicion;
 if position(restriccion in definicion)>0 then
  execute replace(definicion,restriccion,'-- La asignación autoriza evaluar independientemente del horario y la ubicación.');
 elsif position('La ubicación cambió; solicita al comité revisar la visita' in definicion)>0 then
  raise exception 'No se reconoció la restricción de horario. No se realizaron cambios';
 end if;
end $migracion$;
notify pgrst,'reload schema';
commit;
