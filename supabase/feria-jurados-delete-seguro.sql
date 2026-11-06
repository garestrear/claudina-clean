-- Corrige únicamente la limpieza de una tabla temporal del optimizador.
-- No elimina jurados ni evaluaciones.
begin;
do $$
declare definicion text;
begin
 select pg_get_functiondef('public.feria_optimizar_recorridos_aulas()'::regprocedure) into definicion;
 definicion:=replace(definicion,
  'delete from pg_temp.feria_ruta_movidas;',
  'delete from pg_temp.feria_ruta_movidas where id is not null;');
 execute definicion;
end $$;
notify pgrst,'reload schema';
commit;
