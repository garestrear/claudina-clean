-- Ejecutar después de feria-rubrica-experiencias.sql. Conserva las notas existentes.
begin;
alter table public.feria_evaluaciones add column if not exists registro_manual boolean not null default false;
alter table public.feria_evaluaciones add column if not exists registrado_por uuid references auth.users(id);
alter table public.feria_evaluaciones add column if not exists promedio_manual numeric;
-- El registro de una nota global no inventa calificaciones de los cinco criterios.
do $$declare c record;begin
 for c in select conname from pg_constraint where conrelid='public.feria_evaluaciones'::regclass and contype='c' and pg_get_constraintdef(oid) like '%jsonb_array_length(notas)%' loop
 execute format('alter table public.feria_evaluaciones drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.feria_evaluaciones add constraint feria_evaluacion_nota_valida check(
 (registro_manual and enviada and registrado_por is not null and promedio_manual between 1 and 5 and puntaje=round(promedio_manual*20,2) and notas='[]'::jsonb)
 or (not registro_manual and (not enviada or (puntaje between 20 and 100 and jsonb_array_length(notas)=5)))
);
create or replace function public.feria_evaluacion_manual(visita uuid,promedio numeric,observacion text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.feria_evaluacion_visitas;e public.feria_evaluaciones;
begin
 if auth.uid() is null or not coalesce(public.es_profesor(),false) then raise exception 'Solo docentes pueden registrar evaluaciones en papel';end if;
 if promedio is null or promedio::text in ('NaN','Infinity','-Infinity') or promedio<1 or promedio>5 or promedio<>round(promedio,2) then raise exception 'Ingresa un promedio de 1 a 5 con máximo dos decimales';end if;
 if observacion is null or length(observacion)>2000 then raise exception 'La observación admite hasta 2000 caracteres';end if;
 perform pg_advisory_xact_lock(20261106,333);
 select * into v from public.feria_evaluacion_visitas where id=visita for update;
 if v.id is null then raise exception 'La asignación ya no existe. Actualiza la lista';end if;
 if exists(select 1 from public.feria_evaluaciones where visita_id=visita) then raise exception 'Esta visita ya tiene una evaluación o un borrador. No se sobrescribió';end if;
 insert into public.feria_evaluaciones(visita_id,notas,destacado,enviada,puntaje,solicitud,registro_manual,registrado_por,promedio_manual)
 values(v.id,'[]',observacion,true,round(promedio*20,2),gen_random_uuid(),true,auth.uid(),promedio) returning * into e;
 update public.feria_evaluacion_config set version=version+1 where id=true;
 return to_jsonb(e);
end $$;
revoke all on function public.feria_evaluacion_manual(uuid,numeric,text) from public,anon;
grant execute on function public.feria_evaluacion_manual(uuid,numeric,text) to authenticated;
notify pgrst,'reload schema';
commit;
