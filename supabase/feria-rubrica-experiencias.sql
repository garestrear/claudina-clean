-- Ejecutar antes de iniciar nuevas evaluaciones con la rúbrica adaptada.
begin;
-- Las evaluaciones previas conservan su significado y su puntuación.
alter table public.feria_evaluaciones add column if not exists rubrica_version integer not null default 1;
alter table public.feria_evaluaciones alter column rubrica_version set default 2;
do $$declare d text;anterior text;nueva text;begin
 select pg_get_functiondef('public.feria_evaluacion_guardar(uuid,jsonb,boolean,integer,uuid)'::regprocedure) into d;
 if position('rubrica_version' in d)=0 then
  anterior:='pesos:=case p->>''categoria'' when ''arte'' then array[15,15,25,25,20] when ''emprendimiento'' then array[20,25,20,20,15] when ''familias'' then array[20,25,20,20,15] when ''puentes_juvenil'' then array[25,25,25,10,15] when ''puentes_infantil'' then array[20,25,25,15,15] else array[15,20,25,20,20] end;';
  nueva:='if coalesce(datos->>''rubrica_version'','''')<>coalesce(e.rubrica_version,2)::text then raise exception ''Actualiza Claudina App para utilizar la rúbrica correspondiente'';end if;
 if coalesce(e.rubrica_version,2)=1 then '||anterior||' else
 pesos:=case p->>''categoria'' when ''arte'' then array[25,25,20,15,15] when ''emprendimiento'' then array[20,25,25,15,15] when ''familias'' then array[20,25,20,20,15] when ''puentes_juvenil'' then array[25,25,25,10,15] when ''puentes_infantil'' then array[20,25,25,15,15] else array[30,25,20,15,10] end;end if;';
  if position(anterior in d)=0 then raise exception 'No se reconoció la función de evaluación. No se realizaron cambios';end if;
  d:=replace(d,anterior,nueva);execute d;
 end if;
end $$;
alter table public.feria_evaluacion_config add column if not exists rubrica_version integer not null default 2;
notify pgrst,'reload schema';
commit;
