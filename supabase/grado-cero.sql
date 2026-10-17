-- Grado 0: TS y JR. Ejecutar completo después de las migraciones existentes.
-- Repetible: conserva estudiantes, respuestas, documentos y registros.
begin;
do $grado_cero$
declare item record; restriccion record; definicion text;
begin
 for item in select * from (values
  ('estudiantes','grado','grado between 0 and 8'),
  ('avisos','grado','grado between 0 and 8'),
  ('propuestas_tareas','grado','grado between 0 and 8'),
  ('registros_aseo','grupo', $$grupo in ('0','1','2','3','4','5','6','7','8','7-8')$$),
  ('horario_base','grupo', $$grupo in ('0','6','7-8')$$),
  ('horario_cambios','grupo', $$grupo in ('0','6','7-8')$$),
  ('encuestas','grados_participantes','cardinality(grados_participantes)>0 and grados_participantes <@ array[0,1,2,3,4,5,6,7,8]'),
  ('encuestas','grados_candidatos','cardinality(grados_candidatos)>0 and grados_candidatos <@ array[0,1,2,3,4,5,6,7,8]')
 ) as datos(tabla,columna,expresion) loop
  if to_regclass('public.'||item.tabla) is null then continue; end if;
  for restriccion in
   select c.conname from pg_constraint c
   join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
   where c.conrelid=to_regclass('public.'||item.tabla) and c.contype='c'
    and a.attname=item.columna and cardinality(c.conkey)=1
  loop
   execute format('alter table public.%I drop constraint %I',item.tabla,restriccion.conname);
  end loop;
  execute format('alter table public.%I add constraint %I check (%s)',
   item.tabla,item.tabla||'_'||item.columna||'_check',item.expresion);
 end loop;
 -- Actualiza las funciones instaladas conservando su versión, permisos y lógica.
 for item in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname in
   ('importar_estudiantes','evento_crear','evento_editar','tarea_revisar')
 loop
  definicion:=pg_get_functiondef(item.oid);
  definicion:=replace(definicion,'between 1 and 8','between 0 and 8');
  definicion:=replace(definicion,'^[1-8]$','^[0-8]$');
  definicion:=replace(definicion,'(1–8)','(0–8)');
  execute definicion;
 end loop;
 if to_regclass('public.eventos_evaluables') is not null then
  alter table public.eventos_evaluables alter column grados set default array[0,1,2,3,4,5,6,7,8];
 end if;
end;
$grado_cero$;
commit;
