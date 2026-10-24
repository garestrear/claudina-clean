-- Ejecutar en Supabase SQL Editor, después de las migraciones actuales de Feria STEAM.
-- Conserva las propuestas, sus revisiones y los permisos existentes.
begin;
alter table public.feria_proyectos drop constraint if exists feria_areas_validas;
alter table public.feria_proyectos add constraint feria_areas_validas check(
 cardinality(areas)<=6 and array_position(areas,null) is null
 and areas<@array['science','technology','engineering','arts','mathematics','emprendimiento']::text[]
);
do $migration$
declare funcion record; definicion text;
begin
 for funcion in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in('feria_guardar','feria_externa_guardar') and p.prokind='f'
 loop
  definicion:=pg_get_functiondef(funcion.oid);
  if position('''emprendimiento''' in definicion)=0 then
   definicion:=replace(definicion,'''mathematics''','''mathematics'',''emprendimiento''');
  end if;
  definicion:=replace(definicion,'between 1 and 5','between 1 and 6');
  execute definicion;
 end loop;
end;
$migration$;
notify pgrst,'reload schema';
commit;
